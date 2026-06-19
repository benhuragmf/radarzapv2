import {
  buildWebChatFaqPickerIntro,
  formatKbSuggestionLabel,
  sanitizeKbSuggestions,
} from '@/utils/webchat-faq-reply.util';

describe('webchat-faq-reply.util', () => {
  it('buildWebChatFaqPickerIntro plural', () => {
    expect(buildWebChatFaqPickerIntro(3)).toContain('3 artigos');
  });

  it('formatKbSuggestionLabel', () => {
    expect(formatKbSuggestionLabel(2, 'Como amar')).toBe('2 — Como amar');
  });

  it('sanitizeKbSuggestions filters invalid', () => {
    expect(
      sanitizeKbSuggestions([
        { id: 'abc', label: 'Ok', index: 1 },
        { id: '', label: 'X', index: 2 },
      ]),
    ).toHaveLength(1);
  });
});
