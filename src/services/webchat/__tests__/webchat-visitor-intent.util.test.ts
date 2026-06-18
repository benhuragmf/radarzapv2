import {
  visitorRefusesHumanHandoff,
  visitorWantsToCloseChat,
} from '../webchat-visitor-intent.util';
import { isInsultWithoutHumanRequest } from '../webchat-ai-triage.util';

describe('webchat-visitor-intent.util', () => {
  it('detecta pedido de encerrar atendimento', () => {
    expect(visitorWantsToCloseChat('pode fechar esse atendimento')).toBe(true);
    expect(visitorWantsToCloseChat('quero encerrar a conversa')).toBe(true);
    expect(visitorWantsToCloseChat('meu rastreador parou')).toBe(false);
  });

  it('detecta recusa de humano apos escalacao', () => {
    expect(
      visitorRefusesHumanHandoff('não', [
        { direction: 'system', body: 'A IA identificou que um atendente humano deve assumir.' },
        { direction: 'inbound', body: 'não' },
      ]),
    ).toBe(true);
    expect(visitorRefusesHumanHandoff('não', [{ direction: 'inbound', body: 'não' }])).toBe(false);
  });

  it('nao escala insulto sem pedido de humano', () => {
    expect(isInsultWithoutHumanRequest('você é muito burra')).toBe(true);
    expect(isInsultWithoutHumanRequest('quero falar com um atendente, burro')).toBe(false);
  });
});
