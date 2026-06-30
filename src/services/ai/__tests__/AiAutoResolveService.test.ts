import { AiAutoResolveService } from '../AiAutoResolveService';
import { scoreAiTextMatch, AI_AUTO_RESOLVE_MIN_SCORE } from '@/utils/ai-text-match';

/**
 * Testes de lógica de auto-resolve (sem DB) — espelham critérios de AiAutoResolveService + KB/skill match.
 */
describe('AiAutoResolveService logic', () => {
  const kbItems = [
    {
      title: 'Rastreador sem conexão no app',
      content: 'Reinicie o equipamento, verifique APN e credenciais do app Radar.',
      active: true,
    },
    {
      title: 'Fatura em atraso',
      content: 'Acesse o portal e regularize o pagamento para reativar o serviço.',
      active: true,
    },
  ];

  function bestKbMatch(query: string) {
    let best = { score: 0, item: kbItems[0] };
    for (const item of kbItems) {
      const score = scoreAiTextMatch(query, item.title, item.content);
      if (score > best.score) best = { score, item };
    }
    return best.score >= AI_AUTO_RESOLVE_MIN_SCORE ? best : null;
  }

  it('resolve problema de rastreador via KB', () => {
    const match = bestKbMatch('meu rastreador não conecta no aplicativo');
    expect(match).not.toBeNull();
    expect(match?.item.title).toContain('Rastreador');
  });

  it('não resolve saudação genérica', () => {
    expect(bestKbMatch('oi')).toBeNull();
  });

  it('shouldAttemptAutoResolve bloqueia plano/VIP e confirmações curtas', () => {
    const svc = AiAutoResolveService.getInstance();
    expect(
      svc.shouldAttemptAutoResolve('Preciso saber se meu plano dá acesso vip na sala de jogos'),
    ).toBe(false);
    expect(svc.shouldAttemptAutoResolve('Rastreador')).toBe(false);
    expect(svc.shouldAttemptAutoResolve('é sim rastreador o nome', 'plano vip sala de jogos')).toBe(
      false,
    );
    expect(svc.shouldAttemptAutoResolve('sim')).toBe(false);
    expect(svc.shouldAttemptAutoResolve('s')).toBe(false);
    expect(
      svc.shouldAttemptAutoResolve('meu rastreador não conecta no aplicativo'),
    ).toBe(true);
  });
  it('anexa links uteis quando responde por artigo da base', () => {
    const svc = AiAutoResolveService.getInstance() as unknown as {
      formatReply: (
        body: string,
        title: string,
        links?: Array<{ label: string; url: string }>,
      ) => string;
    };

    const reply = svc.formatReply('Valor atual: R$ 149,90', 'Produto Pro', [
      { label: 'Comprar agora', url: 'https://loja.exemplo/pro' },
    ]);

    expect(reply).toContain('Valor atual: R$ 149,90');
    expect(reply).toContain('Comprar agora: https://loja.exemplo/pro');
  });

  it('formatReply ignora links inseguros ou sem rotulo', () => {
    const svc = AiAutoResolveService.getInstance() as unknown as {
      formatReply: (
        body: string,
        title: string,
        links?: Array<{ label: string; url: string }>,
      ) => string;
    };

    const reply = svc.formatReply('Conteudo', 'Titulo', [
      { label: '', url: 'https://ok.exemplo' },
      { label: 'Malicioso', url: 'javascript:alert(1)' },
      { label: 'Valido', url: 'https://loja.exemplo/item' },
    ]);

    expect(reply).not.toContain('javascript:');
    expect(reply).toContain('Valido: https://loja.exemplo/item');
  });
});
