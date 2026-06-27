import { Calendar, CheckCircle, Clock, Send, XCircle } from 'lucide-react'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { Card } from '../ui/Card'
import { WhatsAppPreviewBubble } from '../platform/WhatsAppPreviewBubble'
import { inputCls } from '@/design-system'
import {
  formatDuration,
  campaignDelayOptionLabel,
  campaignDelayJitterHint,
  snapCampaignDelayMs,
} from '../../lib/limits'

type Priority = 'high' | 'medium' | 'low'

const labelCls = 'text-xs text-[var(--rz-text-muted)] mb-1 block'

interface Props {
  selectedTotal: number
  selectedContacts: number
  selectedGroups: number
  scheduleMode: boolean
  onScheduleModeChange: (scheduled: boolean) => void
  sendAtLocal: string
  onSendAtLocalChange: (value: string) => void
  minSendAtLocal: string
  priority: Priority
  onPriorityChange: (priority: Priority) => void
  delayMs: number
  onDelayMsChange: (ms: number) => void
  delayOptions: number[]
  durationEst: number
  delayConfig?: import('../../lib/limits').CampaignDelaysUiConfig
  acceptWhatsAppRisk: boolean
  riskAcknowledged: boolean
  marketingPerMinute?: number | null
  humanizeEnabled?: boolean
  policyJitterHint?: string | null
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
  onScheduleModeChange,
  sendAtLocal,
  onSendAtLocalChange,
  minSendAtLocal,
  priority,
  onPriorityChange,
  delayMs,
  onDelayMsChange,
  delayOptions,
  durationEst,
  delayConfig,
  acceptWhatsAppRisk,
  riskAcknowledged,
  marketingPerMinute,
  humanizeEnabled,
  policyJitterHint,
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
    <aside className="w-full xl:w-[min(100%,380px)] xl:shrink-0 xl:sticky xl:top-4 xl:self-start">
      <div className="space-y-4 xl:max-h-[calc(100dvh-6.5rem)] xl:overflow-y-auto">
      <Card className="space-y-4">
        <h2 className="text-sm font-medium text-[var(--rz-text-secondary)]">Quando enviar</h2>

        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onScheduleModeChange(false)}
            className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
              !scheduleMode
                ? 'border-brand-500 bg-brand-600/20 text-white'
                : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
            }`}
          >
            <Send size={14} className="inline mr-1.5" />
            Enviar agora
          </button>
          <button
            type="button"
            onClick={() => onScheduleModeChange(true)}
            className={`flex-1 py-2.5 rounded-lg text-sm border transition-colors ${
              scheduleMode
                ? 'border-brand-500 bg-brand-600/20 text-white'
                : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-[var(--rz-border)]'
            }`}
          >
            <Calendar size={14} className="inline mr-1.5" />
            Agendar
          </button>
        </div>

        {scheduleMode && (
          <div>
            <label className={labelCls}>Data e horário</label>
            <input
              type="datetime-local"
              value={sendAtLocal}
              min={minSendAtLocal}
              onChange={e => onSendAtLocalChange(e.target.value)}
              className={inputCls}
            />
            <p className="text-[11px] text-[var(--rz-text-muted)] mt-1">
              Data e hora devem ser no futuro.
            </p>
          </div>
        )}

        <div>
          <label className={labelCls}>Prioridade na fila</label>
          <select
            value={priority}
            onChange={e => onPriorityChange(e.target.value as Priority)}
            className={inputCls}
          >
            <option value="high">Alta</option>
            <option value="medium">Média</option>
            <option value="low">Baixa</option>
          </select>
        </div>

        <div>
          <label className={labelCls}>
            {acceptWhatsAppRisk ? 'Intervalo entre destinos' : 'Intervalo entre destinos (modo protegido)'}
          </label>
          <select
            value={delayMs}
            onChange={e => onDelayMsChange(Number(e.target.value))}
            className={inputCls}
          >
            {delayOptions.map(ms => (
              <option key={ms} value={ms}>
                {campaignDelayOptionLabel(ms, acceptWhatsAppRisk, delayConfig)}
              </option>
            ))}
          </select>
          <p className="text-[10px] text-[var(--rz-text-muted)] mt-1 leading-relaxed">
            {acceptWhatsAppRisk
              ? 'Modo sem proteção — ignora fila humanizada e limites por minuto. Risco alto de banimento.'
              : `Modo protegido: 1 mensagem por vez, respeitando marketing${
                  marketingPerMinute != null ? ` (${marketingPerMinute} msg/min)` : ''
                }${humanizeEnabled ? ' + digitação simulada' : ''}. ${
                  campaignDelayJitterHint(delayMs, delayConfig) ?? policyJitterHint ?? ''
                }`}
          </p>
        </div>
      </Card>

      <Card className="space-y-4">
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
              <strong className="text-[var(--rz-text-muted)]">Prioridade:</strong>{' '}
              {priority === 'high' ? 'Alta' : priority === 'medium' ? 'Média' : 'Baixa'}
            </li>
            <li>
              <strong className="text-[var(--rz-text-muted)]">Intervalo:</strong>{' '}
              {campaignDelayOptionLabel(
                snapCampaignDelayMs(delayMs, acceptWhatsAppRisk, delayConfig),
                acceptWhatsAppRisk,
                delayConfig,
              )}
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
    </aside>
  )
}
