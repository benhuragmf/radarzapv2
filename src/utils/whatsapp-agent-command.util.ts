/** Comandos operacionais via WhatsApp (!assumir, !ticket, …) — Fase D. */

export type WhatsappAgentCommandName = 'assumir' | 'ticket' | 'encerrar' | 'ajuda' | 'help';

const COMMAND_RE = /^!(assumir|ticket|encerrar|ajuda|help)(?:\s+(.+))?$/i;

export function parseWhatsappAgentCommand(
  text: string,
): { command: WhatsappAgentCommandName; arg?: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('!')) return null;
  const match = trimmed.match(COMMAND_RE);
  if (!match) return null;
  const command = match[1].toLowerCase() as WhatsappAgentCommandName;
  const arg = match[2]?.trim();
  if (command !== 'ajuda' && command !== 'help' && !arg) return null;
  return { command, arg };
}

/** Normaliza argumento para TK-XXXXXX. */
export function normalizeCommandTicketRef(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.startsWith('TK-')) return upper.replace(/\s+/g, '');
  const alnum = upper.replace(/[^A-Z0-9]/g, '');
  return alnum ? `TK-${alnum}` : upper;
}

export const WHATSAPP_AGENT_COMMAND_HELP = [
  'Comandos RadarZap (atendentes com WhatsApp cadastrado em Equipe):',
  '',
  '!assumir TK-XXXX — assumir chamado (chat do site ou WhatsApp)',
  '!ticket TK-XXXX — resumo do chamado',
  '!encerrar TK-XXXX — encerrar chamado',
  '!ajuda — esta mensagem',
  '',
  'Com bridge ativo: responda normalmente ou TK-XXXX sua mensagem (vários chamados).',
].join('\n');
