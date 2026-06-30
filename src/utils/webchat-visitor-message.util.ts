export const WEBCHAT_INTAKE_SYSTEM_PREFIX = '📋 Dados do visitante';

/** Mensagens de sistema visíveis só para a equipe — não exibir no widget do visitante. */
export function isVisitorHiddenSystemMessage(msg: { direction: string; body: string }): boolean {
  if (msg.direction !== 'system') return false;
  const body = msg.body.trim();
  if (body.startsWith(WEBCHAT_INTAKE_SYSTEM_PREFIX)) return true;
  if (/^Prioridade para .+ — aguardando aceite no painel\.$/.test(body)) return true;
  if (body === 'Nenhum atendente online no painel — fila aberta para a equipe assumir.') {
    return true;
  }
  return false;
}

/** Mensagem visível no widget/API pública do visitante (exclui chat interno da equipe). */
export function isVisitorVisibleWebChatMessage(msg: { direction: string; body: string }): boolean {
  if (msg.direction === 'internal') return false;
  return !isVisitorHiddenSystemMessage(msg);
}

/** Oculta na consulta pública TK+token (mesmas regras do widget + ops internas). */
export function isPublicTicketLookupHiddenMessage(msg: { direction: string; body: string }): boolean {
  if (isVisitorHiddenSystemMessage(msg)) return true;
  const body = msg.body.trim();
  if (/Bridge WhatsApp ativo/i.test(body)) return true;
  return false;
}
