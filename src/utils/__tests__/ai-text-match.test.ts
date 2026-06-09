import {
  scoreAiTextMatch,
  AI_AUTO_RESOLVE_MIN_SCORE,
} from '@/utils/ai-text-match';

describe('ai-text-match', () => {
  it('pontua problema de rastreador com artigo da KB', () => {
    const score = scoreAiTextMatch(
      'rastreador carro não conecta aplicativo',
      'Rastreador sem conexão no app',
      'Reinicie o equipamento, verifique APN e credenciais do app Radar.',
    );
    expect(score).toBeGreaterThanOrEqual(AI_AUTO_RESOLVE_MIN_SCORE);
  });

  it('ignora texto muito curto', () => {
    expect(scoreAiTextMatch('oi', 'Título', 'Conteúdo qualquer')).toBe(0);
  });
});
