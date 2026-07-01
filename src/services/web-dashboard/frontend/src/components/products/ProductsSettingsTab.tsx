import { CreditCard } from 'lucide-react'
import { Card } from '../ui/Card'
import { inputCls, textareaCls } from '@/design-system'
import { useCatalogForm } from './CatalogFormContext'

const textareaClsAi = `${textareaCls} min-h-[72px]`

export function ProductsSettingsTab() {
  const {
    catalogSales,
    updateCatalogSales,
    patchCatalogSalesPix,
    catalogPixExtraNotes,
    canEditSalesWhatsapp,
  } = useCatalogForm()

  return (
    <Card className="p-6 space-y-4">
      <h2 className="text-lg font-medium flex items-center gap-2">
        <CreditCard className="w-5 h-5" /> Configurações de PIX e pedidos
      </h2>
      <p className="text-xs text-[var(--rz-text-muted)]">
        Ativação do catálogo na IA permanece em{' '}
        <a href="/platform/inbox/ia#empresa" className="text-brand-400 underline">
          IA Atendimento → Empresa
        </a>
        .
      </p>

      <div className="grid gap-3 sm:grid-cols-2">
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
            checked={catalogSales.notifyWhatsapp === true}
            onChange={e => updateCatalogSales({ notifyWhatsapp: e.target.checked })}
          />
          Enviar comprovante para WhatsApp interno
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogSales.requireHumanApproval !== false}
            onChange={e => updateCatalogSales({ requireHumanApproval: e.target.checked })}
          />
          Exigir conferência humana
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogSales.escalateOnProof !== false}
            onChange={e => updateCatalogSales({ escalateOnProof: e.target.checked })}
          />
          Escalar para humano após comprovante
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogSales.autoCreateOrderOnPurchase !== false}
            onChange={e => updateCatalogSales({ autoCreateOrderOnPurchase: e.target.checked })}
          />
          Criar pedido ao confirmar compra
        </label>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={catalogSales.allowManualResend !== false}
            onChange={e => updateCatalogSales({ allowManualResend: e.target.checked })}
          />
          Permitir reenvio manual de notificação
        </label>
      </div>

      <div className={`rounded-lg border border-[var(--rz-border)] p-3 space-y-3 ${catalogSales.pixEnabled ? '' : 'opacity-60'}`}>
        <p className="text-sm font-medium">Chave PIX</p>
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
          placeholder="Instruções extras para o cliente"
        />
      </div>

      <div className="grid gap-2 md:grid-cols-2">
        <input
          className={inputCls}
          disabled={!canEditSalesWhatsapp}
          value={catalogSales.internalWhatsapp ?? ''}
          onChange={e => updateCatalogSales({ internalWhatsapp: e.target.value })}
          placeholder="WhatsApp interno (DDI)"
        />
        <input
          className={inputCls}
          value={catalogSales.responsibleName ?? ''}
          onChange={e => updateCatalogSales({ responsibleName: e.target.value })}
          placeholder="Responsável / setor"
        />
      </div>
      <textarea
        className={textareaClsAi}
        value={catalogSales.internalMessageTemplate ?? ''}
        onChange={e => updateCatalogSales({ internalMessageTemplate: e.target.value })}
        placeholder="Template mensagem interna (cabeçalho)"
      />

      <div className="rounded-lg border border-[var(--rz-border)] p-3 space-y-3">
        <p className="text-sm font-medium">Mensagens automáticas ao cliente</p>
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
          onChange={e => updateCatalogSales({ customerRequestNewProofMessage: e.target.value })}
          placeholder="Novo comprovante — {{productName}}, {{reason}}"
        />
      </div>
    </Card>
  )
}
