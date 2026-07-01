export type InboxMessageMediaType = 'image' | 'audio' | 'video' | 'document' | 'sticker' | 'location'

export interface InboxMessageView {
  _id: string
  direction: 'inbound' | 'outbound' | 'system' | 'internal'
  body: string
  mediaType?: InboxMessageMediaType
  mediaUrl?: string
  mediaSrc?: string
  mediaMime?: string
  locationLat?: number
  locationLng?: number
  createdAt: string
  senderName?: string
  authorUserName?: string
  deliveredAt?: string
  readAt?: string
}

function MessageReceiptTicks({
  deliveredAt,
  readAt,
  light,
}: {
  deliveredAt?: string
  readAt?: string
  light?: boolean
}) {
  if (!deliveredAt && !readAt) return null
  const read = Boolean(readAt)
  const color = read ? (light ? '#bfdbfe' : '#38bdf8') : light ? 'rgba(255,255,255,0.65)' : 'var(--rz-text-muted)'
  return (
    <span className="inline-flex items-center ml-1 align-middle" aria-label={read ? 'Lida' : 'Entregue'}>
      <svg width="16" height="11" viewBox="0 0 16 11" fill="none" aria-hidden="true">
        <path
          d="M1 5.5L3.5 8L7 3"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M5.5 5.5L8 8L14 2"
          stroke={color}
          strokeWidth="1.2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  )
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

function googleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`
}

function InboxLocationCard({
  lat,
  lng,
  label,
}: {
  lat: number
  lng: number
  label?: string
}) {
  const coords = `${lat.toFixed(6)}, ${lng.toFixed(6)}`
  const copyCoords = () => {
    void navigator.clipboard?.writeText(coords)
  }
  return (
    <div className="rounded-lg border border-emerald-700/40 bg-emerald-950/20 p-3 mb-2 space-y-2 text-xs">
      <p className="font-medium text-emerald-100">📍 Localização do cliente</p>
      {label?.trim() ? (
        <p className="text-[var(--rz-text-muted)] whitespace-pre-wrap break-words">{label}</p>
      ) : null}
      <p className="text-[var(--rz-text-muted)] font-mono">{coords}</p>
      <div className="flex flex-wrap gap-2">
        <a
          href={googleMapsUrl(lat, lng)}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center justify-center rounded-md border border-[var(--rz-border)] px-2.5 py-1 hover:bg-[var(--rz-surface-muted)]"
        >
          Abrir no Google Maps
        </a>
        <button
          type="button"
          onClick={copyCoords}
          className="inline-flex items-center justify-center rounded-md border border-[var(--rz-border)] px-2.5 py-1 hover:bg-[var(--rz-surface-muted)]"
        >
          Copiar coordenadas
        </button>
      </div>
    </div>
  )
}

interface Props {
  message: InboxMessageView
}

export function InboxMessageBubble({ message: m }: Props) {
  const isOut = m.direction === 'outbound'
  const isInternal = m.direction === 'internal'
  const isSystem = m.direction === 'system'
  const mediaSrc = m.mediaSrc ?? (m.mediaUrl ? inboxMediaSrc(m.mediaUrl) : null)
  const authorLabel = m.senderName || m.authorUserName

  return (
    <div
      className={`flex ${isInternal ? 'justify-center' : isOut ? 'justify-end' : isSystem ? 'justify-center' : 'justify-start'}`}
    >
      <div
        className={`max-w-[min(85%,420px)] ${isSystem || isInternal ? 'w-full max-w-full' : ''}`}
      >
        {isInternal && (
          <p className="text-[10px] font-semibold uppercase tracking-wide text-amber-500/90 text-center mb-1">
            Chat interno{authorLabel ? ` · ${authorLabel}` : ''}
          </p>
        )}
        <div
          className={`rounded-2xl px-3.5 py-2.5 text-sm whitespace-pre-wrap break-words shadow-sm ${
            isInternal
              ? 'bg-amber-500/10 text-[var(--rz-text-primary)] border border-amber-500/35 rounded-xl'
              : isOut
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

          {(m.mediaType === 'location' || (m.locationLat != null && m.locationLng != null)) &&
          m.locationLat != null &&
          m.locationLng != null ? (
            <InboxLocationCard lat={m.locationLat} lng={m.locationLng} label={m.body} />
          ) : null}

          {m.body?.trim() && m.mediaType !== 'location' ? <span>{m.body}</span> : null}
        </div>
        {!isSystem && (
          <p
            className={`text-[10px] text-[var(--rz-text-muted)] mt-1 px-1 tabular-nums flex items-center gap-0.5 ${
              isOut ? 'justify-end' : 'justify-start'
            }`}
            title={new Date(m.createdAt).toLocaleString('pt-BR')}
          >
            <span>{formatInboxMsgTime(m.createdAt, false)}</span>
            {isOut && <MessageReceiptTicks deliveredAt={m.deliveredAt} readAt={m.readAt} light={isOut} />}
          </p>
        )}
      </div>
    </div>
  )
}
