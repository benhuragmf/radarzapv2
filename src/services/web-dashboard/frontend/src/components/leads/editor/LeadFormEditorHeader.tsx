import { AlertCircle, Copy, CopyPlus, ExternalLink, Save, Trash2 } from 'lucide-react'
import { Button } from '../../ui/Button'
import { cn } from '@/lib/utils'
import { formatEmbedAllowedSitesSummary } from '@/lib/embedAllowedDomains'
import { leadFormPreviewUrl } from '@/lib/leadFormEditorUtils'

type Props = {
  title: string
  internalName: string
  publicKey: string
  active: boolean
  onActiveChange?: (active: boolean) => void
  allowedDomains: string[]
  includeCompanyWebsite: boolean
  companyWebsite?: string
  isDirty: boolean
  saving?: boolean
  duplicating?: boolean
  deleting?: boolean
  previewReloadKey?: number
  onSave: () => void
  onDelete: () => void
  onDuplicate?: () => void
  onCopyScript: () => void
}

export function LeadFormEditorHeader({
  title,
  internalName,
  publicKey,
  active,
  onActiveChange,
  allowedDomains,
  includeCompanyWebsite,
  companyWebsite,
  isDirty,
  saving,
  duplicating,
  deleting,
  previewReloadKey,
  onSave,
  onDelete,
  onDuplicate,
  onCopyScript,
}: Props) {
  const previewUrl = leadFormPreviewUrl(publicKey, previewReloadKey, companyWebsite)
  const domainsPreview = formatEmbedAllowedSitesSummary(
    allowedDomains,
    includeCompanyWebsite,
    companyWebsite,
  )

  return (
    <div className="space-y-3 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/15 px-4 py-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="truncate text-base font-semibold text-[var(--rz-text-primary)]">
              {title || internalName}
            </h2>
            <span
              className={cn(
                'inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                active
                  ? 'border-emerald-500/25 bg-emerald-500/15 text-emerald-400'
                  : 'border-amber-500/30 bg-amber-500/10 text-amber-400',
              )}
            >
              {active ? 'Ativo' : 'Inativo'}
            </span>
            {onActiveChange ? (
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] px-2.5 py-1 text-xs font-medium text-[var(--rz-text-secondary)]">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-[var(--rz-border)]"
                  checked={active}
                  onChange={e => onActiveChange(e.target.checked)}
                />
                Publicar no site
              </label>
            ) : null}
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Alterações não salvas
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-[var(--rz-text-muted)]">
            <span>
              Nome interno: <span className="text-[var(--rz-text-secondary)]">{internalName}</span>
            </span>
            <span className="font-mono text-[10px]">{publicKey}</span>
            <span>
              Sites permitidos:{' '}
              <span className="text-[var(--rz-text-secondary)]">{domainsPreview}</span>
            </span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !isDirty}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          <a href={previewUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
              Testar formulário
            </Button>
          </a>
          <Button type="button" variant="secondary" size="sm" onClick={onCopyScript}>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copiar script</span>
          </Button>
          {onDuplicate ? (
            <Button type="button" variant="secondary" size="sm" disabled={duplicating} onClick={onDuplicate}>
              <CopyPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>
          ) : null}
          <Button variant="danger" size="sm" type="button" onClick={onDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>
      {!active && onActiveChange ? (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Marque <strong>Publicar no site</strong> ao lado do título e clique <strong>Salvar</strong> para
          o formulário aceitar envios no site. A prévia lateral já mostra o layout mesmo inativo.
        </div>
      ) : null}
    </div>
  )
}
