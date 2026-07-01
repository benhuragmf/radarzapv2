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
  'pendente_humano_endereco',
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
  /** Perfil que libera cadastro de produtos na UI (escolha explícita do tenant). */
  businessCatalogProfile?: 'none' | 'retail_delivery' | 'retail_pickup' | 'catalog_general';
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
    requireDeliveryAddress: raw?.requireDeliveryAddress ?? true,
    businessCatalogProfile: raw?.businessCatalogProfile ?? 'none',
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
  /** Produto da última oferta padronizada (quando cliente só responde retirar/entregue). */
  catalogOfferProductName?: string;
}): boolean {
  if (opts.saleMode === 'link') return false;
  if (!opts.companyPixEnabled && opts.saleMode !== 'pix') return false;
  if (opts.structuredWantsOrder === true) return true;
  const combined = [opts.threadContext, opts.clientText].filter(Boolean).join(' ');
  const fulfillmentChosen =
    detectDeliveryFulfillmentChoice(opts.clientText) ||
    detectPickupFulfillmentChoice(opts.clientText);
  if (fulfillmentChosen) {
    if (opts.catalogOfferProductName?.trim()) return true;
    if (/\b(comprar|produto|pedido|gostaria)\b/i.test(combined)) return true;
    return false;
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

/** Estoque ausente, texto “consulte” ou sem quantidade numérica confirmada. */
export function productStockIsUncertain(stock: string | null | undefined): boolean {
  if (!stock?.trim()) return true;
  const s = stock.toLowerCase();
  if (s.includes('sob encomenda') || s.includes('encomenda')) return false;
  if (/consulte|sob consulta|confirmar|verificar|indefinido|a confirmar/i.test(s)) return true;
  if (!/\d/.test(s)) return true;
  return false;
}

/** Só libera PIX automático com estoque numérico > 0 ou produto sob encomenda explícito. */
export function productStockAllowsPixPurchase(
  stock: string | null | undefined,
  madeToOrder?: boolean,
): boolean {
  if (madeToOrder) return true;
  if (productStockIsZero(stock)) return false;
  if (productStockIsUncertain(stock)) return false;
  const s = stock!.toLowerCase();
  if (s.includes('sob encomenda') || s.includes('encomenda')) return true;
  const m = s.match(/(\d+)/);
  return m ? parseInt(m[1], 10) > 0 : false;
}

export type CatalogFulfillmentMode = 'pickup_only' | 'delivery_only' | 'pickup_and_delivery';

/** Modo retirada/entrega derivado do perfil comercial da empresa. */
export function resolveCatalogFulfillmentMode(
  companyCfg: CatalogSalesCompanyConfig,
): CatalogFulfillmentMode {
  const profile = companyCfg.businessCatalogProfile ?? 'none';
  if (profile === 'retail_pickup') return 'pickup_only';
  if (profile === 'retail_delivery') return 'delivery_only';
  return 'pickup_and_delivery';
}

/** Endereço obrigatório quando o cliente escolhe entrega (antes do PIX). */
export function deliveryFulfillmentNeedsAddress(
  companyCfg: CatalogSalesCompanyConfig,
  productMeta: CatalogProductSalesMeta,
): boolean {
  if (productMeta.requiresDeliveryAddress === true) return true;
  if (companyCfg.businessCatalogProfile === 'retail_delivery') return true;
  if (companyCfg.requireDeliveryAddress === true) return true;
  if (companyCfg.forceCollectAddress === true) return true;
  if (companyCfg.useDistanceBasedDelivery === true) return true;
  if (productMeta.requiresDeliveryAddress === false) return false;
  return false;
}

const BARE_AFFIRMATION_RE =
  /^(sim|s|ss|ok|pode|pode ser|confirmo|fechado|isso|certo|claro|beleza|blz|ta|tá|ta bom|tudo bem)[\s!.?]*$/i;

/** “sim”, “ok” etc. — não são nome de produto. */
export function isBareAffirmationOrNonProductReply(text: string): boolean {
  const t = text.trim();
  if (!t) return true;
  if (BARE_AFFIRMATION_RE.test(t)) return true;
  if (detectPurchaseConfirmation(t)) {
    const words = t.split(/\s+/).filter(Boolean);
    if (words.length <= 2) return true;
  }
  return false;
}

/** Cliente pergunta sobre taxa/endereço dentro do fluxo de entrega. */
export function detectDeliveryFeeOrAddressQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 300) return false;
  return (
    /\b(taxa de entrega|tem entrega|valor da entrega|custo da entrega|quanto (fica|é) o frete|tem frete|valor do frete)\b/i.test(
      t,
    ) ||
    /\b(meu endereço|meu endereco|vai pedir (o )?endereço|vai pedir (o )?endereco|não vai pedir|nao vai pedir|como calcula (a )?entrega|pega (o )?endereço|pega (o )?endereco)\b/i.test(
      t,
    )
  );
}

/** Cliente pede reenvio explícito das instruções PIX. */
export function detectPixResendRequest(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /\b(manda(r)? (o )?pix|reenvi(ar|e) (o )?pix|chave pix|não achei o pix|nao achei o pix|qual (a )?chave|reenviar pagamento|manda a chave|não achei|nao achei)\b/i.test(
    t,
  );
}

const GENERIC_PICKUP_HINT_RE =
  /consulte\s+(nossa\s+)?equipe|endereço de retirada não configurado|a confirmar/i;

/** Endereço de retirada válido (não genérico/placeholder). */
export function isValidConfiguredPickupAddress(address: string | null | undefined): boolean {
  const t = address?.trim() ?? '';
  if (!t || t.length < 12) return false;
  if (GENERIC_PICKUP_HINT_RE.test(t)) return false;
  if (/\d{5}-?\d{3}/.test(t) && t.includes(',')) return true;
  if (/\b(rua|av\.|avenida|rod\.|estrada)\b/i.test(t) && /\d/.test(t)) return true;
  return t.length >= 20 && /\d/.test(t);
}

/** Resolve endereço de retirada a partir da config da empresa. */
export function resolveConfiguredPickupAddress(
  companyCfg: CatalogSalesCompanyConfig,
  orgAddress?: string | null,
): string | null {
  const candidates = [
    companyCfg.deliveryOriginAddress?.trim(),
    orgAddress?.trim(),
    companyCfg.deliveryInstructions?.trim(),
  ].filter(Boolean) as string[];
  for (const c of candidates) {
    if (isValidConfiguredPickupAddress(c)) return c;
  }
  return null;
}

export function buildPickupWithoutAddressReply(
  productName: string,
  contactFirstName?: string,
): string {
  const first = contactFirstName?.trim().split(/\s+/)[0];
  const prefix = first ? `${first}, ` : '';
  return (
    `${prefix}Perfeito, encontrei o produto *${productName}*. ` +
    'Antes de liberar o pagamento, preciso confirmar o endereço de retirada com nossa equipe. ' +
    'Vou encaminhar seu pedido para conferência.'
  );
}

export function buildPickupWithAddressReply(
  productName: string,
  pickupAddress: string,
  pixInstructions?: string,
): string {
  const pix =
    pixInstructions?.trim() ? `\n\n*Pagamento PIX:*\n${pixInstructions.trim()}` : '';
  return (
    `Perfeito! Você poderá retirar o produto *${productName}* em:\n${pickupAddress.trim()}${pix}\n\n` +
    'Envie o comprovante aqui após o pagamento para nossa equipe conferir.'
  );
}

/** Fallback contextual no fluxo de catálogo — evita mensagem genérica de instabilidade. */
export function buildCatalogContextualRecoveryReply(opts: {
  orderStatus?: CatalogSalesOrderStatus;
  productName?: string;
  deliveryLocationPendingConfirm?: boolean;
  contactFirstName?: string;
}): string | null {
  const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
  const product = opts.productName?.trim() ? `*${opts.productName.trim()}*` : 'seu pedido';

  if (opts.deliveryLocationPendingConfirm) {
    return (
      `${prefix}Recebi sua localização. Agora preciso apenas da *rua* e *número* do imóvel. ` +
      'Ex.: Rua das Flores, 123.'
    );
  }

  if (opts.orderStatus === 'aguardando_endereco') {
    return (
      `${prefix}Ainda preciso confirmar seu CEP/endereço para calcular a entrega antes do PIX. ` +
      'Pode me enviar o CEP ou rua e número?'
    );
  }

  if (opts.orderStatus === 'aguardando_pagamento') {
    return (
      `${prefix}seu pedido de ${product} segue aguardando pagamento. ` +
      'Se precisar das instruções PIX novamente, digite *manda o pix*.'
    );
  }

  if (opts.orderStatus === 'pendente_configuracao_whatsapp') {
    return (
      `${prefix}Antes de liberar o pagamento, preciso confirmar o endereço de retirada com a equipe.`
    );
  }

  return null;
}

export function formatProductPriceOfferPhrase(price?: string | null): string {
  const priceRaw = price?.trim();
  if (!priceRaw || !productHasClearPrice(priceRaw)) return 'preço a confirmar';
  return priceRaw.includes('R$') ? priceRaw : `R$ ${priceRaw.replace(/^R\$\s*/i, '')}`;
}

export function formatProductStockOfferPhrase(stock?: string | null): string {
  const stockRaw = stock?.trim();
  if (!stockRaw) return 'a disponibilidade precisa ser confirmada';
  if (productStockIsUncertain(stockRaw)) return 'a disponibilidade precisa ser confirmada';
  const m = stockRaw.match(/(\d+)/);
  if (m) {
    const n = parseInt(m[1], 10);
    if (n === 0) return 'sem estoque no momento';
    return `temos ${n} unidade${n === 1 ? '' : 's'}`;
  }
  return stockRaw;
}

export function buildDeliveryAddressStartReply(
  productName: string,
  companyCfg: CatalogSalesCompanyConfig,
): string {
  const forceFull =
    companyCfg.forceCollectAddress === true &&
    companyCfg.useDistanceBasedDelivery !== true;
  if (forceFull) {
    return (
      `Perfeito, vamos seguir com a entrega do produto *${productName}*.\n\n` +
      'Me envie o *endereço completo* com CEP, rua, número, bairro e cidade para calcular a entrega antes do pagamento.'
    );
  }
  return (
    `Perfeito, vamos seguir com a entrega do produto *${productName}*.\n\n` +
    'Para calcular a entrega e confirmar o valor final, me envie seu *CEP*. ' +
    'Depois eu peço o número/endereço e te passo o total com frete antes do PIX.'
  );
}

export function buildDeliveryInquiryReply(opts: {
  productName: string;
  hasPartialAddress?: boolean;
  contactFirstName?: string;
}): string {
  const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
  if (opts.hasPartialAddress) {
    return (
      `${prefix}ainda preciso confirmar o *número/endereço completo* para calcular o frete antes do PIX.`
    );
  }
  return (
    `${prefix}sim, pode ter taxa de entrega. Para calcular certinho, preciso do seu *CEP/endereço*. ` +
    'Me envie seu CEP para eu calcular antes de liberar o PIX.'
  );
}

/** Normaliza texto para comparação de catálogo (acentos, caixa, hífens, espaços). */
export function normalizeCatalogCompareText(text: string): string {
  return text
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim();
}

function levenshteinDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = Array.from({ length: m + 1 }, () => new Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

/** Similaridade 0–1 entre consulta do cliente e título do produto. */
export function catalogTitleSimilarity(query: string, title: string): number {
  const q = normalizeCatalogCompareText(query);
  const t = normalizeCatalogCompareText(title);
  if (!q || !t) return 0;
  if (q === t) return 1;
  if (t.includes(q) || q.includes(t)) return 0.92;
  const dist = levenshteinDistance(q, t);
  const maxLen = Math.max(q.length, t.length);
  return maxLen > 0 ? 1 - dist / maxLen : 0;
}

/** Score mínimo para ofertar produto direto (match forte). */
export const CATALOG_STRONG_MATCH_MIN_SCORE = 0.92;

/** Score mínimo para sugerir produto parecido (sem abrir pedido/PIX). */
export const CATALOG_FUZZY_SUGGEST_MIN_SCORE = 0.68;

export function isStrongCatalogProductTitleMatch(query: string, title: string): boolean {
  return catalogTitleSimilarity(query, title) >= CATALOG_STRONG_MATCH_MIN_SCORE;
}

export function isAmbiguousCatalogFuzzyMatch(query: string, title: string): boolean {
  const score = catalogTitleSimilarity(query, title);
  return score >= CATALOG_FUZZY_SUGGEST_MIN_SCORE && score < CATALOG_STRONG_MATCH_MIN_SCORE;
}

const PRODUCT_QUERY_STOPWORDS = new Set([
  'de',
  'da',
  'do',
  'um',
  'uma',
  'o',
  'a',
  'the',
  'comprar',
  'quero',
  'produto',
  'sim',
  'ok',
  'pode',
  'confirmo',
  'fechado',
  'isso',
  'certo',
  'claro',
]);

/** Extrai token provável de nome de produto em frase curta. */
export function extractCatalogProductQueryToken(text: string): string | null {
  const t = text.trim();
  if (!t || t.length > 80) return null;
  const words = t
    .split(/\s+/)
    .map(w => w.replace(/[^\p{L}\p{N}\-_.]/gu, '').toLowerCase())
    .filter(w => w.length >= 2 && !PRODUCT_QUERY_STOPWORDS.has(w));
  if (words.length === 1) return words[0];
  if (words.length > 1) {
    const last = words[words.length - 1];
    if (last.length >= 3) return last;
  }
  return t.length <= 32 ? t.toLowerCase().replace(/[^\p{L}\p{N}\-_.]/gu, '') : null;
}

/** Mensagem curta que parece nome de produto (ex.: "zaad", "kit premium"). */
export function looksLikeCatalogProductNameQuery(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 2 || t.length > 32 || t.includes('?')) return false;
  if (isBareAffirmationOrNonProductReply(t)) return false;
  if (detectDeliveryFulfillmentChoice(t) || detectPickupFulfillmentChoice(t)) return false;
  if (/\b(atendente|humano|ajuda|horario|horário|funciona|obrigad|valeu|tchau)\b/i.test(t)) {
    return false;
  }
  if (/\b(oi|ola|olá|bom dia|boa tarde|boa noite|e ai|eae|alo|alô)\b/i.test(t)) return false;
  if (/^(bom|boa)\s+(dia|tarde|noite)$/i.test(t)) return false;
  const words = t.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return false;
  if (words.length === 1) return words[0].length >= 2;
  const token = extractCatalogProductQueryToken(t);
  return Boolean(token && token.length >= 3);
}

/** Última mensagem do bot foi oferta padronizada aguardando retirada/entrega. */
export function isAwaitingCatalogFulfillmentChoice(lastAssistantReply?: string): boolean {
  return isCatalogPurchaseOfferMessage(lastAssistantReply);
}

export const CATALOG_DELIVERY_CEP_REQUEST_MESSAGE =
  'Para calcular a entrega e confirmar o valor final, me envie seu *CEP*. ' +
  'Depois eu peço o número/endereço e te passo o total com frete antes do PIX.';

export const CATALOG_EMPTY_REPLY_SUFFIX =
  'no momento não encontrei produtos cadastrados no catálogo desta empresa. ' +
  'Posso chamar um atendente para te ajudar? Digite *atendente*.';

/** Linha de sugestão de produto com preço e estoque para o cliente. */
export function formatCatalogProductSuggestionLine(
  title: string,
  price?: string | null,
  stock?: string | null,
): string {
  const priceLabel = productHasClearPrice(price) ? formatProductPriceOfferPhrase(price) : 'preço a confirmar';
  let stockLabel = 'disponibilidade a confirmar';
  const stockRaw = stock?.trim();
  if (stockRaw) {
    if (productStockIsZero(stockRaw)) {
      stockLabel = 'sem estoque';
    } else if (productStockAllowsPixPurchase(stockRaw)) {
      const m = stockRaw.match(/(\d+)/);
      stockLabel = m ? `${m[1]} un.` : stockRaw;
    } else if (productStockIsUncertain(stockRaw)) {
      stockLabel = 'disponibilidade a confirmar';
    } else {
      stockLabel = stockRaw;
    }
  }
  return `*${title}* — ${priceLabel} — ${stockLabel}`;
}

/** Oferta padronizada de compra — retirada, entrega ou ambos conforme perfil. */
export function buildCatalogPurchaseOfferReply(opts: {
  productName: string;
  price?: string | null;
  stock?: string | null;
  contactFirstName?: string;
  fulfillmentMode?: CatalogFulfillmentMode;
}): string {
  const first = opts.contactFirstName?.trim()?.split(/\s+/)[0];
  const greeting = first ? `Olá, ${first}!` : 'Olá!';
  const mode = opts.fulfillmentMode ?? 'pickup_and_delivery';
  const pricePhrase = formatProductPriceOfferPhrase(opts.price);

  if (!productHasClearPrice(opts.price)) {
    return (
      `${greeting} Encontrei o produto *${opts.productName}*, mas o preço precisa ser confirmado por um atendente.`
    );
  }

  if (!productStockAllowsPixPurchase(opts.stock)) {
    if (productStockIsZero(opts.stock)) {
      return (
        `${greeting} o produto *${opts.productName}* está sem estoque no momento. ` +
        'Posso chamar um atendente para te avisar quando voltar?'
      );
    }
    return (
      `${greeting} Encontrei o produto *${opts.productName}* por ${pricePhrase}, mas preciso confirmar a disponibilidade antes de gerar o pagamento. ` +
      'Vou chamar um atendente para confirmar o estoque.'
    );
  }

  const stockPhrase = formatProductStockOfferPhrase(opts.stock);
  const body = `${greeting} O produto *${opts.productName}* está disponível por ${pricePhrase} e ${stockPhrase}.`;

  if (mode === 'pickup_only') {
    return `${body} Deseja continuar com a compra para *retirada*?`;
  }
  if (mode === 'delivery_only') {
    return (
      `${body} Esse produto está disponível para entrega. ` +
      'Me envie seu CEP para calcular o frete antes do pagamento.'
    );
  }
  return (
    `${body} Você gostaria de prosseguir com a compra? Se sim, prefere *retirar* ou que seja *entregue*?`
  );
}

export function buildEmptyCatalogReply(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return `${prefix}${CATALOG_EMPTY_REPLY_SUFFIX}`;
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

/** Cliente escolheu retirada na loja. */
export function detectPickupFulfillmentChoice(text: string): boolean {
  const t = normalizeCatalogCompareText(text);
  if (!t || t.length > 120) return false;
  return (
    /\b(prefiro retirar|quero retirar|vou retirar|retirar na loja|pegar na loja|buscar na loja|vou buscar|passo ai)\b/.test(
      t,
    ) || /^(retirar|retirada|buscar|retira)[\s!.?]*$/.test(t)
  );
}

/** Cliente escolheu entrega após oferta de compra (não inclui retirada). */
export function detectDeliveryFulfillmentChoice(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 120) return false;
  if (detectPickupFulfillmentChoice(text)) return false;
  return (
    /\b(quero que entregue|me entregue|com entrega|para entregar|por entrega|quero entrega|prefiro entrega|manda entregar|mandar entregar|enviar pra mim|enviar para mim|envia pra mim|envia para mim|quero receber|delivery|pode entregar)\b/i.test(
      t,
    ) ||
    /\b(entregue|entrega|envio|enviar|receber em casa)\b/i.test(t)
  );
}

const CATALOG_PURCHASE_OFFER_RE =
  /O produto \*([^*]+)\* está disponível por .+ prefere \*retirar\* ou que seja \*entregue\*/i;

const CATALOG_PURCHASE_OFFER_PRODUCT_RE = /(?:O produto|produto) \*([^*]+)\*/i;

/** Mensagem automática de oferta padronizada do catálogo. */
export function isCatalogPurchaseOfferMessage(text: string | undefined): boolean {
  if (!text?.trim()) return false;
  const t = text.trim();
  return (
    CATALOG_PURCHASE_OFFER_RE.test(t) ||
    /prefere \*retirar\* ou que seja \*entregue\*/i.test(t) ||
    /continuar com a compra para \*retirada\*/i.test(t) ||
    /disponível para entrega.*CEP/i.test(t) ||
    /calcular o frete antes do pagamento/i.test(t)
  );
}

/** Extrai o nome do produto da oferta padronizada. */
export function extractProductNameFromCatalogOffer(text: string | undefined): string | null {
  if (!text?.trim()) return null;
  const m = text.match(CATALOG_PURCHASE_OFFER_RE) ?? text.match(CATALOG_PURCHASE_OFFER_PRODUCT_RE);
  return m?.[1]?.trim() || null;
}

/** Lembrete quando o cliente repete o produto sem escolher retirada/entrega. */
export function buildFulfillmentReminderReply(
  productName: string,
  contactFirstName?: string,
): string {
  const first = contactFirstName?.trim().split(/\s+/)[0];
  const greet = first ? `${first}, ` : '';
  return `${greet}para o *${productName}*, prefere *retirar* na loja ou que seja *entregue*?`;
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

/** Pedido ativo de catálogo expirado — não retomar em saudação nova. */
export const STALE_CATALOG_ORDER_MS = 72 * 60 * 60 * 1000;

export function isStaleCatalogOrder(order: {
  updatedAt: Date | string;
  status: CatalogSalesOrderStatus;
}): boolean {
  if (order.status === 'cancelado' || order.status === 'pagamento_aprovado' || order.status === 'pedido_confirmado') {
    return true;
  }
  const age = Date.now() - new Date(order.updatedAt).getTime();
  if (order.status === 'aguardando_endereco' && age > STALE_CATALOG_ORDER_MS) return true;
  return false;
}

const CATALOG_GREETING_ONLY_RE =
  /^(oi|ola|olá|alo|alô|bom dia|boa tarde|boa noite|e ai|eae|opa|hey|hello|hi)[\s!.?]*$/i;

export function isCatalogGreetingOnly(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 60) return false;
  if (isBareAffirmationOrNonProductReply(t)) return true;
  if (CATALOG_GREETING_ONLY_RE.test(t)) return true;
  if (/^(bom|boa)\s+(dia|tarde|noite)$/i.test(t)) return true;
  if (/\b(bom dia|boa tarde|boa noite)\b/i.test(t) && !mentionsCatalogResumeIntent(t)) return true;
  const norm = normalizeCatalogCompareText(t);
  if (/^(ola|oi|opa|e ai|eae)\b/.test(norm) && t.length <= 40 && !mentionsCatalogResumeIntent(t)) {
    return true;
  }
  return false;
}

export function mentionsCatalogResumeIntent(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t) return false;
  return /\b(continuar pedido|meu pedido|meu pix|comprovante|retirada|retirar|entrega|entregue|zaad|pedido|pagamento|manda o pix|chave pix|quero comprar|gostaria de comprar)\b/i.test(
    t,
  );
}

export function shouldIgnoreStaleCatalogRecovery(clientText: string, order?: { updatedAt: Date | string; status: CatalogSalesOrderStatus } | null): boolean {
  if (!order) return false;
  if (isStaleCatalogOrder(order) && !mentionsCatalogResumeIntent(clientText)) return true;
  if (isCatalogGreetingOnly(clientText) && !mentionsCatalogResumeIntent(clientText)) return true;
  return false;
}

export function detectCatalogHumanEscalationRequest(text: string): boolean {
  const t = normalizeCatalogCompareText(text);
  if (!t) return false;
  return (
    /\b(falar com atendente|quero atendente|chamar atendente|preciso de atendente|atendimento humano|quero humano|quero pessoa|falar com pessoa|falar com suporte|chamar suporte|suporte humano)\b/.test(
      t,
    ) || /^(atendente|humano|pessoa|suporte)[\s!.?]*$/.test(t)
  );
}

export function detectCatalogCancelRequest(text: string): boolean {
  const t = normalizeCatalogCompareText(text);
  if (!t) return false;
  return (
    /\b(cancelar pedido|cancela pedido|desistir|nao quero mais|não quero mais|nao quero|não quero)\b/.test(t) ||
    /^(cancelar|cancela)[\s!.?]*$/.test(t)
  );
}

export function detectCatalogExitRequest(text: string): boolean {
  const t = normalizeCatalogCompareText(text);
  if (!t) return false;
  return /^(sair|parar|encerrar)[\s!.?]*$/.test(t);
}

export function detectCatalogCepOfferQuestion(text: string): boolean {
  const t = text.trim().toLowerCase();
  if (!t || t.length > 120) return false;
  return /\b(posso te enviar o cep|posso enviar o cep|mando o cep|te mando o cep|prefere o cep|quer o cep)\b/i.test(
    t,
  );
}

export function buildCatalogCepOfferReply(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return `${prefix}Sim, pode me enviar o *CEP*. Com ele eu calculo a entrega antes de liberar o PIX.`;
}

export function buildCatalogHumanEscalationReply(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return `${prefix}Certo, vou chamar um atendente para continuar seu pedido.`;
}

export function buildCatalogCancelReply(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return `${prefix}Certo, cancelei o fluxo de compra deste pedido. Se precisar, é só me chamar novamente.`;
}

export function buildCatalogExitReply(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return `${prefix}Tudo bem, encerrei o fluxo de compra. Se quiser continuar depois, é só me chamar.`;
}

export function buildCatalogMediaInFlowReply(opts: {
  productName?: string;
  awaitingAddress?: boolean;
  awaitingFulfillment?: boolean;
  locationPendingConfirm?: boolean;
  mediaKind?: 'audio' | 'image' | 'video' | 'document';
}): string {
  const product = opts.productName?.trim() ? `*${opts.productName.trim()}*` : 'seu pedido';
  if (opts.mediaKind === 'audio') {
    if (opts.locationPendingConfirm || opts.awaitingAddress) {
      return (
        'Recebi seu áudio. Para calcular a entrega antes do PIX, me envie o *CEP* ou a *rua e número* por texto.'
      );
    }
    if (opts.awaitingFulfillment) {
      return `Recebi seu áudio, mas para continuar a compra do produto ${product} preciso que você responda por texto se prefere *retirar* ou *receber por entrega*.`;
    }
    return `Recebi seu áudio. Para continuar a compra de ${product}, responda por *texto* no chat.`;
  }
  if (opts.mediaKind === 'image' || opts.mediaKind === 'document') {
    return (
      `Recebi sua ${opts.mediaKind === 'document' ? 'imagem/documento' : 'imagem'}. ` +
      `Para seguir com ${product}, responda por texto ou envie o comprovante PIX quando for o momento do pagamento.`
    );
  }
  return `Recebi sua mídia. Para continuar com ${product}, responda por *texto* no chat.`;
}

export function buildCatalogAddressRetryReply(opts: {
  attempt: number;
  contactFirstName?: string;
}): string {
  const prefix = opts.contactFirstName?.trim() ? `${opts.contactFirstName.trim()}, ` : '';
  if (opts.attempt >= 3) {
    return `${prefix}Vou chamar um atendente para confirmar seu endereço e o frete antes do pagamento.`;
  }
  if (opts.attempt >= 2) {
    return `${prefix}Se preferir, pode me enviar só o *CEP* (8 dígitos) para eu calcular a entrega antes do PIX.`;
  }
  return (
    `${prefix}Ainda preciso da *rua* e do *número* do imóvel para calcular o frete. ` +
    'Ex.: *Rua das Flores, 123* ou *Jose Pinto, 120*.'
  );
}

export function catalogOrderInboxTitle(status: CatalogSalesOrderStatus): string {
  switch (status) {
    case 'aguardando_endereco':
      return '📍 Pedido aguardando endereço';
    case 'pendente_humano_endereco':
      return '👤 Endereço aguardando atendente';
    case 'aguardando_pagamento':
      return '💳 Pedido aguardando pagamento';
    case 'comprovante_recebido':
      return '🧾 Comprovante PIX recebido';
    case 'em_conferencia':
      return '🔍 Pagamento em conferência';
    case 'pagamento_aprovado':
      return '✅ Pagamento aprovado';
    case 'pagamento_recusado':
      return '❌ Pagamento recusado';
    case 'pedido_confirmado':
      return '✅ Pedido confirmado';
    case 'cancelado':
      return '🚫 Pedido cancelado';
    case 'falha_notificacao_whatsapp':
      return '⚠️ Falha notificação WhatsApp';
    case 'pendente_configuracao_whatsapp':
      return '⏳ Aguardando configuração WhatsApp';
    case 'comprovante_sem_pedido':
      return '🧾 Comprovante sem pedido vinculado';
    default:
      return '📦 Pedido de catálogo';
  }
}

export const CATALOG_SALES_SECURITY_INSTRUCTION =
  'Quando o cliente demonstrar interesse em comprar este produto, informe preço e estoque *somente* se constarem na base cadastrada. Se o produto tiver link de loja/checkout, envie o link quando o cliente preferir comprar pelo site. Para PIX no chat, colete o endereço completo quando aplicável. Com entrega por distância ativa, *nunca* informe frete nem total — o sistema envia mensagem automática com valores exatos após o endereço. Se o cliente enviar comprovante PIX, informe que a equipe vai conferir. Nunca confirme pagamento apenas com imagem. Se preço, estoque ou frete não estiverem claros, peça confirmação ou transfira para humano.';
