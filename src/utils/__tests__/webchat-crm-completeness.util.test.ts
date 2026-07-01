import {
  evaluateWebChatCrmCompleteness,
  hasValidWebChatCrmPhone,
  resolveWebChatVisitorPhone,
} from '@/utils/webchat-crm-completeness.util';

describe('webchat-crm-completeness.util', () => {
  it('resolve telefone do intake', () => {
    expect(resolveWebChatVisitorPhone(undefined, { phone: '11999998888' })).toBe('11999998888');
    expect(resolveWebChatVisitorPhone('+5511999998888', { phone: 'x' })).toBe('+5511999998888');
  });

  it('valida E.164 BR', () => {
    expect(hasValidWebChatCrmPhone('11999998888')).toBe(true);
    expect(hasValidWebChatCrmPhone('abc')).toBe(false);
    expect(hasValidWebChatCrmPhone('')).toBe(false);
  });

  it('marca incompleto sem telefone', () => {
    const r = evaluateWebChatCrmCompleteness({
      visitorIntake: { name: 'Ana' },
    });
    expect(r.crmIncomplete).toBe(true);
    expect(r.crmIncompleteReason).toBe('missing_phone');
  });

  it('marca incompleto com telefone mas sem destination', () => {
    const r = evaluateWebChatCrmCompleteness({
      visitorPhone: '+5511999998888',
    });
    expect(r.crmIncomplete).toBe(true);
    expect(r.crmIncompleteReason).toBe('no_destination');
  });

  it('marca completo com telefone e CRM aprovado', () => {
    const r = evaluateWebChatCrmCompleteness({
      visitorPhone: '+5511999998888',
      destinationId: '507f1f77bcf86cd799439011',
      crmRegistrationStatus: 'approved',
    });
    expect(r.crmIncomplete).toBe(false);
  });

  it('marca inbox_only', () => {
    const r = evaluateWebChatCrmCompleteness({
      visitorPhone: '+5511999998888',
      destinationId: '507f1f77bcf86cd799439011',
      crmRegistrationStatus: 'inbox_only',
    });
    expect(r.crmIncompleteReason).toBe('inbox_only');
  });
});
