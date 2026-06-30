import {
  AI_KB_DEFAULT_CATEGORY,
  AiKnowledgeBaseService,
  normalizeKbCategory,
} from '@/services/ai/AiKnowledgeBaseService';

describe('AiKnowledgeBaseService FAQ catalog helpers', () => {
  it('normalizeKbCategory usa Geral quando vazio', () => {
    expect(normalizeKbCategory('')).toBe(AI_KB_DEFAULT_CATEGORY);
    expect(normalizeKbCategory('  Planos  ')).toBe('Planos');
  });

  it('inclui categoria e links no contexto usado pelo prompt', () => {
    const svc = AiKnowledgeBaseService.getInstance() as unknown as {
      formatContextRow: (row: {
        title: string;
        content: string;
        category?: string;
        links?: Array<{ label: string; url: string; openInNewTab?: boolean }>;
      }) => string;
    };

    const block = svc.formatContextRow({
      title: 'Produto Pro',
      category: 'Produtos e estoque',
      content: 'Valor atual: R$ 149,90',
      links: [{ label: 'Comprar agora', url: 'https://loja.exemplo/pro' }],
    });

    expect(block).toContain('Categoria: Produtos e estoque');
    expect(block).toContain('Comprar agora: https://loja.exemplo/pro');
  });
});
