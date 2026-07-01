import { Truck } from 'lucide-react'
import { Card } from '../ui/Card'
import { inputCls, textareaCls } from '@/design-system'
import { DeliveryOriginAddressFields } from '../catalog/DeliveryOriginAddressFields'
import { useCatalogForm } from './CatalogFormContext'

const textareaClsAi = `${textareaCls} min-h-[72px]`

export function ProductsDeliveryTab() {
  const { catalogSales, updateCatalogSales } = useCatalogForm()

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-medium flex items-center gap-2">
        <Truck className="w-5 h-5" /> Entrega e frete
      </h2>
      <p className="text-xs text-[var(--rz-text-muted)]">
        Frete e total são calculados pelo servidor — a IA não informa valores de entrega.
      </p>

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
        placeholder="Instruções gerais de entrega para a IA"
      />

      <div className="rounded-lg border border-[var(--rz-border)] p-3 space-y-3">
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogSales.useDistanceBasedDelivery === true}
            disabled={!catalogSales.requireDeliveryAddress}
            onChange={e => updateCatalogSales({ useDistanceBasedDelivery: e.target.checked })}
          />
          Calcular taxa por distância (km 1–8)
        </label>
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
                  value={catalogSales.deliveryKmRates?.[`km${km}` as keyof typeof catalogSales.deliveryKmRates] ?? ''}
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
    </Card>
  )
}
