import { buildContactClassification } from '@/utils/contact-classification.util';

describe('contact classification — waRegistrationStatus', () => {
  const base = {
    _id: 'abc',
    type: 'contact' as const,
    identifier: '+5511999999999',
    name: 'Test',
    consentStatus: 'ACCEPTED',
    consent: { granted: true },
  };

  it('bloqueia campanha quando pendente de validação WhatsApp', () => {
    const c = buildContactClassification({ ...base, waRegistrationStatus: 'pending' });
    expect(c.campaignSelectable).toBe(false);
    expect(c.sendBlockReason).toMatch(/validação/i);
    expect(c.phoneQuality).toBe('attention');
  });

  it('bloqueia campanha quando número não está no WhatsApp', () => {
    const c = buildContactClassification({ ...base, waRegistrationStatus: 'not_on_whatsapp' });
    expect(c.campaignSelectable).toBe(false);
    expect(c.phoneQuality).toBe('no_whatsapp');
    expect(c.sendBlockReason).toMatch(/não cadastrado no WhatsApp/i);
  });

  it('permite campanha quando verificado no WhatsApp e opt-in', () => {
    const c = buildContactClassification({ ...base, waRegistrationStatus: 'verified' });
    expect(c.campaignSelectable).toBe(true);
    expect(c.phoneQuality).toBe('verified');
  });
});
