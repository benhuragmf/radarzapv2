import {
  buildCatalogAddressRetryReply,
  buildCatalogCancelReply,
  buildCatalogCepOfferReply,
  buildCatalogHumanEscalationReply,
  buildCatalogMediaInFlowReply,
  catalogOrderInboxTitle,
  detectCatalogCancelRequest,
  detectCatalogCepOfferQuestion,
  detectCatalogExitRequest,
  detectCatalogHumanEscalationRequest,
  isCatalogGreetingOnly,
  mentionsCatalogResumeIntent,
  shouldIgnoreStaleCatalogRecovery,
} from '@/types/catalog-sales';

describe('catalog flow commands 2.17.59', () => {
  it('detecta pedido de atendente humano', () => {
    expect(detectCatalogHumanEscalationRequest('Falar com atendente')).toBe(true);
    expect(detectCatalogHumanEscalationRequest('quero humano')).toBe(true);
  });

  it('detecta cancelar e sair', () => {
    expect(detectCatalogCancelRequest('Cancelar')).toBe(true);
    expect(detectCatalogExitRequest('Sair')).toBe(true);
  });

  it('detecta pergunta sobre enviar CEP', () => {
    expect(detectCatalogCepOfferQuestion('Posso te enviar o cep?')).toBe(true);
  });

  it('monta respostas de fluxo', () => {
    expect(buildCatalogCepOfferReply()).toMatch(/CEP/i);
    expect(buildCatalogHumanEscalationReply()).toMatch(/atendente/i);
    expect(buildCatalogCancelReply()).toMatch(/cancelei/i);
  });

  it('áudio no catálogo pede texto', () => {
    const msg = buildCatalogMediaInFlowReply({
      productName: 'Zaad',
      awaitingFulfillment: true,
      mediaKind: 'audio',
    });
    expect(msg).toMatch(/áudio/i);
    expect(msg).toMatch(/retirar|entrega/i);
  });

  it('anti-loop endereço escala após 3 tentativas', () => {
    expect(buildCatalogAddressRetryReply({ attempt: 3 })).toMatch(/atendente/i);
    expect(buildCatalogAddressRetryReply({ attempt: 2 })).toMatch(/CEP/i);
  });

  it('saudação não retoma pedido stale', () => {
    const stale = {
      status: 'aguardando_endereco' as const,
      updatedAt: new Date(Date.now() - 100 * 60 * 60 * 1000),
    };
    expect(isCatalogGreetingOnly('Olá boa tarde')).toBe(true);
    expect(mentionsCatalogResumeIntent('continuar pedido')).toBe(true);
    expect(shouldIgnoreStaleCatalogRecovery('Olá boa tarde', stale)).toBe(true);
    expect(shouldIgnoreStaleCatalogRecovery('continuar pedido', stale)).toBe(false);
  });

  it('título do Inbox por status', () => {
    expect(catalogOrderInboxTitle('aguardando_endereco')).toMatch(/endereço/i);
    expect(catalogOrderInboxTitle('aguardando_pagamento')).toMatch(/pagamento/i);
    expect(catalogOrderInboxTitle('comprovante_recebido')).toMatch(/Comprovante/i);
  });
});
