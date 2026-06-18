import { shouldSendProactiveGreeting } from '../webchat-proactive.util';

describe('shouldSendProactiveGreeting', () => {
  const base = {
    proactiveGreetingEnabled: true,
    proactiveGreetingMessage: 'Olá! Estou por aqui caso precise de ajuda 😊',
    businessHoursEnabled: false,
    isOnline: true,
    proactiveGreetingSentAt: null,
    hasVisitorInbound: false,
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

  it('não envia fora do horário quando horário comercial ativo', () => {
    expect(
      shouldSendProactiveGreeting({
        ...base,
        businessHoursEnabled: true,
        isOnline: false,
      }),
    ).toBe(false);
  });
});
