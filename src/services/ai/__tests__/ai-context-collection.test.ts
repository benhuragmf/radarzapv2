import { AiContextService } from '../AiContextService';
import type { IAiConversationState } from '@/models/AiConversationState';
import type { IAiPrompt } from '@/models/AiPrompt';

describe('AiContextService — coleta de cadastro', () => {
  const svc = AiContextService.getInstance();

  it('confirma identidade com sim quando há nome no cadastro', () => {
    expect(svc.parseNameConfirmation('sim', 'Benhur Silva')).toEqual({
      confirmed: true,
      name: 'Benhur Silva',
    });
  });

  it('aceita nome informado diretamente', () => {
    expect(svc.parseNameConfirmation('Maria Souza', undefined)).toEqual({
      confirmed: true,
      name: 'Maria Souza',
    });
  });

  it('não confirma só com sim sem cadastro', () => {
    expect(svc.parseNameConfirmation('sim', undefined)).toEqual({ confirmed: false });
  });

  it('detecta negação de identidade', () => {
    expect(svc.parseNameConfirmation('não', 'Benhur')).toEqual({
      confirmed: false,
      denied: true,
    });
  });

  it('extrai nome de frase "meu nome é ... atualize"', () => {
    expect(svc.parseNameConfirmation('MEU NOME É Benhur Monteiro atualize', undefined)).toEqual({
      confirmed: true,
      name: 'Benhur Monteiro',
    });
  });

  it('extrai e-mail do texto', () => {
    expect(svc.emailInText('meu email é ben@test.com')).toBe('ben@test.com');
  });

  it('needsEmailCollection quando falta no estado e no cadastro', () => {
    const state = { collectedEmail: undefined } as IAiConversationState;
    const prompt = { collectEmail: true, skipKnownFields: true } as IAiPrompt;
    expect(
      svc.needsEmailCollection(state, { tags: [], knownFields: { name: true, email: false }, recentTickets: [] }, prompt),
    ).toBe(true);
  });
});
