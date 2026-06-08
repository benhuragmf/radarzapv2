export interface InboxQuickReply {
  code: string;
  label: string;
  template: string;
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
    code: 'enc',
    label: 'Encerrar por inatividade',
    template:
      'Como não houve interação há mais de 1 min, encerrarei este atendimento.',
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
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const row = item as Record<string, unknown>;
    const code = String(row.code ?? '')
      .trim()
      .replace(/^\//, '')
      .toLowerCase();
    const label = String(row.label ?? '').trim();
    const template = String(row.template ?? '').trim();
    if (!code || !template) continue;
    out.push({ code, label: label || code, template });
  }
  return out.length ? out : DEFAULT_INBOX_QUICK_REPLIES.map(q => ({ ...q }));
}
