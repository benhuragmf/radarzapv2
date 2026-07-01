import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Smartphone, ShieldCheck, Truck, Lock, Plus } from 'lucide-react'
import { api } from '../../lib/api'
import { can } from '../../lib/auth'
import { formatPhone } from '../../lib/destinationFormat'
import { useCatalogForm } from './CatalogFormContext'
import { SectionCard, InlineNotice, StatusBadge, inputCls, textareaCls } from '@/design-system'

interface SessionRow {
  status: 'connected' | 'disconnected' | 'connecting' | 'qr-required'
  phoneNumber?: string
  profileName?: string
  displayName?: string
}

function sessionStatusBadge(status: SessionRow['status']) {
  if (status === 'connected') return <StatusBadge status="success" text="Online" size="sm" />
  if (status === 'connecting' || status === 'qr-required')
    return <StatusBadge status="warning" text="Conectando" size="sm" />
  return <StatusBadge status="danger" text="Offline" size="sm" />
}

export function OperationalWhatsAppCards() {
  const { catalogSales, updateCatalogSales, canEditSalesWhatsapp, me } = useCatalogForm()

  const { data: sessions = [] } = useQuery<SessionRow[]>({
    queryKey: ['sessions', 'tenant'],
    queryFn: () => api.get('/sessions'),
    enabled: Boolean(me),
  })

  const connected = sessions.find(s => s.status === 'connected')
  const canManageWa = Boolean(me && can(me, 'whatsapp:session:view'))

  return (
    <div className="space-y-4">
      <SectionCard
        title="Fluxo operacional"
        description="Cliente na loja → pedido → conferência → retirada ou entrega (entregadores em breve)."
      >
        <ol className="text-sm text-[var(--rz-text-secondary)] space-y-2 list-decimal list-inside">
          <li>
            <strong className="text-[var(--rz-text-primary)]">WhatsApp da loja</strong> — cliente
            conversa, compra e envia comprovante.
          </li>
          <li>
            <strong className="text-[var(--rz-text-primary)]">Responsável pela conferência</strong>{' '}
            — recebe pedido + comprovante para validar pagamento.
          </li>
          <li>
            <strong className="text-[var(--rz-text-muted)]">Entregadores (em breve)</strong> — após
            pagamento aprovado, dados para retirada/entrega.
          </li>
        </ol>
      </SectionCard>

      <div className="grid gap-4 lg:grid-cols-3">
        <SectionCard
          title="WhatsApp da loja"
          description="Número onde o cliente conversa, reserva produto e envia comprovante."
        >
          <div className="space-y-3">
            {canManageWa ? (
              <>
                {connected ? (
                  <div className="flex flex-wrap items-center gap-2">
                    {sessionStatusBadge(connected.status)}
                    <span className="text-sm font-medium">
                      {formatPhone(connected.phoneNumber ?? '') ||
                        connected.profileName ||
                        connected.displayName ||
                        'Sessão ativa'}
                    </span>
                  </div>
                ) : (
                  <InlineNotice tone="warning" title="Nenhuma sessão conectada">
                    Conecte o WhatsApp da loja para atendimento e vendas automáticas.
                  </InlineNotice>
                )}
                <Link
                  to="/sessions"
                  className="inline-flex items-center gap-1.5 text-sm text-brand-400 hover:underline"
                >
                  <Smartphone className="w-4 h-4" />
                  Gerenciar conexão WhatsApp
                </Link>
              </>
            ) : (
              <p className="text-sm text-[var(--rz-text-muted)]">
                Sem permissão para ver sessões. Peça acesso a um administrador.
              </p>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="WhatsApp do responsável pela conferência"
          description="Recebe dados do pedido e comprovante para conferir se o pagamento caiu na conta."
        >
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={catalogSales.notifyWhatsapp === true}
                onChange={e => updateCatalogSales({ notifyWhatsapp: e.target.checked })}
              />
              Enviar comprovante para WhatsApp interno
            </label>
            <input
              className={inputCls}
              disabled={!canEditSalesWhatsapp}
              value={catalogSales.internalWhatsapp ?? ''}
              onChange={e => updateCatalogSales({ internalWhatsapp: e.target.value })}
              placeholder="WhatsApp do responsável (DDI, ex. 5566999999999)"
            />
            {!canEditSalesWhatsapp && (
              <p className="text-xs text-[var(--rz-text-muted)]">
                Alterar este número exige permissão de configuração comercial.
              </p>
            )}
            <input
              className={inputCls}
              value={catalogSales.responsibleName ?? ''}
              onChange={e => updateCatalogSales({ responsibleName: e.target.value })}
              placeholder="Nome do responsável ou setor"
            />
            <textarea
              className={`${textareaCls} min-h-[72px]`}
              value={catalogSales.internalMessageTemplate ?? ''}
              onChange={e => updateCatalogSales({ internalMessageTemplate: e.target.value })}
              placeholder="Cabeçalho da mensagem interna (dados do pedido são anexados automaticamente)"
            />
            <div className="grid gap-2 sm:grid-cols-2">
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={catalogSales.requireHumanApproval !== false}
                  onChange={e => updateCatalogSales({ requireHumanApproval: e.target.checked })}
                />
                Exigir conferência humana
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={catalogSales.escalateOnProof !== false}
                  onChange={e => updateCatalogSales({ escalateOnProof: e.target.checked })}
                />
                Escalar após comprovante
              </label>
              <label className="flex items-center gap-2 text-xs">
                <input
                  type="checkbox"
                  checked={catalogSales.allowManualResend !== false}
                  onChange={e => updateCatalogSales({ allowManualResend: e.target.checked })}
                />
                Permitir reenvio manual
              </label>
            </div>
            {!catalogSales.internalWhatsapp?.trim() && catalogSales.notifyWhatsapp && (
              <InlineNotice tone="warning" title="Número não configurado">
                Informe o WhatsApp do responsável para receber comprovantes.
              </InlineNotice>
            )}
          </div>
        </SectionCard>

        <SectionCard
          title="WhatsApp dos entregadores"
          description="Em atualização futura — cadastro de entregadores para retirada e entrega após pagamento confirmado."
          className="opacity-90"
        >
          <div className="space-y-3">
            <StatusBadge status="neutral" text="Em breve" size="sm" icon={Lock} />
            <p className="text-xs text-[var(--rz-text-muted)]">
              Nenhum envio para entregadores nesta versão. O recurso será liberado quando o fluxo
              pós-pagamento estiver completo.
            </p>
            <input className={inputCls} disabled placeholder="Nome do entregador" />
            <input className={inputCls} disabled placeholder="WhatsApp do entregador" />
            <input className={inputCls} disabled placeholder="Região / observação" />
            <label className="flex items-center gap-2 text-sm opacity-50">
              <input type="checkbox" disabled />
              Receber pedido após pagamento aprovado
            </label>
            <button
              type="button"
              disabled
              title="Recurso planejado para próxima atualização."
              className="inline-flex items-center gap-1.5 rounded-md border border-[var(--rz-border)] px-3 py-2 text-sm opacity-50 cursor-not-allowed"
            >
              <Plus className="w-4 h-4" />
              Adicionar entregador
            </button>
          </div>
        </SectionCard>
      </div>

      <InlineNotice tone="info" title="Segurança" icon={ShieldCheck}>
        Comprovantes são protegidos por autenticação. Entregadores não recebem comprovante PIX — apenas
        dados operacionais após aprovação (futuro).
      </InlineNotice>
    </div>
  )
}
