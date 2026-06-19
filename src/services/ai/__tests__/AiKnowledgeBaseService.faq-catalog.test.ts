import { AI_KB_DEFAULT_CATEGORY, normalizeKbCategory } from '@/services/ai/AiKnowledgeBaseService';

describe('AiKnowledgeBaseService FAQ catalog helpers', () => {
  it('normalizeKbCategory usa Geral quando vazio', () => {
    expect(normalizeKbCategory('')).toBe(AI_KB_DEFAULT_CATEGORY);
    expect(normalizeKbCategory('  Planos  ')).toBe('Planos');
  });
});
