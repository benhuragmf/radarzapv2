import {
  DEFAULT_INBOUND_REGISTRATION_POLICY,
  normalizeInboundRegistrationPolicy,
  resolveChannelRegistration,
  resolveFormRegistration,
  resolveManualRegistration,
} from '@/types/inbound-registration-policy';

describe('inbound-registration-policy', () => {
  it('normaliza valores inválidos para defaults', () => {
    expect(
      normalizeInboundRegistrationPolicy({ whatsapp: 'invalid' as never, form: 'x' as never }),
    ).toEqual(DEFAULT_INBOUND_REGISTRATION_POLICY);
  });

  it('whatsapp contact — CRM aprovado, sem lead automático', () => {
    const policy = normalizeInboundRegistrationPolicy({ whatsapp: 'contact' });
    const actions = resolveChannelRegistration(policy, 'whatsapp', { isReturn: false });
    expect(actions.createCrmContact).toBe(true);
    expect(actions.crmStatus).toBe('approved');
    expect(actions.createLead).toBe(false);
    expect(actions.tagAtendimento).toBe(true);
  });

  it('webchat conversation_only — só técnico', () => {
    const policy = normalizeInboundRegistrationPolicy({ webchat: 'conversation_only' });
    const actions = resolveChannelRegistration(policy, 'webchat', { isReturn: false });
    expect(actions.createCrmContact).toBe(false);
    expect(actions.crmStatus).toBe('inbox_only');
    expect(actions.createLead).toBe(false);
  });

  it('retorno return_lead — lead sem CRM', () => {
    const policy = normalizeInboundRegistrationPolicy({ returnCustomer: 'return_lead' });
    const actions = resolveChannelRegistration(policy, 'whatsapp', { isReturn: true });
    expect(actions.createLead).toBe(true);
    expect(actions.createCrmContact).toBe(false);
  });

  it('retorno existing_contact — sem lead automático', () => {
    const policy = normalizeInboundRegistrationPolicy({ returnCustomer: 'existing_contact' });
    const actions = resolveChannelRegistration(policy, 'webchat', { isReturn: true });
    expect(actions.createLead).toBe(false);
  });

  it('form pending — contato pendente + lead', () => {
    const policy = normalizeInboundRegistrationPolicy({ form: 'pending' });
    const form = resolveFormRegistration(policy);
    expect(form.crmStatus).toBe('pending');
    expect(form.createLead).toBe(true);
    expect(form.createCrmContact).toBe(true);
  });

  it('manual — contato aprovado', () => {
    const manual = resolveManualRegistration();
    expect(manual.crmStatus).toBe('approved');
    expect(manual.createCrmContact).toBe(true);
  });
});
