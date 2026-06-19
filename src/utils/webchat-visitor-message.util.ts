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
