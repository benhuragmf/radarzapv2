export type InboxMessageMediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker'

export interface InboxMessageView {
  _id: string
  direction: 'inbound' | 'outbound' | 'system'
  body: string
  mediaType?: InboxMessageMediaType
  mediaUrl?: string
  mediaSrc?: string
  mediaMime?: string
  createdAt: string
}

export function formatInboxMsgTime(iso: string, withSeconds = true) {
  const d = new Date(iso)
  const today = new Date()
  const sameDay =
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  const timeOpts: Intl.DateTimeFormatOptions = withSeconds
    ? { hour: '2-digit', minute: '2-digit', second: '2-digit' }
    : { hour: '2-digit', minute: '2-digit' }
  if (sameDay) return d.toLocaleTimeString('pt-BR', timeOpts)
  return d.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...timeOpts,
  })
}

export function inboxMediaSrc(mediaUrl: string): string {
  const [clientId, filename] = mediaUrl.split('/')
  return `/api/inbox/media/${encodeURIComponent(clientId)}/${encodeURIComponent(filename)}`
}

interface Props {
  message: InboxMessageView
}

export function InboxMessageBubble({ message: m }: Props) {
  const isOut = m.direction === 'outbound'
  const isSystem = m.direction === 'system'
  const mediaSrc = m.mediaSrc ?? (m.mediaUrl ? inboxMediaSrc(m.mediaUrl) : null)

  return (
    <div
      className={`flex ${isOut ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'}`}
    >
      <div className={`max-w-[min(85%,420px)] ${isSystem ? 'w-full max-w-full' : ''}`}>
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm ${
            isOut
              ? 'bg-brand-600/90 text-white rounded-br-md'
              : isSystem
                ? 'bg-[var(--rz-surface-muted)]/40 text-[var(--rz-text-muted)] text-xs text-center border border-[var(--rz-border)]/60 rounded-xl py-2'
                : 'bg-[var(--rz-surface-muted)]/90 text-[var(--rz-text-primary)] rounded-bl-md border border-[var(--rz-border)]/50'
          }`}
        >
          {m.mediaType === 'image' || m.mediaType === 'sticker' ? (
            mediaSrc ? (
              <a href={mediaSrc} target="_blank" rel="noreferrer" className="block mb-1">
                <img
                  src={mediaSrc}
                  alt={m.body}
                  className="max-w-full max-h-64 rounded-lg object-contain"
                />
              </a>
            ) : null
          ) : null}

          {m.mediaType === 'video' && mediaSrc ? (
            <video
              src={mediaSrc}
              controls
              className="max-w-full max-h-64 rounded-lg mb-1"
              preload="metadata"
            />
          ) : null}

          {m.mediaType === 'audio' && mediaSrc ? (
            <audio src={mediaSrc} controls className="w-full min-w-[220px] mb-1" preload="metadata" />
          ) : null}

          {m.mediaType === 'document' && mediaSrc ? (
            <a
              href={mediaSrc}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex items-center gap-1 text-xs underline mb-1 ${isOut ? 'text-white/90' : 'text-brand-400'}`}
            >
              📎 Baixar documento
            </a>
          ) : null}

          {m.body?.trim() ? <span>{m.body}</span> : null}
        </div>
        {!isSystem && (
          <p
            className={`text-[10px] text-[var(--rz-text-muted)] mt-1 px-1 tabular-nums ${
              isOut ? 'text-right' : 'text-left'
            }`}
            title={new Date(m.createdAt).toLocaleString('pt-BR')}
          >
            {formatInboxMsgTime(m.createdAt, true)}
          </p>
        )}
      </div>
    </div>
  )
}
