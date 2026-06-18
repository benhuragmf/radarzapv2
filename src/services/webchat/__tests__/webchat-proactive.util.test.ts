import {
  getProactiveGreetingSkipReason,
  shouldSendProactiveGreeting,
} from '../webchat-proactive.util';

describe('shouldSendProactiveGreeting', () => {
  const base = {
    proactiveGreetingEnabled: true,
    proactiveGreetingMessage: 'Olá! Estou por aqui caso precise de ajuda 😊',
    proactiveGreetingSentAt: null,
    hasVisitorInbound: false,
    outboundCount: 0,
  };

  it('envia quando habilitado e visitante ainda não falou', () => {
    expect(shouldSendProactiveGreeting(base)).toBe(true);
  });

  it('não envia quando desabilitado', () => {
    expect(shouldSendProactiveGreeting({ ...base, proactiveGreetingEnabled: false })).toBe(false);
  });

  it('não envia sem mensagem configurada', () => {
    expect(shouldSendProactiveGreeting({ ...base, proactiveGreetingMessage: '  ' })).toBe(false);
  });

  it('não envia se visitante já mandou mensagem', () => {
    expect(shouldSendProactiveGreeting({ ...base, hasVisitorInbound: true })).toBe(false);
  });

  it('não envia se já foi enviada nesta conversa', () => {
    expect(
      shouldSendProactiveGreeting({ ...base, proactiveGreetingSentAt: new Date().toISOString() }),
    ).toBe(false);
  });

  it('não envia se já há mensagem outbound na conversa', () => {
    expect(shouldSendProactiveGreeting({ ...base, outboundCount: 1 })).toBe(false);
  });

  it('envia fora do horário comercial (saudação proativa não depende de horário)', () => {
    expect(shouldSendProactiveGreeting(base)).toBe(true);
  });
});

describe('getProactiveGreetingSkipReason', () => {
  it('retorna already_sent quando marcado na conversa', () => {
    expect(
      getProactiveGreetingSkipReason({
        proactiveGreetingEnabled: true,
        proactiveGreetingMessage: 'Oi',
        proactiveGreetingSentAt: new Date(),
        hasVisitorInbound: false,
      }),
    ).toBe('already_sent');
  });
});
