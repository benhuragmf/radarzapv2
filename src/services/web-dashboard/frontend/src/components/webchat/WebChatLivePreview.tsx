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
}

/** Escala visual do iframe (1 = 100%). 0.8 = 20% menor. */
const PREVIEW_SCALE = 0.8
const PREVIEW_IFRAME_HEIGHT = 500
const PREVIEW_VIEW_HEIGHT = Math.round(PREVIEW_IFRAME_HEIGHT * PREVIEW_SCALE)

const CHATBOX_LIVE_PREVIEW_PATH = '/webchat/widget.html'

export function WebChatLivePreview({ publicKey, selectedTemplateId, reloadKey = 0 }: Props) {
  const chatBoxId = parseChatBoxModelId(selectedTemplateId)
  const chatBoxModel = chatBoxId ? findChatBoxModel(chatBoxId) : null
  const landingTemplate = WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === selectedTemplateId)

  const templatePath = chatBoxModel
    ? CHATBOX_LIVE_PREVIEW_PATH
    : landingTemplate?.path ?? '/webchat/preview-tech.html'

  const templateName = chatBoxModel?.name ?? landingTemplate?.name ?? 'Tecnológico'

  const href = webChatPreviewUrl(templatePath, publicKey, reloadKey || undefined)

  return (
    <div className="overflow-hidden rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-lg shadow-black/10">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--rz-border)] px-3 py-2">
        <div>
          <p className="text-xs font-semibold text-[var(--rz-text)]">Pré-visualização ao vivo</p>
          <p className="text-[10px] text-[var(--rz-text-muted)]">
            {chatBoxModel ? (
              <>
                Chat Box <span className="text-[var(--rz-text-secondary)]">{templateName}</span> — widget
                real com config salva
              </>
            ) : (
              <>
                Modelo <span className="text-[var(--rz-text-secondary)]">{templateName}</span> — reflete o
                widget salvo no servidor
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
