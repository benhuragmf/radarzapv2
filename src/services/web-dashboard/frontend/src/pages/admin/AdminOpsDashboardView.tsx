import { Link } from 'react-router-dom'
import { useMemo, useState, useEffect } from 'react'
import {
  Activity,
  Building2,
  Cpu,
  CreditCard,
  Database,
  Headphones,
  LayoutDashboard,
  RefreshCw,
  Server,
  Shield,
  Smartphone,
  Sparkles,
  Users,
} from 'lucide-react'
import type { AdminOpsSummary } from '@radarzap-types/admin-ops-summary'
import {
  countCriticalAlerts,
  deriveOverallStatus,
  formatOpsDate,
  formatOpsNumber,
  formatOpsUptime,
  formatOptionalMetric,
  overallStatusLabel,
  overallStatusVariant,
  sanitizeOpsDisplayText,
  serviceStatusLabel,
  serviceStatusVariant,
  sortAlertsBySeverity,
} from '@radarzap-types/admin-ops-summary.util'
import { Card } from '../../components/ui/Card'
import AdminOpsTenantsPanel from './AdminOpsTenantsPanel'
import AdminOpsSecurityPanel from './AdminOpsSecurityPanel'
import AdminOpsInfraPanel from './AdminOpsInfraPanel'
import { type AdminOpsTab } from './adminOpsTabs'
import {
  EmptyState,
  ErrorState,
  LoadingState,
  MetricCard,
  PageHeader,
  RadarPageShell,
  SectionCard,
  StatusBadge,
} from '@/design-system'

export type { AdminOpsTab } from './adminOpsTabs'

const TABS: Array<{ id: AdminOpsTab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'infra', label: 'Infra' },
  { id: 'tenants', label: 'Empresas' },
  { id: 'atendimento', label: 'Atendimento' },
  { id: 'billing', label: 'Billing' },
  { id: 'ai', label: 'IA' },
  { id: 'security', label: 'Segurança' },
  { id: 'golive', label: 'Go-live' },
]

const QUICK_LINKS: Array<{ key: keyof AdminOpsSummary['links']; label: string }> = [
  { key: 'monitoring', label: 'Monitoramento (detalhe)' },
  { key: 'errors', label: 'Erros (detalhe)' },
  { key: 'servers', label: 'Servidores (detalhe)' },
  { key: 'clients', label: 'Usuários' },
  { key: 'payments', label: 'Pagamentos' },
  { key: 'queue', label: 'Filas' },
  { key: 'aiPlatform', label: 'IA Plataforma' },
]

interface Props {
  data?: AdminOpsSummary
  isLoading: boolean
  isError: boolean
  isFetching: boolean
  onRefresh: () => void
  onRetry: () => void
  initialTab?: AdminOpsTab
}

function StatRow({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex justify-between gap-4 border-b border-[var(--rz-border)] py-2 text-sm last:border-0">
      <span className="text-[var(--rz-text-muted)]">{label}</span>
      <span className="font-medium text-[var(--rz-text-primary)] tabular-nums">{value}</span>
    </div>
  )
}

function AlertsList({ alerts }: { alerts: AdminOpsSummary['alerts'] }) {
  const sorted = sortAlertsBySeverity(alerts)
  if (!sorted.length) {
    return <EmptyState title="Nenhum alerta" description="Nenhum alerta operacional no momento." />
  }
  return (
    <ul className="space-y-2" data-testid="admin-ops-alerts">
      {sorted.map(alert => (
        <li
          key={`${alert.kind}-${alert.title}`}
          className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge
              status={
                alert.level === 'critical'
                  ? 'danger'
                  : alert.level === 'warning'
                    ? 'warning'
                    : 'info'
              }
              text={alert.level}
            />
            <span className="text-sm font-medium text-[var(--rz-text-primary)]">
              {sanitizeOpsDisplayText(alert.title)}
            </span>
          </div>
          <p className="mt-1 text-xs text-[var(--rz-text-secondary)]">
            {sanitizeOpsDisplayText(alert.message)}
          </p>
          {alert.source ? (
            <p className="mt-1 text-[10px] text-[var(--rz-text-muted)]">Origem: {alert.source}</p>
          ) : null}
        </li>
      ))}
    </ul>
  )
}

export default function AdminOpsDashboardView({
  data,
  isLoading,
  isError,
  isFetching,
  onRefresh,
  onRetry,
  initialTab,
}: Props) {
  const [tab, setTab] = useState<AdminOpsTab>(initialTab ?? 'overview')

  useEffect(() => {
    if (initialTab) setTab(initialTab)
  }, [initialTab])

  const overall = useMemo(
    () => (data ? deriveOverallStatus(data.alerts) : 'ok'),
    [data],
  )

  if (isLoading && !data) {
    return (
      <RadarPageShell maxWidth="wide">
        <PageHeader title="Admin Dashboard" subtitle="Carregando métricas operacionais…" />
        <div data-testid="admin-ops-loading">
          <LoadingState rows={6} className="pt-4" />
        </div>
      </RadarPageShell>
    )
  }

  if (isError && !data) {
    return (
      <RadarPageShell maxWidth="wide">
        <PageHeader title="Admin Dashboard" subtitle="Saúde do sistema, empresas, trial, billing e operação RadarZap" />
        <ErrorState
          title="Não foi possível carregar o Dashboard Ops."
          message="Verifique sua conexão ou permissões de staff e tente novamente."
          onRetry={onRetry}
        />
      </RadarPageShell>
    )
  }

  if (!data) {
    return (
      <RadarPageShell maxWidth="wide">
        <EmptyState title="Sem dados" description="Nenhum dado operacional disponível." action={
          <button type="button" className="text-[var(--rz-primary)] underline" onClick={onRetry}>
            Tentar novamente
          </button>
        } />
      </RadarPageShell>
    )
  }

  const waDown = data.operations.whatsapp.disconnected + data.operations.whatsapp.expired
  const ticketsOpen =
    data.operations.tickets.open +
    data.operations.tickets.inProgress +
    data.operations.tickets.clientReplied

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Admin Dashboard"
        subtitle="Saúde do sistema, empresas, trial, billing e operação RadarZap"
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status="neutral" text={`v${data.system.version}`} />
            <StatusBadge status="info" text={data.system.nodeEnv} />
            <StatusBadge status={overallStatusVariant(overall)} text={overallStatusLabel(overall)} />
            <span className="text-xs text-[var(--rz-text-muted)]" data-testid="admin-ops-generated-at">
              Atualizado: {formatOpsDate(data.generatedAt)}
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-3 py-1.5 text-xs font-medium text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]"
              onClick={onRefresh}
              disabled={isFetching}
              data-testid="admin-ops-refresh"
            >
              <RefreshCw className={`size-3.5 ${isFetching ? 'animate-spin' : ''}`} aria-hidden />
              Atualizar
            </button>
          </div>
        }
      />

      <div className="flex flex-wrap gap-2 border-b border-[var(--rz-border)] pb-3" role="tablist">
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.id
                ? 'bg-[var(--rz-primary)] text-white'
                : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-secondary)] hover:text-[var(--rz-text-primary)]'
            }`}
            onClick={() => setTab(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {(tab === 'overview' || tab === 'infra') && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-4" data-testid="admin-ops-main-cards">
          <MetricCard
            title="Status geral"
            value={overallStatusLabel(overall)}
            icon={Activity}
            status={{
              status: overallStatusVariant(overall),
              text: `${countCriticalAlerts(data.alerts)} crítico(s)`,
            }}
          />
          <MetricCard
            title="Empresas"
            value={formatOpsNumber(data.tenants.totalOrganizations)}
            description={`${formatOpsNumber(data.tenants.paidOrganizations)} pagas · ${formatOpsNumber(data.tenants.trialingOrganizations)} trialing`}
            icon={Building2}
          />
          <MetricCard
            title="WhatsApp"
            value={formatOpsNumber(data.operations.whatsapp.connected)}
            description={`${formatOpsNumber(waDown)} off/exp`}
            icon={Smartphone}
          />
          <MetricCard
            title="Atendimento"
            value={formatOpsNumber(data.operations.inbox.openConversations)}
            description={`Fila ${formatOpsNumber(data.operations.inbox.waitingQueue)} · TK ${formatOpsNumber(ticketsOpen)}`}
            icon={Headphones}
          />
          <MetricCard
            title="Leads"
            value={formatOpsNumber(data.operations.leads.leadsToday)}
            description={`Mês ${formatOpsNumber(data.operations.leads.leadsThisMonth)} · forms ${formatOpsNumber(data.operations.leads.activeForms)}`}
            icon={Users}
          />
          <MetricCard
            title="IA Créditos"
            value={formatOpsNumber(data.ai.creditsConsumedThisMonth)}
            description={`Sem crédito: ${formatOptionalMetric(data.ai.organizationsWithoutCredits)}`}
            icon={Sparkles}
          />
        </div>
      )}

      {(tab === 'overview' || tab === 'infra') && (
        <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 pt-3" data-testid="admin-ops-infra-cards">
          <MetricCard title="Sistema" value={formatOpsUptime(data.system.uptimeSeconds)} description={`Node ${data.system.nodeVersion}`} icon={Server} />
          <MetricCard title="Memória" value={`${data.system.memoryMb.heapUsed} MB`} description={`RSS ${data.system.memoryMb.rss} MB`} icon={Cpu} />
          <MetricCard
            title="Mongo"
            value={serviceStatusLabel(data.services.mongo.status)}
            description={data.services.mongo.latencyMs != null ? `${data.services.mongo.latencyMs} ms` : undefined}
            icon={Database}
            status={{ status: serviceStatusVariant(data.services.mongo.status), text: serviceStatusLabel(data.services.mongo.status) }}
          />
          <MetricCard
            title="Redis"
            value={serviceStatusLabel(data.services.redis.status)}
            description={data.services.redis.latencyMs != null ? `${data.services.redis.latencyMs} ms` : undefined}
            icon={Database}
            status={{ status: serviceStatusVariant(data.services.redis.status), text: serviceStatusLabel(data.services.redis.status) }}
          />
          <MetricCard
            title="Filas"
            value={formatOpsNumber(data.services.queues.waiting)}
            description={`Failed ${formatOpsNumber(data.services.queues.failed)} · Active ${formatOpsNumber(data.services.queues.active)}`}
            icon={LayoutDashboard}
            status={
              data.services.queues.failed > 0
                ? { status: 'danger', text: 'Atenção' }
                : { status: 'success', text: 'OK' }
            }
          />
          <MetricCard
            title="Billing"
            value={data.billing.stripeMode.toUpperCase()}
            description={`Past due ${formatOpsNumber(data.billing.pastDueOrganizations)}`}
            icon={CreditCard}
          />
        </div>
      )}

      {tab === 'overview' && (
        <div className="grid lg:grid-cols-2 gap-4 pt-4">
          <SectionCard title="Alertas operacionais" description="Ordenados por severidade">
            <AlertsList alerts={data.alerts} />
          </SectionCard>

          <SectionCard title="Status TOP 20 / QA" description="Informativo — não altera produção">
            <div className="space-y-2 text-sm" data-testid="admin-ops-top20">
              <p>
                <StatusBadge status="warning" text="PRONTO PARA QA MANUAL" />
              </p>
              <ul className="list-disc list-inside space-y-1 text-[var(--rz-text-secondary)]">
                <li>Produção estável: não declarada</li>
                <li>QA manual A–J: pendente</li>
                <li>Deploy: não executado por esta tela</li>
              </ul>
            </div>
          </SectionCard>

          <SectionCard title="Links rápidos" className="lg:col-span-2">
            <div className="flex flex-wrap gap-2">
              {QUICK_LINKS.map(link => (
                <Link
                  key={link.key}
                  to={data.links[link.key]}
                  className="rounded-lg border border-[var(--rz-border)] px-3 py-2 text-xs font-medium text-[var(--rz-primary)] hover:bg-[var(--rz-surface-muted)]"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {tab === 'infra' && (
        <div className="mt-4">
          <AdminOpsInfraPanel data={data} title="Infraestrutura detalhada" />
        </div>
      )}

      {tab === 'tenants' && <AdminOpsTenantsPanel tenants={data.tenants} />}

      {tab === 'atendimento' && (
        <div data-testid="admin-ops-atendimento" className="grid lg:grid-cols-2 gap-4 mt-4">
          <SectionCard title="WhatsApp global">
            <StatRow label="Conectadas" value={formatOpsNumber(data.operations.whatsapp.connected)} />
            <StatRow label="Desconectadas" value={formatOpsNumber(data.operations.whatsapp.disconnected)} />
            <StatRow label="Expiradas" value={formatOpsNumber(data.operations.whatsapp.expired)} />
            <StatRow label="Total sessões" value={formatOpsNumber(data.operations.whatsapp.totalSessions)} />
          </SectionCard>
          <SectionCard title="WebChat">
            <StatRow label="Widgets ativos" value={formatOpsNumber(data.operations.webchat.activeWidgets)} />
            <StatRow label="Total widgets" value={formatOpsNumber(data.operations.webchat.totalWidgets)} />
            <StatRow label="Conversas ativas" value={formatOpsNumber(data.operations.webchat.activeConversations)} />
            <StatRow label="Na fila" value={formatOpsNumber(data.operations.webchat.queuedConversations)} />
            <StatRow label="Bridge ativo" value={formatOpsNumber(data.operations.webchat.bridgeActive)} />
          </SectionCard>
          <SectionCard title="Inbox">
            <StatRow label="Conversas abertas" value={formatOpsNumber(data.operations.inbox.openConversations)} />
            <StatRow label="Fila" value={formatOpsNumber(data.operations.inbox.waitingQueue)} />
            <StatRow label="Em atendimento" value={formatOpsNumber(data.operations.inbox.inProgress)} />
            <StatRow label="Resolvidas hoje" value={formatOpsNumber(data.operations.inbox.resolvedToday)} />
          </SectionCard>
          <SectionCard title="Tickets">
            <StatRow label="Abertos" value={formatOpsNumber(data.operations.tickets.open)} />
            <StatRow label="Em progresso" value={formatOpsNumber(data.operations.tickets.inProgress)} />
            <StatRow label="Cliente respondeu" value={formatOpsNumber(data.operations.tickets.clientReplied)} />
            <StatRow label="Fechados no mês" value={formatOpsNumber(data.operations.tickets.closedThisMonth)} />
          </SectionCard>
          <SectionCard title="Leads / Formulários" className="lg:col-span-2">
            <StatRow label="Leads hoje" value={formatOpsNumber(data.operations.leads.leadsToday)} />
            <StatRow label="Leads no mês" value={formatOpsNumber(data.operations.leads.leadsThisMonth)} />
            <StatRow label="Forms ativos" value={formatOpsNumber(data.operations.leads.activeForms)} />
            <StatRow label="Total forms" value={formatOpsNumber(data.operations.leads.totalForms)} />
          </SectionCard>
        </div>
      )}

      {tab === 'billing' && (
        <div data-testid="admin-ops-billing" className="mt-4">
        <SectionCard title="Billing e Stripe">
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
            <MetricCard title="Stripe mode" value={data.billing.stripeMode.toUpperCase()} icon={CreditCard} />
            <MetricCard title="Pedidos pendentes" value={formatOpsNumber(data.billing.pendingOrders)} />
            <MetricCard title="Pagos no mês" value={formatOpsNumber(data.billing.paidOrdersThisMonth)} />
            <MetricCard title="Invoices falhas (mês)" value={formatOpsNumber(data.billing.failedInvoicesThisMonth)} />
            <MetricCard title="Orgs past due" value={formatOpsNumber(data.billing.pastDueOrganizations)} />
          </div>
          {data.billing.stripeMode === 'off' ? (
            <Card className="text-sm text-[var(--rz-text-secondary)] border-[var(--rz-info-text)]/30 bg-[var(--rz-info-bg)]">
              Stripe desligado — checkout indisponível até configurar chave válida no servidor.
            </Card>
          ) : null}
          {data.billing.stripeMode === 'live' ? (
            <Card className="text-sm text-[var(--rz-warning-text)] border-[var(--rz-warning-text)]/30 bg-[var(--rz-warning-bg)] mt-2">
              Stripe live detectado. Confirmar QA manual e webhooks antes de go-live. Não ativar live por esta tela.
            </Card>
          ) : null}
        </SectionCard>
        </div>
      )}

      {tab === 'ai' && (
        <div data-testid="admin-ops-ai" className="mt-4">
        <SectionCard title="IA — créditos e uso">
          <StatRow label="Créditos consumidos (mês)" value={formatOpsNumber(data.ai.creditsConsumedThisMonth)} />
          <StatRow label="Orgs baixo crédito" value={formatOptionalMetric(data.ai.organizationsWithLowCredits)} />
          <StatRow label="Orgs sem crédito" value={formatOptionalMetric(data.ai.organizationsWithoutCredits)} />
          <StatRow label="Chamadas premium (mês)" value={formatOpsNumber(data.ai.premiumCallsThisMonth)} />
          <StatRow label="Chamadas básica/LLM (mês)" value={formatOpsNumber(data.ai.basicLlmCallsThisMonth)} />
        </SectionCard>
        </div>
      )}

      {tab === 'security' && data && (
        <AdminOpsSecurityPanel security={data.security} alerts={data.alerts} />
      )}

      {tab === 'golive' && (
        <SectionCard title="Checklist go-live (informativo)" className="mt-4" data-testid="admin-ops-golive">
          <ul className="space-y-2 text-sm text-[var(--rz-text-secondary)]">
            <li><strong>Status:</strong> PRONTO PARA QA MANUAL</li>
            <li><strong>Produção estável:</strong> não declarada</li>
            <li><strong>Deploy:</strong> não executado por esta tela</li>
            <li><strong>QA manual A–J:</strong> pendente</li>
            <li><strong>WhatsApp real:</strong> pendente</li>
            <li><strong>Bridge real:</strong> pendente</li>
            <li><strong>Stripe live:</strong> não ativar sem autorização</li>
            <li><strong>VPS / SSL / env:</strong> pendente</li>
          </ul>
          <p className="mt-4 text-xs text-[var(--rz-text-muted)] flex items-center gap-1">
            <Shield className="size-3.5" aria-hidden />
            Esta seção é apenas visual. Nenhuma ação de produção é executada aqui.
          </p>
        </SectionCard>
      )}
    </RadarPageShell>
  )
}
