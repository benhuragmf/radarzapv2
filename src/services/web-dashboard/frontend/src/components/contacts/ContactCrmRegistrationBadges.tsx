import { ClassificationBadge } from '../../lib/contactClassificationUi'

export type CrmRegistrationStatus = 'approved' | 'pending' | 'inbox_only'

const CRM_STATUS_META: Record<
  Exclude<CrmRegistrationStatus, 'approved'>,
  { label: string; className: string; title: string }
> = {
  inbox_only: {
    label: 'Só Inbox',
    className: 'bg-amber-950/50 text-amber-300/95 border-amber-800/50',
    title: 'Conversa no Inbox sem cadastro completo na base de Contatos',
  },
  pending: {
    label: 'Cadastro pendente',
    className: 'bg-sky-950/40 text-sky-300/95 border-sky-800/50',
    title: 'Aguardando aprovação ou complemento do cadastro CRM',
  },
}

export function ContactCrmRegistrationBadges({
  crmRegistrationStatus,
  contactKind,
  compact = false,
}: {
  crmRegistrationStatus?: CrmRegistrationStatus | string | null
  contactKind?: string | null
  compact?: boolean
}) {
  const status = (crmRegistrationStatus ?? 'approved') as CrmRegistrationStatus
  const crmMeta =
    status === 'inbox_only' || status === 'pending' ? CRM_STATUS_META[status] : null

  if (!crmMeta && contactKind !== 'lead') return null

  return (
    <div className={`flex flex-wrap gap-1 ${compact ? '' : 'mt-1'}`}>
      {crmMeta && (
        <ClassificationBadge
          label={crmMeta.label}
          className={crmMeta.className}
          title={crmMeta.title}
        />
      )}
      {contactKind === 'lead' && (
        <ClassificationBadge
          label="Lead"
          className="bg-violet-950/45 text-violet-300/95 border-violet-800/50"
          title="Capturado como lead — pode não aparecer em todos os filtros de Contatos"
        />
      )}
    </div>
  )
}
