import { applyQuickReplyTemplate, expandQuickReply, normalizeQuickReplies } from '@/types/inbox-quick-replies';

describe('inbox quick replies', () => {
  it('substitui [user] pelo primeiro nome', () => {
    expect(applyQuickReplyTemplate('Olá [user], bom dia!', 'Maria Silva')).toBe(
      'Olá Maria, bom dia!',
    );
  });

  it('expande atalho /bd', () => {
    const replies = normalizeQuickReplies([
      { code: 'bd', label: 'Bom dia', template: 'Olá [user], bom dia!' },
    ]);
    expect(expandQuickReply('/bd', replies, 'João')).toBe('Olá João, bom dia!');
  });

  it('mantém texto extra após o código', () => {
    const replies = normalizeQuickReplies([
      { code: 'ag', label: 'Aguarde', template: 'Aguarde um instante.' },
    ]);
    expect(expandQuickReply('/ag Já volto', replies, 'Ana')).toBe('Aguarde um instante.\nJá volto');
  });

  it('usa defaults quando lista vazia', () => {
    const replies = normalizeQuickReplies([]);
    expect(replies.some(q => q.code === 'ticket')).toBe(true);
  });
});
