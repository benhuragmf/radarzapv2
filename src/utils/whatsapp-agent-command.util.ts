/** Comandos operacionais via WhatsApp (!assumir, !ticket, …) — Fase D. */

export type WhatsappAgentCommandName =
  | 'assumir'
  | 'abrir'
  | 'abrirchamado'
  | 'ticket'
  | 'token'
  | 'nota'
  | 'abertos'
  | 'chamados'
  | 'meus'
  | 'encerrar'
  | 'encerrarchat'
  | 'sairchat'
  | 'fecharchat'
  | 'ajuda'
  | 'help';

const CHAT_END_ALIASES = new Set(['encerrarchat', 'sairchat', 'fecharchat']);
const ABRIR_ALIASES = new Set(['abrir', 'abrirchamado']);
const LIST_OPEN_ALIASES = new Set(['abertos', 'chamados']);
const NO_ARG_COMMANDS = new Set<WhatsappAgentCommandName>([
  'ajuda',
  'help',
  'abertos',
  'chamados',
  'meus',
]);

const COMMAND_RE =
  /^!(assumir|abrir|abrirchamado|ticket|token|nota|abertos|chamados|meus|encerrarchat|sairchat|fecharchat|encerrar|ajuda|help)(?:\s+([\s\S]+))?$/i;

export function isWhatsappAbrirCommand(command: WhatsappAgentCommandName): boolean {
  return ABRIR_ALIASES.has(command);
}

export function isWhatsappChatEndCommand(command: WhatsappAgentCommandName): boolean {
  return CHAT_END_ALIASES.has(command);
}

export function isWhatsappListOpenCommand(command: WhatsappAgentCommandName): boolean {
  return LIST_OPEN_ALIASES.has(command);
}

export function parseWhatsappAgentCommand(
  text: string,
): { command: WhatsappAgentCommandName; arg?: string } | null {
  const trimmed = text.trim();
  if (!trimmed.startsWith('!')) return null;
  const match = trimmed.match(COMMAND_RE);
  if (!match) return null;
  const command = match[1].toLowerCase() as WhatsappAgentCommandName;
  const arg = match[2]?.trim();
  if (!NO_ARG_COMMANDS.has(command) && !arg) return null;
  return { command, arg };
}

/** Normaliza argumento para TK-XXXXXX. */
export function normalizeCommandTicketRef(raw: string): string {
  const upper = raw.trim().toUpperCase();
  if (upper.startsWith('TK-')) return upper.replace(/\s+/g, '');
  const alnum = upper.replace(/[^A-Z0-9]/g, '');
  return alnum ? `TK-${alnum}` : upper;
}

/**
 * Separa referência TK-… do texto livre (motivo, @setores, etc.).
 * Ex.: `TK-ABC Cliente precisa @suporte2` → ref + message
 */
/** Texto de exemplo do alerta WA / !ajuda — não gravar como assunto ou nota. */
export function isPlaceholderTicketOpeningMessage(text: string): boolean {
  const trimmed = text.trim();
  if (!trimmed) return true;
  const lower = trimmed.toLowerCase();
  if (/^motivo[…\.]{0,3}$/i.test(trimmed)) return true;
  if (/^motivo/.test(lower) && /\bex\.:\s*@/i.test(trimmed)) return true;
  if (/^ex\.:\s*@/i.test(trimmed)) return true;
  if (/^cliente precisa @setor$/i.test(trimmed)) return true;
  return false;
}

export function parseCommandTicketArg(raw: string): { ticketRef: string; message?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ticketRef: '' };
  }
  const spaceIdx = trimmed.search(/\s/);
  if (spaceIdx === -1) {
    return { ticketRef: normalizeCommandTicketRef(trimmed) };
  }
  const refPart = trimmed.slice(0, spaceIdx);
  const message = trimmed.slice(spaceIdx + 1).trim();
  return {
    ticketRef: normalizeCommandTicketRef(refPart),
    message: message || undefined,
  };
}

export const WHATSAPP_AGENT_COMMAND_HELP = [
  '📋 RadarZap — Comandos WhatsApp (Equipe)',
  '',
  '▸ Atendimento — chat do site',
  '!assumir TK-… — assumir conversa + bridge (não abre chamado)',
  '!abrir TK-… [motivo] — abrir chamado + token ao visitante',
  '   Ex.: !abrir TK-ABC Cliente precisa @suporte2, @financeiro',
  '!token TK-… — reenviar token de consulta ao visitante',
  '!nota TK-… texto — nota interna no chamado (sem enviar ao cliente)',
  '',
  '▸ Consulta',
  '!ticket TK-… — resumo de um chamado',
  '!abertos — chamados abertos + conversas site aguardando !abrir',
  '!meus — seus chamados/conversas em andamento',
  '',
  '▸ Encerrar',
  '!encerrarchat TK-… — encerra chat do site (chamado continua no painel)',
  '!encerrar TK-… — arquiva chamado e conversa',
  '',
  '▸ Ajuda',
  '!ajuda — esta mensagem',
  '',
  'Com bridge ativo: responda normalmente ou TK-XXXX sua mensagem (vários chamados).',
].join('\n');
