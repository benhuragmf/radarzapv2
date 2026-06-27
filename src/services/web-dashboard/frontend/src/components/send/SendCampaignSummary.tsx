import { Calendar, CheckCircle, Clock, Send, XCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Card } from '../ui/Card'
import { WhatsAppPreviewBubble } from '../platform/WhatsAppPreviewBubble'
import { formatDuration } from '../../lib/limits'

interface Props {
  selectedTotal: number
  selectedContacts: number
  selectedGroups: number
  scheduleMode: boolean
  sendAtLocal: string
  delayMs: number
  minDelay: number
  durationEst: number
  acceptWhatsAppRisk: boolean
  riskAcknowledged: boolean
  billingLine?: string
  previewText: string
  showPreview: boolean
  blockers: string[]
  canSubmit: boolean
  isPending: boolean
  onSubmit: () => void
  result: { success: boolean; message: string } | null
}

export function SendCampaignSummary({
  selectedTotal,
  selectedContacts,
  selectedGroups,
  scheduleMode,
  sendAtLocal,
  delayMs,
  minDelay,
  durationEst,
  acceptWhatsAppRisk,
  riskAcknowledged,
  billingLine,
  previewText,
  showPreview,
  blockers,
  canSubmit,
  isPending,
  onSubmit,
  result,
}: Props) {
  return (
    <div className="space-y-4">
      <Card className="sticky top-4 space-y-4">
        <div>
          <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Resumo</h2>
          <div className="grid grid-cols-3 gap-2 mb-4">
            <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 px-2 py-2 text-center">
              <p className="text-lg font-semibold text-[var(--rz-text-primary)] tabular-nums">
                {selectedTotal || '—'}
              </p>
              <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wide">Total</p>
            </div>
            <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 px-2 py-2 text-center">
              <p className="text-lg font-semibold text-blue-400 tabular-nums">
                {selectedContacts || '—'}
              </p>
              <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wide">Contatos</p>
            </div>
            <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/50 px-2 py-2 text-center">
              <p className="text-lg font-semibold text-brand-400 tabular-nums">
                {selectedGroups || '—'}
              </p>
              <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wide">Grupos</p>
            </div>
          </div>

          <ul className="text-xs text-[var(--rz-text-muted)] space-y-2">
            <li>
              <strong className="text-[var(--rz-text-muted)]">Modo:</strong>{' '}
              {scheduleMode ? `Agendado (${sendAtLocal.replace('T', ' ')})` : 'Imediato'}
            </li>
            <li>
              <strong className="text-[var(--rz-text-muted)]">Intervalo:</strong>{' '}
              {Math.max(minDelay, delayMs) / 1000}s
              {selectedTotal > 1 && (
                <span className="text-[var(--rz-text-muted)]"> · {formatDuration(durationEst)} total</span>
              )}
            </li>
            <li>
              <strong className="text-[var(--rz-text-muted)]">Proteção:</strong>{' '}
              {acceptWhatsAppRisk && riskAcknowledged ? (
                <span className="text-red-400">desativada (risco aceito)</span>
              ) : (
                <span className="text-brand-400">ativa — fila segura</span>
              )}
            </li>
            {billingLine && (
              <li>
                <strong className="text-[var(--rz-text-muted)]">Plano hoje:</strong> {billingLine}
              </li>
            )}
          </ul>
        </div>

        {showPreview && previewText.trim() && (
          <div className="border-t border-[var(--rz-border)] pt-3">
            <p className="text-[10px] uppercase tracking-wider text-[var(--rz-text-muted)] mb-2">
              Prévia WhatsApp
            </p>
            <div className="rounded-xl bg-[#0b141a] p-3 border border-[var(--rz-border)]">
              <WhatsAppPreviewBubble text={previewText} />
            </div>
          </div>
        )}

        {blockers.length > 0 && !isPending && (
          <ul className="text-[11px] text-amber-400/95 space-y-1 border border-amber-800/30 rounded-lg px-3 py-2 bg-amber-950/15">
            {blockers.map(b => (
              <li key={b} className="flex items-start gap-1.5">
                <span className="shrink-0">•</span>
                <span>{b}</span>
              </li>
            ))}
          </ul>
        )}

        <Button
          onClick={onSubmit}
          disabled={!canSubmit || isPending}
          className="w-full justify-center"
        >
          {isPending ? (
            <Spinner size={14} />
          ) : scheduleMode ? (
            <Calendar size={14} />
          ) : (
            <Send size={14} />
          )}
          {isPending
            ? 'Processando...'
            : scheduleMode
              ? 'Agendar envio'
              : `Enviar para ${selectedTotal} destino(s)`}
        </Button>
      </Card>

      {result && (
        <Card
          className={`flex items-start gap-3 ${result.success ? 'border-green-800' : 'border-red-800'}`}
        >
          {result.success ? (
            <CheckCircle size={18} className="text-green-400 shrink-0" />
          ) : (
            <XCircle size={18} className="text-red-400 shrink-0" />
          )}
          <p className="text-sm">{result.message}</p>
        </Card>
      )}

      <Card className="text-xs text-[var(--rz-text-muted)] space-y-1.5">
        <p className="flex items-center gap-1.5 text-[var(--rz-text-muted)] font-medium">
          <Clock size={12} /> Dicas rápidas
        </p>
        <p>• Um clique em <strong className="text-[var(--rz-text-secondary)]">Selecionar todos aceitos</strong> marca quem pode receber.</p>
        <p>• Grupos WA: importe pela sessão conectada antes de enviar.</p>
        <p>• Velocidade real = lotes da campanha + limites em Limites de envio.</p>
      </Card>
    </div>
  )
}
