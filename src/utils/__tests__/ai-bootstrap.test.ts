import {
  buildBootstrapPrompt,
  truncateBootstrapText,
  AI_BOOTSTRAP_MAX_CHARS_TOTAL,
} from '@/utils/ai-bootstrap';

describe('ai-bootstrap', () => {
  it('trunca seção longa', () => {
    const long = 'a'.repeat(5000);
    const out = truncateBootstrapText(long, 100);
    expect(out.length).toBeLessThanOrEqual(100);
    expect(out).toContain('truncado');
  });

  it('respeita limite total do workspace', () => {
    const block = buildBootstrapPrompt(
      Array.from({ length: 20 }, (_, i) => ({
        key: `s${i}`,
        title: `SEC${i}`,
        content: 'x'.repeat(3000),
      })),
    );
    expect(block.length).toBeLessThanOrEqual(AI_BOOTSTRAP_MAX_CHARS_TOTAL + 200);
  });
});
