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
      .limit(3)
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

  /** Preenche estado da conversa com dados já existentes no cadastro. */
  seedStateFromContact(
    state: IAiConversationState,
    ctx: AiContactContext,
    prompt: IAiPrompt,
  ): void {
    if (!prompt.skipKnownFields) return;

    if (prompt.collectName && ctx.knownFields.name && ctx.name && !state.collectedName) {
      state.collectedName = ctx.name;
    }
    if (prompt.collectEmail && ctx.knownFields.email && ctx.email && !state.collectedEmail) {
      state.collectedEmail = ctx.email;
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
      'Regras: use USER para personalizar; não pergunte nome/e-mail se já existirem; não exponha dados sensíveis.',
    );
    return lines.join('\n');
  }

  /** Lista campos que NÃO precisa pedir ao cliente. */
  fieldsAlreadyKnown(ctx: AiContactContext, prompt: IAiPrompt): string[] {
    if (!prompt.skipKnownFields) return [];
    const skip: string[] = [];
    if (prompt.collectName && ctx.knownFields.name) skip.push('nome');
    if (prompt.collectEmail && ctx.knownFields.email) skip.push('e-mail');
    return skip;
  }
}
