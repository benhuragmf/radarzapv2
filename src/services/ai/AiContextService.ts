import mongoose from 'mongoose';
import type { IDestination } from '@/models/Destination';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';
import { InboxConversation } from '@/models/InboxConversation';
import { textLooksLikeGreetingOrNonName } from '@/utils/ai-kb-client.util';
import {
  maskContactDisplayName,
  resolveRegistryNameFromDestination,
  shouldReconfirmContactName,
} from '@/utils/ai-name-confirm.util';
import { resolveContactAddress } from '@/utils/contact-address.util';
import { listClientFacingTickets } from '@/services/inbox/client-ticket-list';

export interface AiContactContext {
  name?: string;
  email?: string;
  phone?: string;
  address?: string;
  organization?: string;
  tags: string[];
  notes?: string;
  recentTickets: Array<{ ref: string; subject?: string; status: string }>;
  knownFields: {
    name: boolean;
    email: boolean;
    address: boolean;
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
    const tickets = await listClientFacingTickets(clientId, dest._id as mongoose.Types.ObjectId);

    const name = resolveRegistryNameFromDestination(dest);
    const email = dest.email?.trim() || undefined;
    const address = resolveContactAddress(dest);

    return {
      name,
      email,
      address,
      phone: dest.identifier,
      organization: dest.organization?.trim() || undefined,
      tags: dest.tags ?? [],
      notes: dest.notes?.trim() || undefined,
      recentTickets: tickets.map(t => ({
        ref: t.ref,
        subject: t.subject,
        status: t.status,
      })),
      knownFields: {
        name: Boolean(name),
        email: Boolean(email?.includes('@')),
        address: Boolean(address && address.length >= 20),
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
    if (!prompt.skipKnownFields && prompt.collectAddress && ctx.knownFields.address && ctx.address) {
      if (!state.collectedAddress) state.collectedAddress = ctx.address;
    }
  }

  formatContextBlock(ctx: AiContactContext): string {
    const open = ctx.recentTickets.find(t => t.status === 'open' || t.status === 'in_progress');
    const lines: string[] = [
      `Nome: ${ctx.name ?? '(não informado)'}`,
      `Telefone: ${ctx.phone ?? '(não informado)'}`,
      `E-mail: ${ctx.email ?? '(não informado)'}`,
      `Endereço: ${ctx.address ?? '(não informado)'}`,
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
    if (prompt.collectAddress && ctx.knownFields.address) skip.push('endereço');
    return skip;
  }

  buildNameConfirmationPrompt(registryName?: string): string {
    if (registryName?.trim()) {
      const masked = maskContactDisplayName(registryName);
      return `Me confirme seu nome: você é o *${masked}*? Pra continuar, confirme seu nome!`;
    }
    return 'Para começar, qual é o seu *nome completo*?';
  }

  /** Último contato anterior a esta conversa (Inbox). */
  async getLastContactAt(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    excludeConversationId?: mongoose.Types.ObjectId,
  ): Promise<Date | null> {
    const filter: Record<string, unknown> = {
      clientId: new mongoose.Types.ObjectId(clientId),
      destinationId,
    };
    if (excludeConversationId) {
      filter._id = { $ne: excludeConversationId };
    }
    const last = await InboxConversation.findOne(filter)
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .select('lastMessageAt createdAt')
      .lean();
    if (!last) return null;
    return last.lastMessageAt ?? last.createdAt ?? null;
  }

  /** Contato recente (<30d) com nome no cadastro — não precisa reconfirmar. */
  async shouldAutoConfirmRegistryName(
    clientId: string,
    destinationId: mongoose.Types.ObjectId,
    registryName: string | undefined,
    excludeConversationId?: mongoose.Types.ObjectId,
  ): Promise<boolean> {
    if (!registryName?.trim()) return false;
    const lastAt = await this.getLastContactAt(clientId, destinationId, excludeConversationId);
    return !shouldReconfirmContactName(lastAt);
  }

  async tryAutoConfirmKnownContact(
    state: IAiConversationState,
    opts: {
      clientId: string;
      destinationId: mongoose.Types.ObjectId;
      conversationId: mongoose.Types.ObjectId;
      registryName?: string;
    },
  ): Promise<boolean> {
    if (state.nameConfirmed) return true;
    const registry = opts.registryName?.trim();
    if (!registry) return false;

    const recent = await this.shouldAutoConfirmRegistryName(
      opts.clientId,
      opts.destinationId,
      registry,
      opts.conversationId,
    );
    if (!recent) return false;

    state.collectedName = registry;
    state.nameConfirmed = true;
    if (!state.registryNameSnapshot) state.registryNameSnapshot = registry;
    await state.save();
    return true;
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
    fields: { name?: string; email?: string; address?: string; phone?: string; organization?: string; deliveryNotes?: string; preferredSchedule?: string; taxDocument?: string },
  ): Promise<void> {
    const { persistContactCollectedData } = await import(
      '@/services/contacts/contact-collected-data.service'
    );
    await persistContactCollectedData({
      clientId: String(dest.clientId),
      destinationId: String(dest._id),
      fields,
    });
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
    if (textLooksLikeGreetingOrNonName(t)) return false;
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
