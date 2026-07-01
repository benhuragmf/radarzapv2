/** Tipos espelhados de catalog-sales — só interfaces, sem importar o módulo backend no tsc do painel. */

export type CatalogProductSaleMode = 'link' | 'link_or_pix' | 'pix'

export interface CatalogProductSalesMeta {
  aiSellable?: boolean
  saleMode?: CatalogProductSaleMode
  acceptsPix?: boolean
  useCompanyWhatsapp?: boolean
  productWhatsapp?: string
  responsibleSector?: string
  requireHumanReview?: boolean
  madeToOrder?: boolean
  deliveryFee?: string
  requiresDeliveryAddress?: boolean
}

export type CatalogDeliveryKmRates = Record<string, string>

export interface CatalogSalesCompanyConfig {
  enabled?: boolean
  pixEnabled?: boolean
  pixInstructions?: string
  pixKey?: string
  pixHolderName?: string
  notifyWhatsapp?: boolean
  internalWhatsapp?: string
  responsibleName?: string
  internalMessageTemplate?: string
  autoCreateOrderOnPurchase?: boolean
  escalateOnProof?: boolean
  requireHumanApproval?: boolean
  allowManualResend?: boolean
  requireDeliveryAddress?: boolean
  deliveryInstructions?: string
  deliveryOriginAddress?: string
  businessCatalogProfile?: 'none' | 'retail_delivery' | 'retail_pickup' | 'catalog_general'
  useDistanceBasedDelivery?: boolean
  deliveryKmRates?: CatalogDeliveryKmRates
  forceCollectAddress?: boolean
  notifyCustomerOnApprove?: boolean
  notifyCustomerOnReject?: boolean
  notifyCustomerOnRequestNewProof?: boolean
  customerApproveMessage?: string
  customerRejectMessage?: string
  customerRequestNewProofMessage?: string
  customerDeliveryQuoteMessage?: string
  customerDeliveryQuoteFailedMessage?: string
  customerLocationConfirmMessage?: string
}
