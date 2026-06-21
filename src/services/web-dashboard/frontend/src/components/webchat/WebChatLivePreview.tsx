import { ExternalLink } from 'lucide-react'
import {
  WEBCHAT_PREVIEW_TEMPLATES,
  webChatPreviewUrl,
} from '../../lib/webchatPreviewTemplates'
import { findChatBoxModel, parseChatBoxModelId } from '../../lib/chatBoxModels'

type Props = {
  publicKey: string
  selectedTemplateId: string | null
  /** Incrementar após salvar widget para recarregar config da API no iframe */
  reloadKey?: number
  /** Visualização reduzida (balão fechado) */
  compact?: boolean
  /** Modelo sendo persistido — indicador não bloqueia cliques */
  applying?: boolean
}

const CHATBOX_LIVE_PREVIEW_PATH = '/webchat/widget.html'
const PREVIEW_IFRAME_HEIGHT = 520
const PREVIEW_IFRAME_HEIGHT_COMPACT = 280
const PREVIEW_CHATBOX_EXTRA = 80

/**
 * Prévia interativa usa widget.html (widget real + API).
 * Landings preview-*.html são só decoração nos cards.
 */
export function WebChatLivePreview({
  publicKey,
  selectedTemplateId,
  reloadKey = 0,
  compact = false,
  applying = false,
}: Props) {
  const chatBoxId = parseChatBoxModelId(selectedTemplateId)
  const chatBoxModel = chatBoxId ? findChatBoxModel(chatBoxId) : null
  const landingTemplate = WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === selectedTemplateId)

  const templateName = chatBoxModel?.name ?? landingTemplate?.name ?? 'Widget'

  const iframeHeight = compact
    ? PREVIEW_IFRAME_HEIGHT_COMPACT
    : chatBoxModel
      ? Math.max(PREVIEW_IFRAME_HEIGHT, chatBoxModel.dimensions.widgetHeight + PREVIEW_CHATBOX_EXTRA)
      : PREVIEW_IFRAME_HEIGHT

  const href = webChatPreviewUrl(CHATBOX_LIVE_PREVIEW_PATH, publicKey, reloadKey || undefined)

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--rz-text)]">Pré-visualização ao vivo</p>
          <p className="text-[10px] text-[var(--rz-text-muted)]">
            {applying ? (
              'Aplicando modelo no servidor…'
            ) : (
              <>
                Modelo <span className="text-[var(--rz-text-secondary)]">{templateName}</span> — widget
                real (config salva no servidor)
              </>
            )}
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
      <div className="overflow-hidden bg-[var(--rz-surface)]" style={{ height: iframeHeight }}>
        <iframe
          key={href}
          title={`Preview WebChat — ${templateName}`}
          src={href}
          className="h-full w-full border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      </div>
    </div>
  )
}
