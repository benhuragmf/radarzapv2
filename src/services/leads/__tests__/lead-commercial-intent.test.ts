import { hasCommercialLeadIntent } from '../lead-commercial-intent.util';

describe('hasCommercialLeadIntent', () => {
  it('detecta pedido de orçamento via classificador', () => {
    expect(hasCommercialLeadIntent('Quero um orçamento para instalação')).toBe(true);
  });

  it('ignora saudação simples', () => {
    expect(hasCommercialLeadIntent('Oi')).toBe(false);
    expect(hasCommercialLeadIntent('Bom dia')).toBe(false);
  });

  it('detecta interesse comercial explícito', () => {
    expect(hasCommercialLeadIntent('Tenho interesse no plano premium')).toBe(true);
  });

  it('ignora mensagem curta sem intenção', () => {
    expect(hasCommercialLeadIntent('ok')).toBe(false);
  });

  it('não confunde financeiro com comercial', () => {
    expect(hasCommercialLeadIntent('preciso da segunda via do boleto')).toBe(false);
  });

  it('detecta comercial via classificador local', () => {
    expect(hasCommercialLeadIntent('quero saber o preço do plano premium')).toBe(true);
  });

  it('detecta frase extra não classificada como comercial isolada', () => {
    expect(hasCommercialLeadIntent('Preciso de uma demonstração do sistema')).toBe(true);
  });
});
