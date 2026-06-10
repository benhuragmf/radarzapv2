import mongoose from 'mongoose';
import type { IDestination } from '@/models/Destination';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import { InboxTicket } from '@/models/InboxTicket';

export interface AiContactContext {
  name?: string;
  email?: string;
  phone?: string;
  organization?: string;
  tags: string[];
  notes?: string;
  recentTickets: Array<{ ref: string; subject?: string; status: string }>;
  knownFields: {
    name: boolean;
    email: boolean;
  };
}

export class AiContextService {
  private static instance: AiContextService;

  static getInstance(): AiContextService {
    if (!this.instance) this.instance = new AiContextService();
    return this.instance;
  }

  async buildContactContext(
    clientId: string,
    dest: IDestination,
  ): Promise<AiContactContext> {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const tickets = await InboxTicket.find({
      clientId: clientOid,
      destinationId: dest._id,
      deletedAt: { $exists: false },
    })
      .sort({ updatedAt: -1 })
      .limit(5)
      .select('ticketRef subject status')
      .lean();

    const name = dest.name?.trim() || undefined;
    const email = dest.email?.trim() || undefined;

    return {
      name: name && name !== dest.identifier ? name : undefined,
      email,
      phone: dest.identifier,
      organization: dest.organization?.trim() || undefined,
      tags: dest.tags ?? [],
      notes: dest.notes?.trim() || undefined,
      recentTickets: tickets.map(t => ({
        ref: t.ticketRef,
        subject: t.subject,
        status: t.status,
      })),
      knownFields: {
        name: Boolean(name && name !== dest.identifier),
        email: Boolean(email?.includes('@')),
      },
    };
  }

  /** Referência do cadastro no estado — nome exige confirmação explícita do cliente. */
  seedStateFromContact(
    state: IAiConversationState,
    ctx: AiContactContext,
    prompt: IAiPrompt,
  ): void {
    if (prompt.collectName && ctx.knownFields.name && ctx.name && !state.registryNameSnapshot) {
      state.registryNameSnapshot = ctx.name;
    }
    if (!prompt.skipKnownFields && prompt.collectEmail && ctx.knownFields.email && ctx.email) {
      if (!state.collectedEmail) state.collectedEmail = ctx.email;
    }
  }

  formatContextBlock(ctx: AiContactContext): string {
    const open = ctx.recentTickets.find(t => t.status === 'open' || t.status === 'in_progress');
    const lines: string[] = [
      `Nome: ${ctx.name ?? '(não informado)'}`,
      `Telefone: ${ctx.phone ?? '(não informado)'}`,
      `E-mail: ${ctx.email ?? '(não informado)'}`,
      `Empresa: ${ctx.organization ?? '(não informado)'}`,
      `Ticket aberto: ${open ? `${open.ref} [${open.status}]` : 'nenhum'}`,
    ];
    if (ctx.tags.length) lines.push(`Status/Tags: ${ctx.tags.join(', ')}`);
    if (ctx.notes) lines.push(`Histórico resumido: ${ctx.notes.slice(0, 400)}`);
    if (ctx.recentTickets.length) {
      lines.push(
        `Chamados recentes: ${ctx.recentTickets
          .map(t => `${t.ref}${t.subject ? ` (${t.subject})` : ''} [${t.status}]`)
          .join('; ')}`,
      );
    }
    lines.push(
      'Regras: use USER para personalizar; confirme o nome com o cliente mesmo se constar no cadastro; peça e-mail se faltar; não exponha dados sensíveis.',
    );
    return lines.join('\n');
  }

  /** Lista campos que NÃO precisa pedir ao cliente (nome nunca entra — exige confirmação). */
  fieldsAlreadyKnown(ctx: AiContactContext, prompt: IAiPrompt): string[] {
    if (!prompt.skipKnownFields) return [];
    const skip: string[] = [];
    if (prompt.collectEmail && ctx.knownFields.email) skip.push('e-mail');
    return skip;
  }

  buildNameConfirmationPrompt(registryName?: string): string {
    if (registryName?.trim()) {
      const first = registryName.trim().split(/\s+/)[0];
      return `Para confirmar que estou falando com a pessoa certa, você é *${first}*? Responda *sim* ou informe seu nome.`;
    }
    return 'Para começar, qual é o seu *nome completo*?';
  }

  buildEmailCollectionPrompt(name?: string): string {
    const first = name?.trim().split(/\s+/)[0];
    return first
      ? `Obrigado, ${first}! Para registrar seu atendimento, qual é o seu *e-mail*?`
      : 'Para registrar seu atendimento, qual é o seu *e-mail*?';
  }

  parseNameConfirmation(
    text: string,
    registryName?: string,
  ): { confirmed: boolean; name?: string; denied?: boolean } {
    const norm = this.normalizeFieldText(text);
    if (!norm) return { confirmed: false };

    if (/^(nao|nao sou|outra pessoa|pessoa errada|errado)$/.test(norm)) {
      return { confirmed: false, denied: true };
    }

    if (registryName && this.nameMatchesRegistry(norm, registryName)) {
      return { confirmed: true, name: registryName.trim() };
    }

    if (
      registryName?.trim() &&
      /^(sim|sou eu|isso|confirmo|eu mesmo|essa mesma|correto|isso mesmo|sou)$/.test(norm)
    ) {
      return { confirmed: true, name: registryName.trim() };
    }

    const nameFromPhrase = text
      .trim()
      .match(/^(?:meu nome é|me chamo|sou o|sou a)\s+(.+?)(?:\s+atualize|\s+por favor)?$/i);
    if (nameFromPhrase?.[1] && this.textLooksLikePersonName(nameFromPhrase[1])) {
      return { confirmed: true, name: nameFromPhrase[1].trim() };
    }

    if (this.textLooksLikePersonName(text)) {
      return { confirmed: true, name: text.trim() };
    }

    return { confirmed: false };
  }

  emailInText(text: string): string | undefined {
    return text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)?.[0]?.toLowerCase();
  }

  needsEmailCollection(
    state: IAiConversationState,
    ctx: AiContactContext,
    prompt: IAiPrompt,
  ): boolean {
    if (!prompt.collectEmail) return false;
    if (state.collectedEmail?.includes('@')) return false;
    if (prompt.skipKnownFields && ctx.knownFields.email) return false;
    return true;
  }

  async persistCollectedFields(
    dest: IDestination,
    fields: { name?: string; email?: string },
  ): Promise<void> {
    let changed = false;
    if (fields.name?.trim() && fields.name.trim() !== dest.name) {
      dest.name = fields.name.trim();
      changed = true;
    }
    if (fields.email?.trim() && fields.email.includes('@') && fields.email !== dest.email) {
      dest.email = fields.email.trim().toLowerCase();
      changed = true;
    }
    if (changed) await dest.save();
  }

  private nameMatchesRegistry(norm: string, registryName: string): boolean {
    const regNorm = this.normalizeFieldText(registryName);
    if (!regNorm) return false;
    if (norm === regNorm) return true;
    const first = regNorm.split(/\s+/)[0];
    return norm === first || norm.includes(first);
  }

  private textLooksLikePersonName(text: string): boolean {
    const t = text.trim();
    if (!t || t.includes('@') || /\d/.test(t)) return false;
    if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|sim|nao|não)$/i.test(t)) return false;
    const words = t.split(/\s+/).filter(Boolean);
    return words.length <= 4 && t.length <= 60;
  }

  private normalizeFieldText(text: string): string {
    return text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '')
      .replace(/[!?.]+$/g, '')
      .trim();
  }
}
