import { useState } from 'react'
import { Plus, X } from 'lucide-react'
import { Button } from '../ui/Button'
import { inputCls, textareaCls } from '@/design-system'
import type { LeadCaptureOrigin, LeadTemperature } from '@radarchat-types/lead-form'
import { LEAD_CAPTURE_ORIGINS } from '@radarchat-types/lead-form'
import { LEAD_ORIGIN_DISPLAY } from '../../lib/leadUi'

type Props = {
  open: boolean
  onClose: () => void
  onSubmit: (payload: {
    name: string
    phone: string
    email?: string
    message?: string
    temperature?: LeadTemperature
    origin?: LeadCaptureOrigin
  }) => void
  submitting: boolean
}

export function LeadManualCaptureModal({ open, onClose, onSubmit, submitting }: Props) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [temperature, setTemperature] = useState<LeadTemperature | ''>('')
  const [origin, setOrigin] = useState<LeadCaptureOrigin>('manual')

  if (!open) return null

  const reset = () => {
    setName('')
    setPhone('')
    setEmail('')
    setMessage('')
    setTemperature('')
    setOrigin('manual')
  }

  const handleClose = () => {
    reset()
    onClose()
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit({
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim() || undefined,
      message: message.trim() || undefined,
      temperature: temperature || undefined,
      origin,
    })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl">
        <div className="flex items-start justify-between gap-3 border-b border-[var(--rz-border)] px-5 py-4">
          <div>
            <h2 className="text-base font-semibold flex items-center gap-2">
              <Plus size={16} /> Capturar lead
            </h2>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1">
              Registre uma entrada comercial manualmente.
            </p>
          </div>
          <button type="button" className="p-1.5 rounded-lg hover:bg-[var(--rz-surface-muted)]" onClick={handleClose}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-3">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Nome *</label>
            <input
              className={inputCls}
              value={name}
              onChange={e => setName(e.target.value)}
              required
              autoFocus
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Telefone *</label>
            <input
              className={inputCls}
              value={phone}
              onChange={e => setPhone(e.target.value)}
              placeholder="(11) 99999-9999"
              required
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">E-mail</label>
            <input className={inputCls} type="email" value={email} onChange={e => setEmail(e.target.value)} />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Mensagem / interesse</label>
            <textarea className={textareaCls} rows={3} value={message} onChange={e => setMessage(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Origem</label>
              <select className={inputCls} value={origin} onChange={e => setOrigin(e.target.value as LeadCaptureOrigin)}>
                {LEAD_CAPTURE_ORIGINS.filter(o => o !== 'import').map(o => (
                  <option key={o} value={o}>
                    {LEAD_ORIGIN_DISPLAY[o]}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Prioridade</label>
              <select
                className={inputCls}
                value={temperature}
                onChange={e => setTemperature(e.target.value as LeadTemperature | '')}
              >
                <option value="">—</option>
                <option value="cold">Fria</option>
                <option value="warm">Morna</option>
                <option value="hot">Quente</option>
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={handleClose} disabled={submitting}>
              Cancelar
            </Button>
            <Button type="submit" disabled={submitting || !name.trim() || !phone.trim()}>
              {submitting ? 'Salvando…' : 'Capturar'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
