import { useState } from 'react'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Check, Copy, Trash2, History, RotateCcw, ShieldOff } from 'lucide-react'
import {
  ConsentBadge,
  ConsentDot,
  CONSENT_STATUS_META,
  effectiveConsentStatus,
  type ConsentStatus,
} from './consentUi'

export interface Destination {
  _id: string
  name: string
  identifier: string
  type: 'contact' | 'group'
  isActive: boolean
  lastMessageSent?: string
  consentStatus?: ConsentStatus
  pendingOutboundCount?: number
  consent?: { granted?: boolean }
}

export const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

export function avatarLabel(name: string) {
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=1f2937&color=4ade80&size=48&bold=true`
}

export function formatPhone(id: string) {
  const digits = id.replace(/\D/g, '')
  if (digits.length >= 12 && digits.startsWith('55')) {
    return `+${digits.slice(0, 2)} (${digits.slice(2, 4)}) ${digits.slice(4, 9)}-${digits.slice(9)}`
  }
  return id
}

function CopyBtn({ text }: { text: string }) {
  const [ok, setOk] = useState(false)
  return (
    <button
      type="button"
      title="Copiar"
      onClick={() => {
        navigator.clipboard.writeText(text)
        setOk(true)
        setTimeout(() => setOk(false), 1500)
      }}
      className="text-gray-600 hover:text-gray-300 transition-colors p-1"
    >
      {ok ? <Check size={14} className="text-brand-500" /> : <Copy size={14} />}
    </button>
  )
}

export function DestinationRow({
  d,
  onRemove,
  removing,
  onRequestRenewal,
  onClearRefusal,
  onShowHistory,
  canRequestRenewal,
  canClearRefusal,
  canDelete,
  requestingRenewal,
  clearingRefusal,
}: {
  d: Destination
  onRemove: () => void
  removing: boolean
  onRequestRenewal?: () => void
  onClearRefusal?: () => void
  onShowHistory?: () => void
  canRequestRenewal?: boolean
  canClearRefusal?: boolean
  canDelete?: boolean
  requestingRenewal?: boolean
  clearingRefusal?: boolean
}) {
  const consentSt =
    d.type === 'contact'
      ? effectiveConsentStatus(d.consentStatus, d.consent?.granted)
      : null

  return (
    <div
      className="flex items-center gap-4 py-3 px-4 rounded-lg bg-gray-800/50 border border-gray-800 hover:border-gray-700 transition-colors"
      style={
        consentSt
          ? {
              borderLeftWidth: 4,
              borderLeftColor: CONSENT_STATUS_META[consentSt].color,
            }
          : undefined
      }
    >
      <img src={avatarLabel(d.name)} alt="" className="w-11 h-11 rounded-full shrink-0" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-medium text-white truncate">{d.name}</p>
          {consentSt && <ConsentBadge status={consentSt} />}
          {consentSt === 'PENDING' && (d.pendingOutboundCount ?? 0) > 0 && (
            <span className="text-[10px] text-yellow-600/90">
              {d.pendingOutboundCount}/{3} tentativas
            </span>
          )}
        </div>
        <p className="text-xs text-gray-500 font-mono truncate">
          {d.type === 'contact' ? formatPhone(d.identifier) : d.identifier}
        </p>
        {d.lastMessageSent && (
          <p className="text-[11px] text-gray-600 mt-0.5">
            Último envio: {new Date(d.lastMessageSent).toLocaleString('pt-BR')}
          </p>
        )}
      </div>
      <Badge label={d.type === 'contact' ? 'contato' : 'grupo'} variant={d.type === 'contact' ? 'blue' : 'green'} />
      {onShowHistory && d.type === 'contact' && (
        <button
          type="button"
          title="Histórico de consentimento"
          onClick={onShowHistory}
          className="text-gray-600 hover:text-brand-400 transition-colors p-1"
        >
          <History size={16} />
        </button>
      )}
      {canRequestRenewal &&
        onRequestRenewal &&
        consentSt &&
        consentSt !== 'ACCEPTED' &&
        consentSt !== 'REFUSED_THREE' &&
        consentSt !== 'MANUALLY_BLOCKED' &&
        (consentSt.startsWith('REFUSED') ||
          (consentSt === 'PENDING' && (d.pendingOutboundCount ?? 0) >= 3)) && (
          <Button
            size="sm"
            variant="secondary"
            disabled={requestingRenewal}
            onClick={onRequestRenewal}
            title="Solicita aprovação do dono da empresa"
          >
            <RotateCcw size={12} /> Novo aceite
          </Button>
        )}
      {canClearRefusal && onClearRefusal && (consentSt === 'REFUSED_FIRST' || consentSt === 'REFUSED_SECOND') && (
        <Button
          size="sm"
          variant="secondary"
          disabled={clearingRefusal}
          onClick={onClearRefusal}
          title="Apenas o dono pode apagar a recusa"
        >
          <ShieldOff size={12} /> Apagar recusa
        </Button>
      )}
      <CopyBtn text={d.identifier} />
      {canDelete !== false && (
        <button
          type="button"
          disabled={removing}
          onClick={() => {
            if (window.confirm(`Remover "${d.name}"?`)) onRemove()
          }}
          className="text-gray-600 hover:text-red-400 transition-colors shrink-0 disabled:opacity-50"
        >
          <Trash2 size={16} />
        </button>
      )}
    </div>
  )
}

export { ConsentDot, effectiveConsentStatus }
