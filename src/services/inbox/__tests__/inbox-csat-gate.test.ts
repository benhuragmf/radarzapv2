import {
  isCsatIntent,
  parseCsatScore,
  shouldBypassCsatForNewService,
} from '../csat.util';

/**
 * Matriz de decisão CSAT × novo atendimento (Fase 1 estabilização).
 * Espelha regras de tryHandleCsatReply antes de abrir Inbox.
 */
describe('inbox CSAT gate (estabilização)', () => {
  it('nota 1-5 nunca é bypass de novo atendimento', () => {
    for (const score of ['1', '2', '3', '4', '5']) {
      expect(parseCsatScore(score)).not.toBeNull();
      expect(shouldBypassCsatForNewService(score)).toBe(false);
    }
  });

  it('pedido explícito de avaliação permanece no fluxo CSAT', () => {
    expect(isCsatIntent('avaliar')).toBe(true);
    expect(shouldBypassCsatForNewService('avaliar')).toBe(false);
  });

  it('saudações e pedidos de atendimento liberam inbox', () => {
    const cases = [
      'Ola',
      'gostaria de atendimento',
      'falar com atendente',
      'preciso de ajuda',
      'novo atendimento',
    ];
    for (const text of cases) {
      expect(shouldBypassCsatForNewService(text)).toBe(true);
    }
  });

  it('texto genérico fora de CSAT não é bypass automático', () => {
    expect(shouldBypassCsatForNewService('ok obrigado')).toBe(false);
    expect(shouldBypassCsatForNewService('')).toBe(false);
  });
});
