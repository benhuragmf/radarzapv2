import {
  ConsentStatus,
  canReplyToConsentPrompt,
  parseConsentReply,
  parseOptOutConfirm,
} from '@/types/consent';

describe('consent reply parsing', () => {
  it('aceita 1 e aceito', () => {
    expect(parseConsentReply('1')).toBe('accept');
    expect(parseConsentReply('aceito')).toBe('accept');
    expect(parseConsentReply('  ACEITO  ')).toBe('accept');
  });

  it('recusa 2 e recuso', () => {
    expect(parseConsentReply('2')).toBe('refuse');
    expect(parseConsentReply('recuso')).toBe('refuse');
  });

  it('ignora texto aleatório', () => {
    expect(parseConsentReply('olá')).toBeNull();
    expect(parseConsentReply('')).toBeNull();
  });

  it('canReplyToConsentPrompt só em PENDING', () => {
    expect(canReplyToConsentPrompt(ConsentStatus.PENDING)).toBe(true);
    expect(canReplyToConsentPrompt(ConsentStatus.ACCEPTED)).toBe(false);
  });

  it('opt-out confirm não usa sim/ok (evita colisão com triagem IA)', () => {
    expect(parseOptOutConfirm('sim')).toBe(false);
    expect(parseOptOutConfirm('ok')).toBe(false);
    expect(parseOptOutConfirm('sair')).toBe(true);
    expect(parseOptOutConfirm('confirmo')).toBe(true);
  });
});
