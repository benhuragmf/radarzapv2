import { hasCommercialLeadIntent } from '../lead-commercial-intent.util';

describe('hasCommercialLeadIntent', () => {
  it('detecta pedido de orçamento', () => {
    expect(hasCommercialLeadIntent('Quero um orçamento para instalação')).toBe(true);
  });

  it('ignora saudação simples', () => {
    expect(hasCommercialLeadIntent('Oi')).toBe(false);
    expect(hasCommercialLeadIntent('Bom dia')).toBe(false);
  });

  it('detecta interesse comercial', () => {
    expect(hasCommercialLeadIntent('Tenho interesse no plano premium')).toBe(true);
  });

  it('ignora mensagem curta sem intenção', () => {
    expect(hasCommercialLeadIntent('ok')).toBe(false);
  });
});
