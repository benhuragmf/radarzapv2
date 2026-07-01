/** Pedidos via IA/catálogo com PIX e conferência humana — RadarChat */

import type { CatalogDeliveryKmRates } from '@/utils/catalog-delivery.util';
import { normalizeKmRates } from '@/utils/catalog-delivery.util';
import {
  enrichCatalogSalesPixFields,
  resolveCatalogPixInstructions,
} from '@/types/catalog-sales-pix';

export {
  buildCatalogPixInstructions,
  enrichCatalogSalesPixFields,
  resolveCatalogPixInstructions,
} from '@/types/catalog-sales-pix';

export const CATALOG_SALES_ORDER_STATUSES = [
  'rascunho',
  'aguardando_endereco',
  'aguardando_pagamento',
  'comprovante_recebido',
  'em_conferencia',
  'pagamento_aprovado',
  'pagamento_recusado',
  'pedido_confirmado',
  'cancelado',
  'falha_notificacao_whatsapp',
  'pendente_configuracao_whatsapp',
  'comprovante_sem_pedido',
] as const;

export type CatalogSalesOrderStatus = (typeof CATALOG_SALES_ORDER_STATUSES)[number];

export type CatalogSalesChannel = 'whatsapp' | 'webchat';

export type CatalogProductSaleMode = 'link' | 'pix' | 'link_or_pix';

export interface CatalogProductSalesMeta {
  /** Este produto pode ser vendido pela IA? */
  aiSellable?: boolean;
  /** Como a IA conduz a venda: só link da loja, só PIX, ou cliente escolhe */
  saleMode?: CatalogProductSaleMode;
  /** Aceita pagamento por PIX? */
  acceptsPix?: boolean;
  /** Usar WhatsApp padrão da empresa para comprovante? */
  useCompanyWhatsapp?: boolean;
  /** WhatsApp específico deste produto (E.164, ex. 5566999999999) */
  productWhatsapp?: string;
  /** Setor/responsável */
  responsibleSector?: string;
  /** Exigir conferência humana para este produto */
  requireHumanReview?: boolean;
  /** Produto sob encomenda */
  madeToOrder?: boolean;
  /** Taxa de entrega (texto livre, ex. R$ 15,00 ou Grátis na região X) */
  deliveryFee?: string;
  /** Exigir endereço de entrega antes do PIX */
  requiresDeliveryAddress?: boolean;
}

export interface CatalogSalesCompanyConfig {
  /** Ativar pedidos via IA/catálogo */
  enabled?: boolean;
  /** Ativar pagamento via PIX */
  pixEnabled?: boolean;
  /** Instruções de PIX (chave, titular, etc.) — legado; use pixKey + pixHolderName */
  pixInstructions?: string;
  /** Chave PIX (CPF/CNPJ, e-mail, telefone ou aleatória) */
  pixKey?: string;
  /** Nome do titular da chave PIX */
  pixHolderName?: string;
  /** Enviar comprovante para WhatsApp interno */
  notifyWhatsapp?: boolean;
  /** Número WhatsApp responsável (E.164) */
  internalWhatsapp?: string;
  /** Nome do responsável ou setor */
  responsibleName?: string;
  /** Mensagem padrão enviada ao responsável (prefixo; dados do pedido são anexados) */
  internalMessageTemplate?: string;
  /** Criar pedido automaticamente quando cliente escolher produto */
  autoCreateOrderOnPurchase?: boolean;
  /** Enviar conversa para atendimento humano após receber comprovante */
  escalateOnProof?: boolean;
  /** Exigir aprovação humana antes de confirmar pagamento */
  requireHumanApproval?: boolean;
  /** Permitir reenvio manual da notificação se falhar */
  allowManualResend?: boolean;
  /** Exigir endereço de entrega nos pedidos PIX (pode ser sobrescrito por produto) */
  requireDeliveryAddress?: boolean;
  /** Instruções gerais de entrega/frete para a IA */
  deliveryInstructions?: string;
  /** Endereço base da empresa para cálculo de distância (origem A) — completo: rua, nº, bairro, CEP, cidade, UF, país */
  deliveryOriginAddress?: string;
  /** Calcular taxa de entrega por distância (km) */
  useDistanceBasedDelivery?: boolean;
  /** Valores por faixa de km (1 a 8) */
  deliveryKmRates?: CatalogDeliveryKmRates;
  /** Sincroniza coleta de endereço no prompt da IA */
  forceCollectAddress?: boolean;
  /** Mensagem automática ao cliente ao aprovar pagamento */
  notifyCustomerOnApprove?: boolean;
  /** Mensagem automática ao cliente ao recusar pagamento */
  notifyCustomerOnReject?: boolean;
  /** Mensagem automática ao pedir novo comprovante */
  notifyCustomerOnRequestNewProof?: boolean;
  customerApproveMessage?: string;
  customerRejectMessage?: string;
  customerRequestNewProofMessage?: string;
  /** Mensagem automática com frete/total calculados pelo sistema */
  customerDeliveryQuoteMessage?: string;
  customerDeliveryQuoteFailedMessage?: string;
  /** Pede rua e número após pin impreciso no WhatsApp */
  customerLocationConfirmMessage?: string;
}

export const DEFAULT_CATALOG_SALES_COMPANY_CONFIG: Required<
  Pick<
    CatalogSalesCompanyConfig,
    | 'enabled'
    | 'pixEnabled'
    | 'notifyWhatsapp'
    | 'autoCreateOrderOnPurchase'
    | 'escalateOnProof'
    | 'requireHumanApproval'
    | 'allowManualResend'
  >
> = {
  enabled: false,
  pixEnabled: false,
  notifyWhatsapp: false,
  autoCreateOrderOnPurchase: true,
  escalateOnProof: true,
  requireHumanApproval: true,
  allowManualResend: true,
};

export const DEFAULT_CATALOG_PRODUCT_SALES_META: Required<
  Pick<
    CatalogProductSalesMeta,
    'aiSellable' | 'acceptsPix' | 'useCompanyWhatsapp' | 'requireHumanReview'
  >
> = {
  aiSellable: true,
  acceptsPix: true,
  useCompanyWhatsapp: true,
  requireHumanReview: true,
};

export interface CatalogSalesProofRecord {
  mediaUrl: string;
  mediaMime?: string;
  mediaType?: string;
  messageId?: string;
  receivedAt: Date;
  /** Hash para deduplicação */
  contentHash?: string;
}

export interface CatalogSalesOrderHistoryEntry {
  at: Date;
  action: string;
  status?: CatalogSalesOrderStatus;
  actorUserId?: string;
  note?: string;
}

export function normalizeCatalogSalesConfig(
  raw?: CatalogSalesCompanyConfig | null,
): CatalogSalesCompanyConfig & typeof DEFAULT_CATALOG_SALES_COMPANY_CONFIG {
  const enriched = enrichCatalogSalesPixFields(raw);
  const pixInstructions = resolveCatalogPixInstructions(enriched);
  return {
    ...DEFAULT_CATALOG_SALES_COMPANY_CONFIG,
    ...enriched,
    pixKey: enriched.pixKey?.trim() ?? '',
    pixHolderName: enriched.pixHolderName?.trim() ?? '',
    pixInstructions,
    internalWhatsapp: raw?.internalWhatsapp?.replace(/\D/g, '') ?? '',
    responsibleName: raw?.responsibleName?.trim() ?? '',
    internalMessageTemplate: raw?.internalMessageTemplate?.trim() ?? '',
    deliveryInstructions: raw?.deliveryInstructions?.trim() ?? '',
    requireDeliveryAddress: raw?.requireDeliveryAddress ?? false,
    deliveryOriginAddress: raw?.deliveryOriginAddress?.trim() ?? '',
    useDistanceBasedDelivery: raw?.useDistanceBasedDelivery ?? false,
    deliveryKmRates: normalizeKmRates(raw?.deliveryKmRates),
    forceCollectAddress: raw?.forceCollectAddress ?? raw?.requireDeliveryAddress ?? false,
    notifyCustomerOnApprove: raw?.notifyCustomerOnApprove !== false,
    notifyCustomerOnReject: raw?.notifyCustomerOnReject !== false,
    notifyCustomerOnRequestNewProof: raw?.notifyCustomerOnRequestNewProof !== false,
    customerApproveMessage: raw?.customerApproveMessage?.trim() ?? '',
    customerRejectMessage: raw?.customerRejectMessage?.trim() ?? '',
    customerRequestNewProofMessage: raw?.customerRequestNewProofMessage?.trim() ?? '',
    customerDeliveryQuoteMessage: raw?.customerDeliveryQuoteMessage?.trim() ?? '',
    customerDeliveryQuoteFailedMessage: raw?.customerDeliveryQuoteFailedMessage?.trim() ?? '',
  };
}

export function normalizeProductSalesMeta(
  raw?: CatalogProductSalesMeta | null,
): CatalogProductSalesMeta & typeof DEFAULT_CATALOG_PRODUCT_SALES_META {
  return {
    ...DEFAULT_CATALOG_PRODUCT_SALES_META,
    ...(raw ?? {}),
    productWhatsapp: raw?.productWhatsapp?.replace(/\D/g, '') || undefined,
    responsibleSector: raw?.responsibleSector?.trim() || undefined,
    madeToOrder: Boolean(raw?.madeToOrder),
    deliveryFee: raw?.deliveryFee?.trim() || undefined,
    requiresDeliveryAddress: raw?.requiresDeliveryAddress ?? false,
    saleMode: raw?.saleMode ?? 'link_or_pix',
  };
}

/** Valida telefone BR com DDI (mín. 12 dígitos com 55). */
export function isValidCatalogSalesPhone(digits: string): boolean {
  const d = digits.replace(/\D/g, '');
  if (!d.startsWith('55')) return false;
  return d.length >= 12 && d.length <= 13;
}

export function parseProductPriceFromContent(content: string): string | null {
  const line = content.split('\n').find(row => row.startsWith('Valor atual:'));
  if (!line) return null;
  const val = line.slice('Valor atual:'.length).trim();
  return val || null;
}

export function parseProductStockFromContent(content: string): string | null {
  const line = content.split('\n').find(row => row.startsWith('Estoque disponível:'));
  if (!line) return null;
  const val = line.slice('Estoque disponível:'.length).trim();
  return val || null;
}

export function parseProductSkuFromContent(content: string): string | null {
  const line = content.split('\n').find(row => row.startsWith('SKU/código:'));
  if (!line) return null;
  const val = line.slice('SKU/código:'.length).trim();
  return val || null;
}

export function parseProductDeliveryFeeFromContent(content: string): string | null {
  const line = content.split('\n').find(row => row.startsWith('Taxa de entrega:'));
  if (!line) return null;
  const val = line.slice('Taxa de entrega:'.length).trim();
  return val || null;
}

/** Modo efetivo: produtos com link e sem saleMode explícito → link_or_pix (não força PIX). */
export function resolveProductSaleMode(
  salesMeta: CatalogProductSalesMeta,
  hasCheckoutLink: boolean,
): CatalogProductSaleMode {
  if (salesMeta.saleMode) return salesMeta.saleMode;
  if (hasCheckoutLink) return 'link_or_pix';
  return 'pix';
}

/** Cliente quer comprar pelo link/loja — não abrir fluxo PIX. */
export function detectLinkPurchaseIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /\b(link|loja|site|checkout|carrinho|comprar pelo site|comprar online|pela loja|no site)\b/i.test(t);
}

/** Cliente quer pagar via PIX / conferência no chat. */
export function detectPixPurchaseIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /\b(pix|comprovante|transferência|transferencia|pagar aqui|pago aqui|pagamento por aqui)\b/i.test(t);
}

export function shouldOpenPixOrderFlow(opts: {
  saleMode: CatalogProductSaleMode;
  clientText: string;
  threadContext?: string;
  structuredWantsOrder?: boolean;
  companyPixEnabled?: boolean;
}): boolean {
  if (opts.saleMode === 'link') return false;
  if (!opts.companyPixEnabled && opts.saleMode !== 'pix') return false;
  if (opts.structuredWantsOrder === true) return true;
  const combined = [opts.threadContext, opts.clientText].filter(Boolean).join(' ');
  if (
    detectDeliveryFulfillmentChoice(opts.clientText) &&
    /\b(comprar|zaad|produto|pedido|gostaria)\b/i.test(combined)
  ) {
    return true;
  }
  if (detectLinkPurchaseIntent(opts.clientText) && !detectPixPurchaseIntent(opts.clientText)) {
    return false;
  }
  if (opts.saleMode === 'pix') return detectPurchaseConfirmation(opts.clientText);
  if (detectPixPurchaseIntent(opts.clientText)) return true;
  return detectPurchaseConfirmation(opts.clientText) && !detectLinkPurchaseIntent(opts.clientText);
}

export function orderRequiresDeliveryAddress(
  companyCfg: CatalogSalesCompanyConfig,
  productMeta: CatalogProductSalesMeta,
): boolean {
  if (productMeta.requiresDeliveryAddress === true) return true;
  if (productMeta.requiresDeliveryAddress === false) return false;
  return companyCfg.requireDeliveryAddress === true;
}

export function buildOrderAmountSummary(subtotal?: string, deliveryFee?: string): string {
  const parts: string[] = [];
  if (subtotal?.trim()) parts.push(`Produto: ${subtotal.trim()}`);
  if (deliveryFee?.trim()) parts.push(`Entrega: ${deliveryFee.trim()}`);
  if (parts.length === 2) return `${parts.join(' + ')} (conferir total com a equipe)`;
  return subtotal?.trim() || deliveryFee?.trim() || '';
}

export function productHasClearPrice(price: string | null | undefined): boolean {
  if (!price?.trim()) return false;
  return /\d/.test(price);
}

export function productStockIsZero(stock: string | null | undefined): boolean {
  if (!stock?.trim()) return false;
  const s = stock.toLowerCase();
  if (s.includes('sob encomenda') || s.includes('encomenda')) return false;
  const m = s.match(/(\d+)/);
  if (!m) return false;
  return parseInt(m[1], 10) === 0;
}

/** Detecta confirmação de compra no texto do cliente. */
export function detectPurchaseConfirmation(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 400) return false;
  return (
    /\b(quero comprar|vou comprar|pode reservar|fechar pedido|confirmo a compra|quero esse|quero este|pode mandar o pix|manda o pix|vou pagar|fechado|compro agora)\b/i.test(
      t,
    ) ||
    /^(sim|ok|pode ser|fechado|confirmo)[\s!.?]*$/i.test(t)
  );
}

/** Cliente escolheu entrega ou retirada após oferta de compra. */
export function detectDeliveryFulfillmentChoice(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 120) return false;
  return (
    /\b(quero que entregue|com entrega|para entregar|por entrega|quero entrega|prefiro entrega|manda entregar|enviar pra mim|enviar para mim|delivery)\b/i.test(
      t,
    ) ||
    /\b(entregue|entrega|envio|enviar|receber em casa)\b/i.test(t) ||
    /\b(retirar|retirada|vou buscar|pegar na loja|buscar na loja)\b/i.test(t)
  );
}

export const DEFAULT_CATALOG_CUSTOMER_APPROVE_MESSAGE =
  '✅ Pagamento confirmado! Pedido: {{productName}}. Nossa equipe segue com o preparo/entrega. Obrigado!';

export const DEFAULT_CATALOG_CUSTOMER_REJECT_MESSAGE =
  'Não foi possível confirmar o comprovante do pedido {{productName}}. {{reason}} Envie um novo comprovante ou fale com nossa equipe.';

export const DEFAULT_CATALOG_CUSTOMER_NEW_PROOF_MESSAGE =
  'Precisamos de um novo comprovante PIX para o pedido {{productName}}. {{reason}} Envie a imagem ou PDF aqui no chat.';

export const DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_MESSAGE =
  '📦 *Resumo do pedido* (valores calculados automaticamente pelo sistema)\n\n' +
  'Produto: {{productName}}\n' +
  'Valor do produto: {{subtotalAmount}}\n' +
  'Entrega ({{deliveryDistanceKm}} km{{distanceMethodLabel}}, faixa {{deliveryTierKm}} km): {{deliveryFee}}\n' +
  '*Total: {{totalAmount}}*\n\n' +
  '{{pixInstructions}}';

export const DEFAULT_CATALOG_CUSTOMER_DELIVERY_QUOTE_FAILED_MESSAGE =
  'Recebemos seu endereço, mas não foi possível calcular o frete automaticamente neste momento. ' +
  'Um atendente vai confirmar o valor da entrega antes do pagamento — aguarde um momento, por favor.';

export const DEFAULT_CATALOG_CUSTOMER_LOCATION_CONFIRM_MESSAGE =
  '📍 Recebemos sua localização. Para calcular o frete com precisão, confirme o *nome da rua* e o *número* do imóvel.\n\n' +
  '{{areaHint}}' +
  'Ex.: Rua das Flores, 123';

export function renderCatalogCustomerMessage(
  template: string,
  vars: Record<string, string>,
): string {
  let out = template;
  for (const [key, val] of Object.entries(vars)) {
    out = out.replaceAll(`{{${key}}}`, val || '');
  }
  return out.replace(/\{\{[^}]+\}\}/g, '').trim();
}

export const CATALOG_SALES_SECURITY_INSTRUCTION =
  'Quando o cliente demonstrar interesse em comprar este produto, informe preço e estoque *somente* se constarem na base cadastrada. Se o produto tiver link de loja/checkout, envie o link quando o cliente preferir comprar pelo site. Para PIX no chat, colete o endereço completo quando aplicável. Com entrega por distância ativa, *nunca* informe frete nem total — o sistema envia mensagem automática com valores exatos após o endereço. Se o cliente enviar comprovante PIX, informe que a equipe vai conferir. Nunca confirme pagamento apenas com imagem. Se preço, estoque ou frete não estiverem claros, peça confirmação ou transfira para humano.';
