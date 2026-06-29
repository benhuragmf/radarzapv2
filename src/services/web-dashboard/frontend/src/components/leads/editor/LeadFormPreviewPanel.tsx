import { useCallback, useEffect, useRef, useState } from 'react'
import { ExternalLink, Monitor, RotateCcw, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils'
import { leadFormPreviewUrl } from '@/lib/leadFormEditorUtils'

type PreviewMode = 'desktop' | 'mobile'

type LayoutState = {
  slotTop: number
  bgY: number
  formX: number
}

type Props = {
  publicKey: string
  formName: string
  companyWebsite?: string | null
  reloadKey?: number
  active?: boolean
  className?: string
}

const PREVIEW_HEIGHT = 640
const PREVIEW_HEIGHT_MOBILE = 620

const DEFAULT_LAYOUT: LayoutState = { slotTop: 340, bgY: 0, formX: 50 }

export function LeadFormPreviewPanel({
  publicKey,
  formName,
  companyWebsite,
  reloadKey = 0,
  active = true,
  className,
}: Props) {
  const [mode, setMode] = useState<PreviewMode>('desktop')
  const [mobileOpen, setMobileOpen] = useState(false)
  const [layout, setLayout] = useState<LayoutState>(DEFAULT_LAYOUT)
  const iframeRef = useRef<HTMLIFrameElement>(null)

  const href = leadFormPreviewUrl(publicKey, reloadKey || undefined, companyWebsite)
  const siteLabel = companyWebsite?.trim()
    ? companyWebsite.trim().replace(/^https?:\/\//i, '').replace(/\/$/, '')
    : null

  const postLayout = useCallback((patch: Partial<LayoutState> & { reset?: boolean }) => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'rz-preview-layout', ...patch },
      window.location.origin,
    )
  }, [])

  useEffect(() => {
    postLayout(layout)
  }, [layout, href, postLayout])

  useEffect(() => {
    const onMessage = (ev: MessageEvent) => {
      if (ev.origin !== window.location.origin) return
      const data = ev.data as {
        type?: string
        slotTop?: number
        bgY?: number
        formX?: number
      }
      if (data?.type !== 'rz-preview-layout-state') return
      setLayout(prev => ({
        slotTop: typeof data.slotTop === 'number' ? data.slotTop : prev.slotTop,
        bgY: typeof data.bgY === 'number' ? data.bgY : prev.bgY,
        formX: typeof data.formX === 'number' ? data.formX : prev.formX,
      }))
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const resetLayout = () => {
    setLayout(DEFAULT_LAYOUT)
    postLayout({ reset: true })
  }

  const layoutControls = (
    <div className="space-y-2 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/25 p-2.5">
      <p className="text-[10px] font-medium text-[var(--rz-text-secondary)]">
        Formulário entre seções do site
      </p>
      <label className="block text-[10px] text-[var(--rz-text-muted)]">
        Onde entra na página ({layout.slotTop}px) — alça ↕ na prévia
        <input
          type="range"
          min={0}
          max={2400}
          step={10}
          value={layout.slotTop}
          onChange={e => setLayout(l => ({ ...l, slotTop: Number(e.target.value) }))}
          className="mt-1 w-full accent-brand-500"
        />
      </label>
      <label className="block text-[10px] text-[var(--rz-text-muted)]">
        Ajuste fino do alinhamento ({layout.bgY}px) — ou Shift+scroll na prévia
        <input
          type="range"
          min={-600}
          max={600}
          step={5}
          value={layout.bgY}
          onChange={e => setLayout(l => ({ ...l, bgY: Number(e.target.value) }))}
          className="mt-1 w-full accent-brand-500"
        />
      </label>
      <label className="block text-[10px] text-[var(--rz-text-muted)]">
        Largura / posição horizontal ({layout.formX}%)
        <input
          type="range"
          min={8}
          max={92}
          step={1}
          value={layout.formX}
          onChange={e => setLayout(l => ({ ...l, formX: Number(e.target.value) }))}
          className="mt-1 w-full accent-brand-500"
        />
      </label>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-[9px] leading-snug text-[var(--rz-text-muted)]">
          Role a prévia para ver o site acima e abaixo do formulário. No site real:{' '}
          <code className="text-[8px]">data-container=&quot;sua-div&quot;</code>
        </p>
        <button
          type="button"
          onClick={resetLayout}
          className="inline-flex items-center gap-1 rounded-md border border-[var(--rz-border)] px-2 py-1 text-[10px] text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]"
        >
          <RotateCcw className="h-3 w-3" />
          Reset
        </button>
      </div>
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
            {siteLabel ? `Inline em ${siteLabel}` : 'Prévia do formulário'}
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
        className="relative overflow-hidden bg-white"
        style={{ height: mode === 'mobile' ? PREVIEW_HEIGHT_MOBILE : PREVIEW_HEIGHT }}
      >
        <iframe
          ref={iframeRef}
          key={href}
          title={`Preview ${formName}`}
          src={href}
          onLoad={() => postLayout(layout)}
          className="h-full w-full border-0 bg-white"
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
          O formulário ocupa espaço na página. Role para baixo do form para ver o site continuando empurrado.
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
