import { ExternalLink } from 'lucide-react'
import {
  WEBCHAT_PREVIEW_TEMPLATES,
  webChatPreviewUrl,
} from '../../lib/webchatPreviewTemplates'

type Props = {
  publicKey: string
  selectedTemplateId: string | null
  /** Incrementar após salvar widget para recarregar config da API no iframe */
  reloadKey?: number
}

/** Escala visual do iframe (1 = 100%). 0.8 = 20% menor. */
const PREVIEW_SCALE = 0.8
const PREVIEW_IFRAME_HEIGHT = 500
const PREVIEW_VIEW_HEIGHT = Math.round(PREVIEW_IFRAME_HEIGHT * PREVIEW_SCALE)

export function WebChatLivePreview({ publicKey, selectedTemplateId, reloadKey = 0 }: Props) {
  const templatePath =
    WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === selectedTemplateId)?.path ??
    '/webchat/preview-tech.html'
  const href = webChatPreviewUrl(templatePath, publicKey, reloadKey || undefined)
  const templateName =
    WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === selectedTemplateId)?.name ?? 'Tecnológico'

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--rz-text)]">Pré-visualização ao vivo</p>
          <p className="text-[10px] text-[var(--rz-text-muted)]">
            Modelo <span className="text-[var(--rz-text-secondary)]">{templateName}</span> — reflete o
            widget salvo no servidor
          </p>
        </div>
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] font-medium text-brand-400 hover:text-brand-300"
        >
          <ExternalLink className="h-3 w-3" />
          Nova aba
        </a>
      </div>
      <div className="overflow-hidden bg-[var(--rz-surface)]" style={{ height: PREVIEW_VIEW_HEIGHT }}>
        <div
          className="origin-top-left"
          style={{
            transform: `scale(${PREVIEW_SCALE})`,
            width: `${100 / PREVIEW_SCALE}%`,
            height: PREVIEW_IFRAME_HEIGHT,
          }}
        >
          <iframe
            key={href}
            title={`Preview WebChat — ${templateName}`}
            src={href}
            className="w-full border-0 bg-white"
            style={{ height: PREVIEW_IFRAME_HEIGHT }}
            sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          />
        </div>
      </div>
    </div>
  )
}
