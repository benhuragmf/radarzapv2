export interface InboxQuickReply {
  code: string;
  label: string;
  template: string;
}

export const DEFAULT_INACTIVITY_WARNING_QUICK_CODE = 'aus';
export const DEFAULT_INACTIVITY_CLOSE_QUICK_CODE = 'enc';
export const DEFAULT_GRACEFUL_CLOSE_QUICK_CODE = 'mais';
export const DEFAULT_INACTIVITY_CLOSE_GRACEFUL_QUICK_CODE = 'enc_ok';

export function normalizeQuickReplyCode(code: string): string {
  return code.trim().replace(/^\//, '').toLowerCase().replace(/\s+/g, '');
}

export function resolveInactivityWarningQuickCode(settings?: {
  inactivityWarningQuickCode?: string | null;
}): string {
  const raw = settings?.inactivityWarningQuickCode?.trim();
  return raw ? normalizeQuickReplyCode(raw) : DEFAULT_INACTIVITY_WARNING_QUICK_CODE;
}

export function resolveInactivityCloseQuickCode(settings?: {
  inactivityCloseQuickCode?: string | null;
}): string {
  const raw = settings?.inactivityCloseQuickCode?.trim();
  return raw ? normalizeQuickReplyCode(raw) : DEFAULT_INACTIVITY_CLOSE_QUICK_CODE;
}

export function resolveGracefulCloseQuickCode(settings?: {
  gracefulCloseQuickCode?: string | null;
}): string {
  const raw = settings?.gracefulCloseQuickCode?.trim();
  return raw ? normalizeQuickReplyCode(raw) : DEFAULT_GRACEFUL_CLOSE_QUICK_CODE;
}

export function resolveInactivityCloseGracefulQuickCode(settings?: {
  inactivityCloseGracefulQuickCode?: string | null;
}): string {
  const raw = settings?.inactivityCloseGracefulQuickCode?.trim();
  return raw
    ? normalizeQuickReplyCode(raw)
    : DEFAULT_INACTIVITY_CLOSE_GRACEFUL_QUICK_CODE;
}

export function isGracefulCloseQuickCode(
  quickCode: string | null,
  settings?: { gracefulCloseQuickCode?: string | null },
): boolean {
  if (!quickCode) return false;
  return quickCode.toLowerCase() === resolveGracefulCloseQuickCode(settings);
}

export function isInactivityWarningQuickCode(
  quickCode: string | null,
  settings?: { inactivityWarningQuickCode?: string | null },
): boolean {
  if (!quickCode) return false;
  return quickCode.toLowerCase() === resolveInactivityWarningQuickCode(settings);
}

export function isInactivityCloseQuickCode(
  quickCode: string | null,
  settings?: { inactivityCloseQuickCode?: string | null },
): boolean {
  if (!quickCode) return false;
  return quickCode.toLowerCase() === resolveInactivityCloseQuickCode(settings);
}

export function isInactivityCloseGracefulQuickCode(
  quickCode: string | null,
  settings?: { inactivityCloseGracefulQuickCode?: string | null },
): boolean {
  if (!quickCode) return false;
  return quickCode.toLowerCase() === resolveInactivityCloseGracefulQuickCode(settings);
}

/** Minutos após o aviso (/aus ou código configurado) para liberar o encerramento manual. */
export function inactivityCloseAfterWarningMinutes(
  closeMinutes: number,
  warningMinutes: number,
): number {
  if (closeMinutes <= 0) return 0;
  if (warningMinutes > 0 && warningMinutes < closeMinutes) {
    return closeMinutes - warningMinutes;
  }
  return closeMinutes;
}

export const DEFAULT_INBOX_QUICK_REPLIES: InboxQuickReply[] = [
  {
    code: 'bd',
    label: 'Bom dia',
    template: 'Olá [user], bom dia! Como posso ajudá-lo(a) hoje?',
  },
  {
    code: 'bt',
    label: 'Boa tarde',
    template: 'Olá [user], boa tarde! Como posso ajudá-lo(a)?',
  },
  {
    code: 'dados',
    label: 'Solicitar dados',
    template: 'Por favor, me informe seu nome completo e e-mail.',
  },
  {
    code: 'ag',
    label: 'Aguarde',
    template: 'Aguarde um instante enquanto verifico.',
  },
  {
    code: 'aus',
    label: 'Está aí?',
    template: 'Você está aí?',
  },
  {
    code: 'mais',
    label: 'Mais alguma coisa?',
    template: 'Posso ajudá-lo(a) em mais alguma coisa?',
  },
  {
    code: 'enc',
    label: 'Encerrar por inatividade',
    template:
      'Como não houve interação há mais de 1 min, encerrarei este atendimento.',
  },
  {
    code: 'enc_ok',
    label: 'Encerrar atendimento',
    template: 'Perfeito! Fico feliz em ter ajudado. Se precisar, é só chamar. Até logo!',
  },
  {
    code: 'ticket',
    label: 'Abrir ticket',
    template: 'Estarei abrindo um ticket com sua solicitação.',
  },
];

export function applyQuickReplyTemplate(template: string, contactName: string): string {
  const firstName = contactName.trim().split(/\s+/)[0] || 'cliente';
  return template.replace(/\[user\]/gi, firstName).replace(/\[nome\]/gi, firstName);
}

/** Código da resposta rápida quando o texto começa com `/codigo`. */
export function parseQuickReplyCode(text: string): string | null {
  const match = text.trim().match(/^\/(\w+)/);
  return match ? match[1].toLowerCase() : null;
}

export function expandQuickReply(
  text: string,
  quickReplies: InboxQuickReply[],
  contactName: string,
): string {
  const trimmed = text.trim();
  const match = trimmed.match(/^\/(\w+)(?:\s+([\s\S]*))?$/);
  if (!match) return text;
  const [, code, rest] = match;
  const qr = quickReplies.find(q => q.code.toLowerCase() === code.toLowerCase());
  if (!qr) return text;
  const expanded = applyQuickReplyTemplate(qr.template, contactName);
  const tail = rest?.trim();
  return tail ? `${expanded}\n${tail}` : expanded;
}

export function normalizeQuickReplies(raw: unknown): InboxQuickReply[] {
  if (!Array.isArray(raw) || raw.length === 0) {
    return DEFAULT_INBOX_QUICK_REPLIES.map(q => ({ ...q }));
  }
  const out: InboxQuickReply[] = [];
  const seen = new Set<string>();
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const code = String(row.code ?? '')
      .trim()
      .replace(/^\//, '')
      .toLowerCase()
      .replace(/\s+/g, '');
    const label = String(row.label ?? '').trim();
    const template = String(row.template ?? '').trim();
    if (!code || !template) continue;
    if (seen.has(code)) {
      const idx = out.findIndex(q => q.code === code);
      if (idx >= 0) out.splice(idx, 1);
    }
    seen.add(code);
    out.push({ code, label: label || code, template });
  }
  return out.length ? out : DEFAULT_INBOX_QUICK_REPLIES.map(q => ({ ...q }));
}
