import { useState } from 'react'
import { X } from 'lucide-react'
import { Button } from '../ui/Button'
import { textareaCls } from '@/design-system'
import type { LeadCaptureStatus } from '@radarzap-types/lead-form'
import { LEAD_STATUS_DISPLAY } from '../../lib/leadUi'

type Props = {
  open: boolean
  status: 'lost' | 'spam'
  leadName: string
  onClose: () => void
  onConfirm: (reason: string) => void
  submitting: boolean
}

export function LeadStatusReasonModal({ open, status, leadName, onClose, onConfirm, submitting }: Props) {
  const [reason, setReason] = useState('')

  if (!open) return null

  const handleClose = () => {
    setReason('')
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rz-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold">Marcar como {LEAD_STATUS_DISPLAY[status].toLowerCase()}</h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1">Lead: {leadName}</p>
          </div>
          <button type="button" className="p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)]" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Motivo (opcional)</label>
            <textarea
              className={textareaCls}
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder={
                status === 'spam'
                  ? 'Ex.: número inválido, propaganda, bot…'
                  : 'Ex.: sem interesse, fora do perfil, concorrente…'
              }
              autoFocus
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button
              type="button"
              onClick={() => {
                onConfirm(reason.trim())
                setReason('')
              }}
              disabled={submitting}
            >
              Confirmar
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export type { LeadCaptureStatus }
