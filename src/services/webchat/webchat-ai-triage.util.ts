import { AiEscalationService } from '../ai/AiEscalationService';

export type WebChatMessageRow = {
  direction: 'inbound' | 'outbound' | 'system';
  body: string;
};

const PROBLEM_HINT =
  /\b(problema|erro|ajuda|n[aã]o conecta|n[aã]o funciona|parou|instala|rastreador|rastreadores|gps|aplicativo|app|offline|sinal|equipamento|cobran[cç]a|boleto|pagamento)\b/i;

const COMMERCIAL_HINT =
  /\b(produto|produtos|promo[cç][aã]o|promo[cç][oõ]es|venda|vendas|pre[cç]o|valor|plano|planos|contrat|assinatura|pacote|comprar|or[cç]amento|cota[cç][aã]o|desconto|oferta)\b/i;

const INQUIRY_HINT = new RegExp(
  `${PROBLEM_HINT.source.slice(1, -2)}|${COMMERCIAL_HINT.source.slice(1, -2)}`,
  'i',
);

const VAGUE_DEPARTMENT_ONLY =
  /\b(falar com|quero suporte|preciso de suporte|suporte tecnico|suporte técnico|atendente humano|o comercial|a comercial|setor comercial|time comercial)\b/i;

const STILL_NEEDS_HUMAN =
  /\b(ainda preciso|quero (?:falar|conversar)|preciso (?:falar|de) (?:com )?(?:um )?(?:atendente|humano|suporte)|n[aã]o resolveu|n[aã]o ajudou|n[aã]o funcionou|transfer[eir]|encaminh|falar com (?:um )?atendente)\b/i;

const RESOLVED_CONFIRM =
  /\b(resolveu|funcionou|deu certo|era isso|obrigad|valeu|s[oó] isso|nao preciso mais|não preciso mais)\b/i;

export function buildWebChatPromptSuffix(opts: {
  visitorName?: string;
  visitorEmail?: string;
}): string {
  const first = opts.visitorName?.trim().split(/\s+/)[0];
  const lines = [
    '',
    '## Regras obrigatórias — chat do site',
    '- Respostas curtas, claras, em português.',
  ];
  if (first) {
    lines.push(
      `- O visitante JÁ informou o nome no formulário: trate-o como *${first}*. NÃO peça nome, NÃO peça confirmação de nome.`,
    );
  }
  if (opts.visitorEmail?.trim()) {
    lines.push(`- E-mail já informado no formulário. NÃO peça e-mail.`);
  }
  lines.push(
    '- Se pedir setor/suporte/comercial/atendente SEM detalhar a dúvida, pergunte o que deseja tratar (ex.: "Pode me adiantar sobre o que gostaria de saber?"). shouldEscalate=false.',
    '- Com dúvida concreta (técnica, produto, promoção, plano, cobrança), use KNOWLEDGE/SKILLS/MEMORY para orientar ANTES de transferir.',
    '- Para produtos/promoções: informe o que souber da base; se faltar detalhe, pergunte qual produto/serviço interessa.',
    '- Depois de orientar, pergunte se resolveu ou se ainda quer falar com um atendente humano.',
    '- shouldEscalate=true SOMENTE se: (a) cliente confirmar que ainda precisa de humano após você tentar ajudar; (b) pedido explícito de humano E dúvida já descrita; (c) caso sensível/urgente.',
    '- NUNCA prometa encaminhar/transferir na primeira mensagem sobre um assunto — tente ajudar primeiro.',
    '- Insulto sem pedido de humano: responda com calma; shouldEscalate=false.',
    '- Se pedir para fechar/encerrar o atendimento: despedida curta; não escale.',
  );
  return lines.join('\n');
}

export function buildWebChatThreadContext(messages: WebChatMessageRow[]): string {
  return messages
    .filter(m => m.direction === 'inbound')
    .map(m => m.body.trim())
    .filter(Boolean)
    .slice(-4)
    .join(' ');
}

export function textLooksLikeWebChatInquiry(text: string): boolean {
  const t = text.trim();
  if (!t || t.includes('@')) return false;
  if (/^(oi|ola|olá|bom dia|boa tarde|boa noite|hey|hello)$/i.test(t)) return false;
  if (/^(sim|nao|não|s|ss|ok|isso)$/i.test(t)) return false;
  if (VAGUE_DEPARTMENT_ONLY.test(t) && !INQUIRY_HINT.test(t)) return false;
  if (INQUIRY_HINT.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 5 && t.length >= 24;
}

export function textLooksLikeWebChatProblem(text: string): boolean {
  const t = text.trim();
  if (!textLooksLikeWebChatInquiry(t)) return false;
  if (COMMERCIAL_HINT.test(t) && !PROBLEM_HINT.test(t)) return false;
  if (VAGUE_DEPARTMENT_ONLY.test(t) && !PROBLEM_HINT.test(t)) return false;
  if (PROBLEM_HINT.test(t)) return true;
  const words = t.split(/\s+/).filter(Boolean);
  return words.length >= 4 && t.length >= 16;
}

export function isVagueHumanTransferRequest(text: string): boolean {
  const esc = AiEscalationService.getInstance();
  if (!esc.clientRequestsHuman(text)) return false;
  if (textLooksLikeWebChatInquiry(text)) return false;
  return text.trim().length < 90;
}

export function botAttemptedHelp(messages: WebChatMessageRow[]): boolean {
  const outbound = messages.filter(m => m.direction === 'outbound');
  if (outbound.length === 0) return false;
  return outbound.some(m =>
    /Isso ajudou a resolver|ainda precisar falar com um atendente/i.test(m.body),
  );
}

export function clientStillNeedsHumanAfterHelp(text: string, lastBotReply?: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (STILL_NEEDS_HUMAN.test(t)) return true;
  if (lastBotReply && /ainda (?:precisa|quer)|falar com um atendente/i.test(lastBotReply)) {
    return /^(sim|quero|preciso|ainda)/i.test(t);
  }
  return false;
}

export function clientConfirmedResolved(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || STILL_NEEDS_HUMAN.test(t)) return false;
  return RESOLVED_CONFIRM.test(t);
}

export function lastBotReplyBody(messages: WebChatMessageRow[]): string | undefined {
  const row = [...messages].reverse().find(m => m.direction === 'outbound');
  return row?.body;
}

export function isInsultWithoutHumanRequest(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/\b(burr[aá]?|idiot|imbecil|inutil|inútil|porcaria|lixo|horrivel|horrível|p[eé]ssim|ot[aá]ri)\b/i.test(t)) {
    if (/\b(quero|preciso|falar com).{0,20}(atendente|humano|pessoa)\b/i.test(t)) return false;
    return true;
  }
  return false;
}

export function resolveWebChatShouldEscalate(opts: {
  clientText: string;
  modelWantsEscalate: boolean;
  modelReply: string;
  messages: WebChatMessageRow[];
}): boolean {
  const esc = AiEscalationService.getInstance();
  const text = opts.clientText.trim();
  const lastBot = lastBotReplyBody(opts.messages);

  if (!text) return false;
  if (clientConfirmedResolved(text)) return false;
  if (isInsultWithoutHumanRequest(text)) return false;

  if (lastBot && /Isso ajudou a resolver|ainda precisar falar com um atendente/i.test(lastBot)) {
    if (clientStillNeedsHumanAfterHelp(text, lastBot)) return true;
    if (clientConfirmedResolved(text)) return false;
  }

  if (isVagueHumanTransferRequest(text)) return false;

  const inboundInquiries = opts.messages.filter(
    m => m.direction === 'inbound' && textLooksLikeWebChatInquiry(m.body),
  );
  const triedHelp = botAttemptedHelp(opts.messages);

  if (!triedHelp) return false;

  if (esc.clientRequestsHuman(text)) {
    if (textLooksLikeWebChatInquiry(text)) return true;
    return inboundInquiries.length > 0;
  }

  if (opts.modelWantsEscalate || esc.aiReplyPromisesTransfer(opts.modelReply)) {
    return inboundInquiries.length > 0;
  }

  return false;
}

export function formatWebChatAutoResolveReply(reply: string): string {
  return `${reply.trim()}\n\nIsso ajudou a resolver? Se ainda precisar falar com um atendente humano, é só me avisar.`;
}

export function rewritePrematureTransferReply(
  clientText: string,
  visitorName?: string,
): string {
  const first = visitorName?.trim().split(/\s+/)[0];
  const prefix = first ? `${first}, ` : '';
  if (COMMERCIAL_HINT.test(clientText)) {
    return `${prefix}entendi! Para te passar as informações certas sobre produtos e promoções, pode me dizer qual produto ou serviço você tem interesse? Assim consigo te ajudar melhor.`;
  }
  if (/\b(suporte|t[eé]cnico|atendente)\b/i.test(clientText)) {
    return `${prefix}claro! Pode me adiantar sobre o que você gostaria de tratar com o suporte? Assim já verifico se consigo te orientar por aqui.`;
  }
  return `${prefix}pode me contar um pouco mais sobre o que você precisa? Assim consigo te ajudar melhor antes de encaminhar para a equipe.`;
}

