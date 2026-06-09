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
});
