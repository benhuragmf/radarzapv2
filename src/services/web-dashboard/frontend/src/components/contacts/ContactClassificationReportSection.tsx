import { Link } from 'react-router-dom'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api, downloadFile } from '../../lib/api'
import { Card } from '../ui/Card'
import { Button } from '../ui/Button'
import { LoadingState } from '@/design-system'
import {
  CONTACT_KIND_LABELS,
  CONTACT_ORIGIN_LABELS,
  SEND_PERMISSION_LABELS,
  TEMPERATURE_LABELS,
  COMMERCIAL_STATUS_LABELS,
  PHONE_QUALITY_LABELS,
} from '../../lib/contactClassificationUi'
import type { ContactClassificationFilterKey } from './ContactClassificationFilterBar'
import { RefreshCw, Sparkles, Download } from 'lucide-react'
import { mutationError, notifySuccess, notifyError } from '../../lib/notify'

interface ClassificationStats {
  totalContacts: number
  campaignSelectable: number
  campaignBlocked: number
  backfillPending: number
  smartSegments: Array<{ id: string; label: string; description: string; count: number }>
  byKind: Record<string, number>
  byPermission: Record<string, number>
  byOrigin: Record<string, number>
  byTemperature: Record<string, number>
  byCommercialStatus: Record<string, number>
  byPhoneQuality: Record<string, number>
}

const PRESET_CONTACT_CLASS: Partial<Record<string, ContactClassificationFilterKey>> = {
  opt_in_leads: 'opt_in',
  active_clients: 'client',
  hot_leads: 'hot',
  pending_consent: 'pending',
  blocked_send: 'blocked',
}

function BreakdownTable({
  title,
  rows,
  labelFor,
  linkFor,
}: {
  title: string
  rows: Array<{ key: string; count: number }>
  labelFor: (key: string) => string
  linkFor?: (key: string) => string | null
}) {
  if (rows.length === 0) return null
  return (
    <div className="rounded-lg border border-[var(--rz-border)]/80 overflow-hidden">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--rz-text-muted)] px-3 py-2 bg-[var(--rz-surface-muted)]/40 border-b border-[var(--rz-border)]/60">
        {title}
      </p>
      <table className="w-full text-xs">
        <tbody>
          {rows.map(({ key, count }) => {
            const href = linkFor?.(key)
            const inboxHref =
              href?.startsWith('/contact?class=') ?
                href.replace('/contact?', '/platform/inbox?')
              : null
            return (
              <tr key={key} className="border-b border-[var(--rz-border)]/40 last:border-0">
                <td className="px-3 py-2 text-[var(--rz-text-secondary)]">
                  {href ? (
                    <span className="inline-flex flex-wrap items-center gap-x-2 gap-y-0.5">
                      <Link to={href} className="text-[var(--rz-primary)] hover:underline">
                        {labelFor(key)}
                      </Link>
                      {inboxHref ? (
                        <Link
                          to={inboxHref}
                          className="text-[10px] text-[var(--rz-text-muted)] hover:text-[var(--rz-primary)] hover:underline"
                        >
                          Inbox
                        </Link>
                      ) : null}
                    </span>
                  ) : (
                    labelFor(key)
                  )}
                </td>
                <td className="px-3 py-2 text-right tabular-nums font-medium">{count}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

function sortedEntries(map: Record<string, number>) {
  return Object.entries(map)
    .filter(([, n]) => n > 0)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({ key, count }))
}

export function ContactClassificationReportSection() {
  const qc = useQueryClient()
  const [exporting, setExporting] = useState<'summary' | 'contacts' | null>(null)

  const { data: stats, isLoading } = useQuery<ClassificationStats>({
    queryKey: ['destinations-classification-stats'],
    queryFn: () => api.get('/destinations/classification-stats'),
  })

  const backfill = useMutation({
    mutationFn: () =>
      api.post<{ ok: boolean; scanned: number; updated: number; pending: number }>(
        '/destinations/backfill-classification',
        { limit: 500, dryRun: false },
      ),
    onSuccess: res => {
      void qc.invalidateQueries({ queryKey: ['destinations-classification-stats'] })
      void qc.invalidateQueries({ queryKey: ['classification-backfill-status'] })
      void qc.invalidateQueries({ queryKey: ['destinations'] })
      notifySuccess(
        res.updated > 0
          ? `${res.updated} contato(s) classificado(s). Restam ${res.pending} pendentes.`
          : `Nenhuma alteração (${res.scanned} analisados).`,
      )
    },
    onError: mutationError,
  })

  if (isLoading) return <LoadingState rows={4} />

  if (!stats || stats.totalContacts === 0) {
    return (
      <Card className="text-center py-10 text-sm text-[var(--rz-text-muted)]">
        <Sparkles size={28} className="mx-auto mb-3 opacity-40" />
        Nenhum contato cadastrado para gerar relatório de classificação.
        <div className="mt-3">
          <Link to="/contact" className="text-[var(--rz-primary)] hover:underline text-xs">
            Ir para Contatos
          </Link>
        </div>
      </Card>
    )
  }

  const selectablePct = Math.round((stats.campaignSelectable / stats.totalContacts) * 100)

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2 justify-end">
        <Button
          size="sm"
          variant="secondary"
          disabled={exporting !== null}
          onClick={async () => {
            setExporting('summary')
            try {
              await downloadFile('/destinations/classification-stats/export-csv')
            } catch (e) {
              notifyError((e as Error).message)
            } finally {
              setExporting(null)
            }
          }}
        >
          <Download size={14} />
          {exporting === 'summary' ? 'Exportando…' : 'CSV resumo'}
        </Button>
        <Button
          size="sm"
          variant="secondary"
          disabled={exporting !== null}
          onClick={async () => {
            setExporting('contacts')
            try {
              await downloadFile('/destinations/classification-export-csv')
            } catch (e) {
              notifyError((e as Error).message)
            } finally {
              setExporting(null)
            }
          }}
        >
          <Download size={14} />
          {exporting === 'contacts' ? 'Exportando…' : 'CSV contatos + classificação'}
        </Button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 border-[var(--rz-border)]/80">
          <p className="text-[10px] text-[var(--rz-text-muted)]">Total contatos</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.totalContacts}</p>
        </Card>
        <Card className="p-3 border-[var(--rz-border)]/80">
          <p className="text-[10px] text-[var(--rz-text-muted)]">Elegíveis campanha</p>
          <p className="text-2xl font-semibold tabular-nums text-emerald-500">
            {stats.campaignSelectable}
          </p>
          <p className="text-[10px] text-[var(--rz-text-muted)]">{selectablePct}% da base</p>
        </Card>
        <Card className="p-3 border-[var(--rz-border)]/80">
          <p className="text-[10px] text-[var(--rz-text-muted)]">Bloqueados campanha</p>
          <p className="text-2xl font-semibold tabular-nums text-amber-500">
            {stats.campaignBlocked}
          </p>
          <Link to="/contact?class=blocked" className="text-[10px] text-[var(--rz-primary)] hover:underline">
            Contatos
          </Link>
          <span className="text-[10px] text-[var(--rz-text-muted)]"> · </span>
          <Link to="/platform/inbox?class=blocked" className="text-[10px] text-[var(--rz-text-muted)] hover:underline">
            Inbox
          </Link>
        </Card>
        <Card className="p-3 border-[var(--rz-border)]/80">
          <p className="text-[10px] text-[var(--rz-text-muted)]">Sem campos salvos</p>
          <p className="text-2xl font-semibold tabular-nums">{stats.backfillPending}</p>
          {stats.backfillPending > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 px-2 text-[10px] mt-1"
              disabled={backfill.isPending}
              onClick={() => backfill.mutate()}
            >
              <RefreshCw size={12} className={backfill.isPending ? 'animate-spin' : ''} />
              Classificar lote
            </Button>
          )}
        </Card>
      </div>

      {stats.smartSegments.length > 0 && (
        <div>
          <p className="text-xs font-medium text-[var(--rz-text-secondary)] mb-2">Segmentos dinâmicos</p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
            {stats.smartSegments.map(seg => {
              const classKey = PRESET_CONTACT_CLASS[seg.id]
              return (
                <Card key={seg.id} className="p-3 border-[var(--rz-border)]/80 flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">{seg.label}</p>
                    <p className="text-[10px] text-[var(--rz-text-muted)] leading-snug">{seg.description}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-semibold tabular-nums">{seg.count}</p>
                    <div className="flex flex-col gap-0.5 items-end">
                      {classKey && (
                        <>
                          <Link
                            to={`/contact?class=${classKey}`}
                            className="text-[10px] text-[var(--rz-primary)] hover:underline"
                          >
                            Contatos
                          </Link>
                          <Link
                            to={`/platform/inbox?class=${classKey}`}
                            className="text-[10px] text-[var(--rz-text-muted)] hover:underline"
                          >
                            Inbox
                          </Link>
                        </>
                      )}
                      <Link
                        to="/platform/segmentos"
                        className="text-[10px] text-[var(--rz-text-muted)] hover:underline"
                      >
                        Segmentos
                      </Link>
                    </div>
                  </div>
                </Card>
              )
            })}
          </div>
        </div>
      )}

      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
        <BreakdownTable
          title="Por tipo"
          rows={sortedEntries(stats.byKind)}
          labelFor={k => CONTACT_KIND_LABELS[k as keyof typeof CONTACT_KIND_LABELS] ?? k}
          linkFor={k =>
            ['lead', 'client', 'prospect'].includes(k) ? `/contact?class=${k}` : null
          }
        />
        <BreakdownTable
          title="Por permissão LGPD"
          rows={sortedEntries(stats.byPermission)}
          labelFor={k => SEND_PERMISSION_LABELS[k as keyof typeof SEND_PERMISSION_LABELS] ?? k}
          linkFor={k => {
            if (k === 'opt_in_accepted') return '/contact?class=opt_in'
            if (k === 'pending') return '/contact?class=pending'
            return null
          }}
        />
        <BreakdownTable
          title="Por origem"
          rows={sortedEntries(stats.byOrigin)}
          labelFor={k => CONTACT_ORIGIN_LABELS[k as keyof typeof CONTACT_ORIGIN_LABELS] ?? k}
        />
        <BreakdownTable
          title="Por temperatura"
          rows={sortedEntries(stats.byTemperature)}
          labelFor={k => TEMPERATURE_LABELS[k as keyof typeof TEMPERATURE_LABELS] ?? k}
          linkFor={k =>
            k === 'hot' || k === 'warm' ? '/contact?class=hot' : null
          }
        />
        <BreakdownTable
          title="Por funil comercial"
          rows={sortedEntries(stats.byCommercialStatus)}
          labelFor={k =>
            COMMERCIAL_STATUS_LABELS[k as keyof typeof COMMERCIAL_STATUS_LABELS] ?? k
          }
        />
        <BreakdownTable
          title="Qualidade do telefone"
          rows={sortedEntries(stats.byPhoneQuality)}
          labelFor={k => PHONE_QUALITY_LABELS[k as keyof typeof PHONE_QUALITY_LABELS] ?? k}
        />
      </div>
    </div>
  )
}
