import {
  looksLikePurchaseInquiry,
  resolveClientFirstName,
  sanitizeKnowledgeBaseContentForClient,
  textLooksLikeGreetingOrNonName,
} from '@/utils/ai-kb-client.util';

describe('ai-kb-client.util', () => {
  it('remove linha interna da KB', () => {
    const raw = [
      'Produto: ZAAd',
      'Valor atual: 150',
      'Regra para a IA: nunca confirme pagamento só com imagem.',
    ].join('\n');
    expect(sanitizeKnowledgeBaseContentForClient(raw)).toBe(
      'Produto: ZAAd\nValor atual: 150',
    );
  });

  it('rejeita cumprimento como nome', () => {
    expect(textLooksLikeGreetingOrNonName('ola bom dia')).toBe(true);
    expect(textLooksLikeGreetingOrNonName('Benhurt')).toBe(false);
  });

  it('corrige nome duplicado', () => {
    expect(resolveClientFirstName('BenhurtBenhurt')).toBe('Benhurt');
    expect(resolveClientFirstName('Maria Silva')).toBe('Maria');
  });

  it('detecta intenção de compra', () => {
    expect(looksLikePurchaseInquiry('gostaria de comprar um zaad')).toBe(true);
    expect(looksLikePurchaseInquiry('rastreador não conecta no app')).toBe(false);
  });
});
