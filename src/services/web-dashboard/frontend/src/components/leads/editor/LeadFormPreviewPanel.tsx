import { useMemo, useState } from 'react'
import { ExternalLink, Monitor, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { leadFormPreviewUrl } from '@/lib/leadFormEditorUtils'
import type { LeadFormAppearance } from '@radarzap-types/lead-form'

type PreviewMode = 'desktop' | 'mobile'

type Props = {
  publicKey: string
  formName: string
  companyWebsite?: string | null
  appearance?: Pick<
    LeadFormAppearance,
    'theme' | 'size' | 'borderRadius' | 'showLogo' | 'primaryColor'
  >
  reloadKey?: number
  active?: boolean
  className?: string
}

const PREVIEW_HEIGHT = 640
const PREVIEW_HEIGHT_MOBILE = 620
const DEFAULT_SECTION = 3
const MAX_SECTION = 12

function sectionStorageKey(publicKey: string) {
  return `rz-lead-preview-section:${publicKey}`
}

function loadSection(publicKey: string): number {
  try {
    const raw = sessionStorage.getItem(sectionStorageKey(publicKey))
    if (!raw) return DEFAULT_SECTION
    const n = parseInt(raw, 10)
    return Number.isFinite(n) ? Math.max(0, Math.min(MAX_SECTION, n)) : DEFAULT_SECTION
  } catch {
    return DEFAULT_SECTION
  }
}

export function LeadFormPreviewPanel({
  publicKey,
  formName,
  companyWebsite,
  appearance,
  reloadKey = 0,
  active = true,
  className,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>('desktop')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [section, setSection] = useState(() => loadSection(publicKey))

  const usesSiteProxy = Boolean(companyWebsite?.trim())

  const href = useMemo(
    () =>
      leadFormPreviewUrl(
        publicKey,
        reloadKey || undefined,
        companyWebsite,
        section,
        appearance,
      ),
    [publicKey, reloadKey, companyWebsite, section, appearance],
  )

  const siteLabel = companyWebsite?.trim()
    ? companyWebsite.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : null

  const onSectionChange = (value: number) => {
    setSection(value)
    try {
      sessionStorage.setItem(sectionStorageKey(publicKey), String(value))
    } catch {
      /* ignore */
    }
  }

  const layoutControls = (
    <div className="space-y-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/25 p-2.5">
      <p className="text-[10px] font-medium text-[var(--rz-text-secondary)]">
        {usesSiteProxy ? 'Formulário no HTML do site (empurra de verdade)' : 'Prévia simples (sem site)'}
      </p>
      {usesSiteProxy ? (
        <label className="block text-[10px] text-[var(--rz-text-muted)]">
          Inserir após a seção nº {section} — a prévia rola até o formulário
          <input
            type="range"
            min={0}
            max={MAX_SECTION}
            step={1}
            value={section}
            onChange={e => onSectionChange(Number(e.target.value))}
            className="mt-1 w-full accent-brand-500"
          />
        </label>
      ) : (
        <p className="text-[10px] text-[var(--rz-text-muted)]">
          Cadastre o site em Configurações → Empresa para prévia com empurrão real no layout.
        </p>
      )}
      <p className="text-[9px] leading-snug text-[var(--rz-text-muted)]">
        No site publicado: snippet <code className="text-[8px]">data-container=&quot;sua-div&quot;</code>
      </p>
    </div>
  )

  const previewInner = (
    <div
      className={cn(
        'overflow-hidden rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg shadow-black/10',
        mode === 'mobile' && 'mx-auto max-w-[320px]',
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/30 px-3 py-2">
        <div className="min-w-0">
          <p className="truncate text-[10px] font-medium text-[var(--rz-text-muted)]">
            {siteLabel ? `Site real · ${siteLabel}` : 'Prévia do formulário'}
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex shrink-0 items-center gap-1 text-[10px] font-medium text-brand-400 hover:text-brand-300"
        >
          <ExternalLink className="h-3 w-3" />
          Nova aba
        </a>
      </div>
      <div
        className="relative overflow-hidden bg-[#07111f]"
        style={{ height: mode === 'mobile' ? PREVIEW_HEIGHT_MOBILE : PREVIEW_HEIGHT }}
      >
        <iframe
          key={href}
          title={`Preview ${formName}`}
          src={href}
          className="h-full w-full border-0 bg-[#07111f]"
          sandbox="allow-scripts allow-forms allow-same-origin"
        />
        {!active && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center px-3">
            <p className="rounded-lg bg-amber-500/90 px-3 py-1.5 text-center text-[10px] font-medium text-amber-950 shadow">
              Rascunho — ative em Publicar no site e Salvar para capturar leads no site
            </p>
          </div>
        )}
      </div>
    </div>
  )

  return (
    <div className={cn('space-y-2', className)}>
      <div className="hidden xl:block">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs font-semibold text-[var(--rz-text)]">Pré-visualização</p>
          <div className="flex flex-wrap gap-1">
            {(
              [
                ['desktop', Monitor, 'Desktop'],
                ['mobile', Smartphone, 'Mobile'],
              ] as const
            ).map(([id, Icon, label]) => (
              <button
                key={id}
                type="button"
                title={label}
                onClick={() => setMode(id)}
                className={cn(
                  'inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium transition-colors',
                  mode === id
                    ? 'border-brand-500/40 bg-brand-500/10 text-brand-300'
                    : 'border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]',
                )}
              >
                <Icon className="h-3 w-3" />
                <span className="hidden 2xl:inline">{label}</span>
              </button>
            ))}
          </div>
        </div>
        <p className="mt-1 text-[10px] text-[var(--rz-text-muted)]">
          {usesSiteProxy
            ? 'A prévia reflete tema, tamanho e arredondamento do rascunho — salve para publicar no site.'
            : 'Prévia básica sem o site do cliente.'}
        </p>
        <div className="mt-2">{layoutControls}</div>
      </div>

      <div className="xl:sticky xl:top-28 xl:z-20 xl:max-h-[calc(100vh-7.5rem)]">
        <div className="hidden xl:block">{previewInner}</div>
        <div className="xl:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(o => !o)}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 px-3 py-2.5 text-sm font-medium text-[var(--rz-text-secondary)]"
          >
            <ExternalLink className="h-4 w-4" />
            {mobileOpen ? 'Ocultar prévia' : 'Ver prévia do formulário'}
          </button>
          {mobileOpen && (
            <div className="mt-3 space-y-2">
              {layoutControls}
              {previewInner}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
