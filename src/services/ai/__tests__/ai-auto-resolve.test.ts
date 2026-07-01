import { AiAutoResolveService } from '@/services/ai/AiAutoResolveService';

describe('AiAutoResolveService purchase guard', () => {
  const svc = AiAutoResolveService.getInstance();

  it('não tenta auto-resolve em intenção de compra', () => {
    expect(
      svc.shouldAttemptAutoResolve('gostaria de comprar um zaad voce tem?'),
    ).toBe(false);
  });

  it('mantém auto-resolve em problema técnico longo', () => {
    expect(
      svc.shouldAttemptAutoResolve(
        'meu rastreador parou de conectar no aplicativo desde ontem',
      ),
    ).toBe(true);
  });
});
