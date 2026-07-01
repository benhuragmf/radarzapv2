import type { CatalogFulfillmentMode } from '@/lib/catalog/productDisplay'
import { Truck } from 'lucide-react'
import { inputCls, textareaCls, SectionCard, InlineNotice } from '@/design-system'
import { DeliveryOriginAddressFields } from '../catalog/DeliveryOriginAddressFields'
import { useCatalogForm } from './CatalogFormContext'
import {
  applyFulfillmentModePatch,
  fulfillmentModeFromConfig,
  FULFILLMENT_MODE_LABELS,
} from '@/lib/catalog/productDisplay'

const textareaClsAi = `${textareaCls} min-h-[72px]`

export function ProductsDeliveryTab() {
  const { catalogSales, updateCatalogSales } = useCatalogForm()
  const fulfillmentMode = fulfillmentModeFromConfig(catalogSales)

  const setFulfillmentMode = (mode: CatalogFulfillmentMode) => {
    updateCatalogSales(applyFulfillmentModePatch(mode))
  }

  return (
    <div className="space-y-6 mt-4">
      <SectionCard
        title="Modo de atendimento"
        description="Como esta empresa entrega produtos — reflete o perfil comercial usado pela IA."
      >
        <div className="grid gap-2 sm:grid-cols-3">
          {(
            ['pickup_only', 'delivery_only', 'pickup_and_delivery'] as CatalogFulfillmentMode[]
          ).map(mode => (
            <button
              key={mode}
              type="button"
              onClick={() => setFulfillmentMode(mode)}
              className={`rounded-lg border p-3 text-left text-sm transition-colors ${
                fulfillmentMode === mode
                  ? 'border-brand-500 bg-brand-500/10'
                  : 'border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]'
              }`}
            >
              <p className="font-medium">{FULFILLMENT_MODE_LABELS[mode]}</p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                {mode === 'pickup_only' && 'Cliente só retira na loja.'}
                {mode === 'delivery_only' && 'Sempre pede endereço antes do PIX.'}
                {mode === 'pickup_and_delivery' && 'Cliente escolhe retirar ou entrega.'}
              </p>
            </button>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Endereço e PIX"
        description="Frete e total são calculados pelo servidor — a IA não informa valores de entrega."
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogSales.requireDeliveryAddress === true}
              onChange={e => {
                updateCatalogSales({
                  requireDeliveryAddress: e.target.checked,
                  forceCollectAddress: e.target.checked,
                })
              }}
            />
            Exigir endereço de entrega antes do PIX
          </label>

          <textarea
            className={textareaClsAi}
            value={catalogSales.deliveryInstructions ?? ''}
            onChange={e => updateCatalogSales({ deliveryInstructions: e.target.value })}
            placeholder="Instruções de entrega para a IA (sem valores de frete manual se usa cálculo automático)"
          />
        </div>
      </SectionCard>

      <SectionCard title="Frete por distância">
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogSales.useDistanceBasedDelivery === true}
              disabled={!catalogSales.requireDeliveryAddress}
              onChange={e => updateCatalogSales({ useDistanceBasedDelivery: e.target.checked })}
            />
            Calcular taxa por distância (km 1–8)
          </label>

          <InlineNotice tone="info" title="Cálculo no servidor">
            A IA pede CEP/endereço; o sistema envia mensagem automática com frete e total antes do
            PIX. Não coloque valor de frete fixo nas instruções se este modo estiver ativo.
          </InlineNotice>

          <DeliveryOriginAddressFields
            value={catalogSales.deliveryOriginAddress ?? ''}
            onChange={canonical => updateCatalogSales({ deliveryOriginAddress: canonical })}
            showValidation={catalogSales.useDistanceBasedDelivery === true}
          />

          {catalogSales.useDistanceBasedDelivery && (
            <div className="grid gap-2 sm:grid-cols-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(km => (
                <label key={km} className="text-xs space-y-1">
                  <span className="text-[var(--rz-text-muted)]">Até {km} km</span>
                  <input
                    className={inputCls}
                    value={
                      catalogSales.deliveryKmRates?.[
                        `km${km}` as keyof typeof catalogSales.deliveryKmRates
                      ] ?? ''
                    }
                    onChange={e =>
                      updateCatalogSales({
                        deliveryKmRates: {
                          ...catalogSales.deliveryKmRates,
                          [`km${km}`]: e.target.value,
                        },
                      })
                    }
                    placeholder="R$ 0,00"
                  />
                </label>
              ))}
            </div>
          )}
        </div>
      </SectionCard>

      <p className="text-xs text-[var(--rz-text-muted)] flex items-center gap-1">
        <Truck className="w-3.5 h-3.5" />
        Retirada na loja usa instruções gerais ou endereço da empresa no fluxo de pedido.
      </p>
    </div>
  )
}
