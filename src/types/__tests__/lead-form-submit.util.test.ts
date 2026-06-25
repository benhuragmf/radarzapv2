import {
  assertPublicLeadConsent,
  assertPublicLeadHoneypot,
  buildPublicLeadSubmitResponse,
  parseLeadFormCustomFieldValues,
  parseLeadFormUtm,
  validateAndParsePublicLeadPayload,
} from '@/types/lead-form-submit.util';
import type { LeadFormCustomField } from '@/types/lead-form';

describe('lead-form-submit.util', () => {
  const baseAppearance = {
    requireConsent: false,
    requireEmail: false,
    requireMessage: false,
    honeypot: true,
  };

  it('honeypot preenchido rejeita envio', () => {
    expect(() => assertPublicLeadHoneypot(true, 'bot')).toThrow(/rejeitado/);
    expect(() => assertPublicLeadHoneypot(true, undefined)).not.toThrow();
  });

  it('consentimento obrigatório não marcado falha', () => {
    expect(() => assertPublicLeadConsent(true, false)).toThrow(/consentimento/);
    expect(() => assertPublicLeadConsent(true, true)).not.toThrow();
  });

  it('exige telefone ou e-mail', () => {
    expect(() =>
      validateAndParsePublicLeadPayload({ name: 'Ana' }, baseAppearance),
    ).toThrow(/telefone ou e-mail/);
  });

  it('nome obrigatório', () => {
    expect(() =>
      validateAndParsePublicLeadPayload({ phone: '11999998888' }, baseAppearance),
    ).toThrow(/Nome/);
  });

  it('normaliza telefone e preserva e-mail', () => {
    const parsed = validateAndParsePublicLeadPayload(
      { name: 'João', phone: '11999998888', email: 'joao@test.com' },
      baseAppearance,
    );
    expect(parsed.phoneE164).toMatch(/^\+55/);
    expect(parsed.email).toBe('joao@test.com');
  });

  it('aceita só e-mail com phoneE164 email: prefix', () => {
    const parsed = validateAndParsePublicLeadPayload(
      { name: 'Maria', email: 'maria@test.com' },
      baseAppearance,
    );
    expect(parsed.phoneE164).toBe('email:maria@test.com');
  });

  it('parseLeadFormUtm sanitiza e limita campos', () => {
    const utm = parseLeadFormUtm({
      source: 'google',
      medium: 'cpc',
      campaign: 'promo',
      term: 'x',
      content: 'y',
    });
    expect(utm).toEqual({
      source: 'google',
      medium: 'cpc',
      campaign: 'promo',
      term: 'x',
      content: 'y',
    });
    expect(parseLeadFormUtm({})).toBeUndefined();
  });

  it('campo custom obrigatório vazio falha', () => {
    const defs: LeadFormCustomField[] = [
      { id: 'cf_abc12345', label: 'Empresa', type: 'text', required: true },
    ];
    expect(() => parseLeadFormCustomFieldValues(defs, {})).toThrow(/Empresa/);
    expect(parseLeadFormCustomFieldValues(defs, { cf_abc12345: 'ACME' })).toEqual({
      Empresa: 'ACME',
    });
  });

  it('texto muito grande é truncado', () => {
    const parsed = validateAndParsePublicLeadPayload(
      { name: 'A', phone: '11999998888', message: 'x'.repeat(3000) },
      baseAppearance,
    );
    expect(parsed.message.length).toBe(2000);
  });

  it('resposta pública não expõe IDs internos', () => {
    const res = buildPublicLeadSubmitResponse({
      successMessage: 'Recebemos seu contato.',
      redirectUrl: 'https://site.com/obrigado',
    });
    expect(res).toEqual({
      success: true,
      successMessage: 'Recebemos seu contato.',
      redirectUrl: 'https://site.com/obrigado',
    });
    expect(res).not.toHaveProperty('captureId');
    expect(res).not.toHaveProperty('leadId');
    expect(res).not.toHaveProperty('clientId');
  });
});
