import {
  Copy,
  ExternalLink,
  Save,
  Trash2,
  AlertCircle,
  CopyPlus,
} from 'lucide-react'
import { Button } from '../../ui/Button'
import { cn } from '@/lib/utils'
import { formatEmbedAllowedSitesSummary } from '@/lib/embedAllowedDomains'

type Props = {
  title: string
  internalName: string
  publicKey: string
  active: boolean
  allowedDomains: string[]
  includeCompanyWebsite: boolean
  companyWebsite?: string
  isDirty: boolean
  previewUrl: string
  snippet: string
  saving?: boolean
  duplicating?: boolean
  deleting?: boolean
  onSave: () => void
  onDelete: () => void
  onDuplicate?: () => void
  onCopyScript: () => void
  validationErrors?: string[]
}

export function WebChatWidgetEditorHeader({
  title,
  internalName,
  publicKey,
  active,
  allowedDomains,
  includeCompanyWebsite,
  companyWebsite,
  isDirty,
  previewUrl,
  saving,
  duplicating,
  deleting,
  onSave,
  onDelete,
  onDuplicate,
  onCopyScript,
  validationErrors = [],
}: Props) {
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
            <h2 className="text-base font-semibold text-[var(--rz-text-primary)] truncate">
              {title || internalName}
            </h2>
            <span
              className={cn(
                'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide',
                active
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25'
                  : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)] border border-[var(--rz-border)]',
              )}
            >
              {active ? 'Ativo' : 'Inativo'}
            </span>
            {isDirty && (
              <span className="inline-flex items-center gap-1 rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-[10px] font-medium text-amber-400">
                <AlertCircle className="h-3 w-3" />
                Alterações não salvas
              </span>
            )}
          </div>
          <div className="mt-1.5 flex flex-col gap-0.5 text-xs text-[var(--rz-text-muted)]">
            <span>
              Nome interno:{' '}
              <span className="text-[var(--rz-text-secondary)]">{internalName}</span>
            </span>
            <span className="font-mono text-[10px] sm:text-xs break-all">{publicKey}</span>
            <span>
              Sites permitidos:{' '}
              <span className="text-[var(--rz-text-secondary)]">{domainsPreview}</span>
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button type="button" size="sm" onClick={onSave} disabled={saving || !isDirty}>
            <Save className="h-4 w-4" />
            {saving ? 'Salvando…' : 'Salvar'}
          </Button>
          <a href={previewUrl} target="_blank" rel="noreferrer">
            <Button type="button" variant="secondary" size="sm">
              <ExternalLink className="h-4 w-4" />
              Testar widget
            </Button>
          </a>
          <Button type="button" variant="secondary" size="sm" onClick={onCopyScript}>
            <Copy className="h-4 w-4" />
            <span className="hidden sm:inline">Copiar script</span>
          </Button>
          {onDuplicate && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onDuplicate}
              disabled={duplicating}
            >
              <CopyPlus className="h-4 w-4" />
              <span className="hidden sm:inline">Duplicar</span>
            </Button>
          )}
          <Button variant="danger" size="sm" type="button" onClick={onDelete} disabled={deleting}>
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {validationErrors.length > 0 && (
        <div className="rounded-lg border border-amber-500/25 bg-amber-500/5 px-3 py-2 text-xs text-amber-200">
          <p className="font-medium">Revise antes de salvar:</p>
          <ul className="mt-1 list-inside list-disc space-y-0.5 text-amber-200/90">
            {validationErrors.map(err => (
              <li key={err}>{err}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
