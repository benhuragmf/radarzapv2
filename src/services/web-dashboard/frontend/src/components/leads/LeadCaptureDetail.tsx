import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button } from '../ui/Button'
import { Badge } from '../ui/Badge'
import { Card } from '../ui/Card'
import {
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Phone,
  Search,
  Trash2,
  UserCheck,
  UserPlus,
} from 'lucide-react'
import { inputCls, textareaCls } from '@/design-system'
import { notifySuccess } from '../../lib/notify'
import type { LeadCaptureListItem, LeadCaptureStatus } from '@radarzap-types/lead-form'
import {
  LEAD_CAPTURE_ORIGIN_LABEL,
  LEAD_CAPTURE_STATUS_LABEL,
  LEAD_CAPTURE_STATUS_VARIANT,
  LEAD_CAPTURE_STATUSES,
} from '@radarzap-types/lead-form'

function waLink(phone: string) {
  const digits = phone.replace(/\D/g, '')
  if (!digits || phone.startsWith('email:')) return null
  return `https://wa.me/${digits}`
}

const HISTORY_LABEL: Record<string, string> = {
  captured: 'Capturado',
  status_changed: 'Status',
  linked_contact: 'Vínculo',
  converted: 'Conversão',
  sent_to_inbox: 'Inbox',
  added_to_list: 'Lista',
  note: 'Nota',
}

export function LeadCaptureDetail({
  item,
  canManage,
  canReply,
  contactGroups,
  onUpdate,
  onOpenInbox,
  onConvert,
  onAddToGroups,
  onDelete,
  openingInbox,
  converting,
  pending,
}: {
  item: LeadCaptureListItem
  canManage: boolean
  canReply: boolean
  contactGroups: { id: string; name: string }[]
  onUpdate: (patch: { status?: LeadCaptureStatus; internalNotes?: string }) => void
  onOpenInbox: () => void
  onConvert: (opts: { contactGroupIds?: string[]; linkExistingId?: string }) => void
  onAddToGroups: (groupIds: string[]) => void
  onDelete: () => void
  openingInbox: boolean
  converting: boolean
  pending: boolean
}) {
  const [notes, setNotes] = useState(item.internalNotes ?? '')
  const [selectedGroups, setSelectedGroups] = useState<string[]>(item.contactGroupIds ?? [])
  const wa = waLink(item.phone)

  return (
    <Card className="space-y-4 max-h-[calc(100vh-12rem)] overflow-y-auto">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">{item.name}</h2>
          <p className="text-sm text-[var(--rz-text-muted)]">
            {item.formName} · {LEAD_CAPTURE_ORIGIN_LABEL[item.origin]} ·{' '}
            {new Date(item.createdAt).toLocaleString('pt-BR')}
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
          <Badge
            label={LEAD_CAPTURE_STATUS_LABEL[item.status]}
            variant={LEAD_CAPTURE_STATUS_VARIANT[item.status]}
          />
          {item.possibleDuplicate && <Badge label="Possível duplicado" variant="yellow" />}
          {item.consentAccepted === true && <Badge label="Consentimento OK" variant="green" />}
          {item.consentAccepted === false && <Badge label="Sem consentimento" variant="gray" />}
        </div>
      </div>

      {item.duplicateHints && item.duplicateHints.length > 0 && (
        <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3 space-y-2 text-sm">
          <p className="flex items-center gap-1.5 font-medium text-yellow-700 dark:text-yellow-400">
            <AlertTriangle size={14} /> Possível duplicado detectado
          </p>
          {item.duplicateHints.map(h => (
            <div key={`${h.kind}-${h.id}`} className="flex flex-wrap items-center justify-between gap-2">
              <span>
                {h.kind === 'contact' ? 'Contato existente' : 'Outro lead'}: {h.name ?? h.phone ?? h.email}
              </span>
              {canManage && h.kind === 'contact' && (
                <Button
                  size="sm"
                  variant="secondary"
                  disabled={converting}
                  onClick={() => onConvert({ linkExistingId: h.id })}
                >
                  Vincular
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      <dl className="grid sm:grid-cols-2 gap-3 text-sm">
        <div>
          <dt className="text-[var(--rz-text-muted)]">Telefone</dt>
          <dd className="font-medium">{item.phone.startsWith('email:') ? '—' : item.phone}</dd>
        </div>
        {item.email && (
          <div>
            <dt className="text-[var(--rz-text-muted)]">E-mail</dt>
            <dd>{item.email}</dd>
          </div>
        )}
        {item.pageTitle && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">Página</dt>
            <dd>{item.pageTitle}</dd>
          </div>
        )}
        {item.sourceUrl && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">URL de origem</dt>
            <dd className="truncate">
              <a href={item.sourceUrl} target="_blank" rel="noreferrer" className="text-[var(--rz-primary)] hover:underline">
                {item.sourceUrl}
              </a>
            </dd>
          </div>
        )}
        {item.utm && Object.values(item.utm).some(Boolean) && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">UTM</dt>
            <dd className="text-xs font-mono">
              {[item.utm.source, item.utm.medium, item.utm.campaign].filter(Boolean).join(' · ')}
            </dd>
          </div>
        )}
        {item.contactGroupNames && item.contactGroupNames.length > 0 && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">Listas</dt>
            <dd className="flex flex-wrap gap-1 mt-1">
              {item.contactGroupNames.map(n => (
                <Badge key={n} label={n} variant="purple" />
              ))}
            </dd>
          </div>
        )}
        {item.assignedUserName && (
          <div>
            <dt className="text-[var(--rz-text-muted)]">Responsável</dt>
            <dd>{item.assignedUserName}</dd>
          </div>
        )}
        {item.message && (
          <div className="sm:col-span-2">
            <dt className="text-[var(--rz-text-muted)]">Mensagem</dt>
            <dd className="whitespace-pre-wrap">{item.message}</dd>
          </div>
        )}
        {item.metadata &&
          Object.entries(item.metadata)
            .filter(([k]) => k !== 'pageTitle')
            .map(([k, v]) => (
              <div key={k} className="sm:col-span-2">
                <dt className="text-[var(--rz-text-muted)]">{k}</dt>
                <dd className="whitespace-pre-wrap">{v}</dd>
              </div>
            ))}
      </dl>

      <div className="flex flex-wrap gap-2">
        {canReply &&
          (item.inboxConversationId ? (
            <Link
              to={`/platform/inbox?conv=${encodeURIComponent(item.inboxConversationId)}`}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-primary)] bg-[var(--rz-primary)]/10 text-[var(--rz-primary)]"
            >
              <MessageSquare size={14} /> Continuar no Inbox
            </Link>
          ) : (
            <Button size="sm" disabled={openingInbox} onClick={onOpenInbox}>
              <UserPlus size={14} /> Iniciar atendimento
            </Button>
          ))}
        {canManage && item.status !== 'converted' && (
          <Button size="sm" variant="secondary" disabled={converting} onClick={() => onConvert({ contactGroupIds: selectedGroups })}>
            <UserCheck size={14} /> Converter em contato
          </Button>
        )}
        {wa && (
          <a
            href={wa}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]"
          >
            <MessageSquare size={14} /> WhatsApp
          </a>
        )}
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]"
          onClick={() => {
            void navigator.clipboard.writeText(item.phone.startsWith('email:') ? (item.email ?? '') : item.phone)
            notifySuccess('Copiado')
          }}
        >
          <Phone size={14} /> Copiar contato
        </button>
        {item.destinationId && (
          <Link to={`/contact?search=${encodeURIComponent(item.phone)}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]">
            <ExternalLink size={14} /> Ver contato
          </Link>
        )}
        <Link to={`/platform/inbox?search=${encodeURIComponent(item.phone)}`} className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg border border-[var(--rz-border)]">
          <Search size={14} /> Buscar no Inbox
        </Link>
        {canManage && (
          <Button size="sm" variant="secondary" className="text-red-600" onClick={onDelete}>
            <Trash2 size={14} /> Excluir
          </Button>
        )}
      </div>

      {canManage && contactGroups.length > 0 && (
        <div>
          <label className="text-xs text-[var(--rz-text-muted)]">Adicionar em lista</label>
          <div className="flex flex-wrap gap-2 mt-2">
            {contactGroups.map(g => (
              <label key={g.id} className="flex items-center gap-1.5 text-xs border border-[var(--rz-border)] rounded px-2 py-1">
                <input
                  type="checkbox"
                  checked={selectedGroups.includes(g.id)}
                  onChange={e => {
                    setSelectedGroups(prev =>
                      e.target.checked ? [...prev, g.id] : prev.filter(id => id !== g.id),
                    )
                  }}
                />
                {g.name}
              </label>
            ))}
          </div>
          <Button size="sm" className="mt-2" variant="secondary" disabled={pending} onClick={() => onAddToGroups(selectedGroups)}>
            Salvar listas
          </Button>
        </div>
      )}

      {canManage && (
        <>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Status</label>
            <select
              className={inputCls + ' mt-1'}
              value={item.status}
              disabled={pending}
              onChange={e => onUpdate({ status: e.target.value as LeadCaptureStatus })}
            >
              {LEAD_CAPTURE_STATUSES.map(s => (
                <option key={s} value={s}>
                  {LEAD_CAPTURE_STATUS_LABEL[s]}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Observações internas</label>
            <textarea className={textareaCls + ' mt-1'} rows={3} value={notes} onChange={e => setNotes(e.target.value)} />
            <Button size="sm" className="mt-2" disabled={pending} onClick={() => onUpdate({ internalNotes: notes })}>
              Salvar observações
            </Button>
          </div>
        </>
      )}

      {item.history && item.history.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold mb-2">Histórico</h3>
          <ul className="space-y-2 text-xs">
            {[...item.history].reverse().map((h, i) => (
              <li key={i} className="flex gap-2 text-[var(--rz-text-secondary)]">
                <span className="text-[var(--rz-text-muted)] whitespace-nowrap">
                  {new Date(h.at).toLocaleString('pt-BR')}
                </span>
                <span className="font-medium">{HISTORY_LABEL[h.kind] ?? h.kind}:</span>
                <span>{h.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Card>
  )
}
