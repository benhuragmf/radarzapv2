import { CreditCard } from 'lucide-react'
import { inputCls, textareaCls, SectionCard } from '@/design-system'
import { useCatalogForm } from './CatalogFormContext'
import { OperationalWhatsAppCards } from './OperationalWhatsAppCards'

const textareaClsAi = `${textareaCls} min-h-[72px]`

export function ProductsSettingsTab() {
  const { catalogSales, updateCatalogSales, patchCatalogSalesPix, catalogPixExtraNotes } =
    useCatalogForm()

  return (
    <div className="space-y-6 mt-4">
      <OperationalWhatsAppCards />

      <SectionCard
        title="Pagamento PIX"
        description="Chave e instruções enviadas ao cliente quando o fluxo permitir PIX automático."
      >
        <div className="space-y-4">
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogSales.pixEnabled === true}
              onChange={e => updateCatalogSales({ pixEnabled: e.target.checked })}
            />
            Ativar pagamento via PIX
          </label>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={catalogSales.autoCreateOrderOnPurchase !== false}
              onChange={e => updateCatalogSales({ autoCreateOrderOnPurchase: e.target.checked })}
            />
            Criar pedido ao confirmar compra
          </label>

          <div
            className={`rounded-lg border border-[var(--rz-border)] p-3 space-y-3 ${catalogSales.pixEnabled ? '' : 'opacity-60'}`}
          >
            <div className="grid gap-2 md:grid-cols-2">
              <input
                className={inputCls}
                disabled={!catalogSales.pixEnabled}
                value={catalogSales.pixKey ?? ''}
                onChange={e => patchCatalogSalesPix({ pixKey: e.target.value })}
                placeholder="Chave PIX"
              />
              <input
                className={inputCls}
                disabled={!catalogSales.pixEnabled}
                value={catalogSales.pixHolderName ?? ''}
                onChange={e => patchCatalogSalesPix({ pixHolderName: e.target.value })}
                placeholder="Titular"
              />
            </div>
            <textarea
              className={textareaClsAi}
              disabled={!catalogSales.pixEnabled}
              value={catalogPixExtraNotes}
              onChange={e => patchCatalogSalesPix({ pixInstructions: e.target.value })}
              placeholder="Instruções extras para o cliente (após pagar, envie comprovante…)"
            />
          </div>
        </div>
      </SectionCard>

      <SectionCard
        title="Mensagens automáticas ao cliente"
        description="Disparadas ao aprovar, recusar ou pedir novo comprovante."
      >
        <div className="space-y-3">
          <textarea
            className={textareaClsAi}
            value={catalogSales.customerApproveMessage ?? ''}
            onChange={e => updateCatalogSales({ customerApproveMessage: e.target.value })}
            placeholder="Ao aprovar — {{productName}}"
          />
          <textarea
            className={textareaClsAi}
            value={catalogSales.customerRejectMessage ?? ''}
            onChange={e => updateCatalogSales({ customerRejectMessage: e.target.value })}
            placeholder="Ao recusar — {{productName}}, {{reason}}"
          />
          <textarea
            className={textareaClsAi}
            value={catalogSales.customerRequestNewProofMessage ?? ''}
            onChange={e =>
              updateCatalogSales({ customerRequestNewProofMessage: e.target.value })
            }
            placeholder="Novo comprovante — {{productName}}, {{reason}}"
          />
        </div>
      </SectionCard>

      <p className="text-xs text-[var(--rz-text-muted)] flex items-center gap-1">
        <CreditCard className="w-3.5 h-3.5" />
        Ativação do catálogo na IA:{' '}
        <a href="/platform/inbox/ia#empresa" className="text-brand-400 underline">
          IA Atendimento → Empresa
        </a>
      </p>
    </div>
  )
}
