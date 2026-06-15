import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { X, Eye, Type, Users } from 'lucide-react'
import { api } from '../../lib/api'
import { Badge } from '../ui/Badge'
import { WhatsAppFormattedMessage } from './WhatsAppFormattedMessage'
import { LoadingState, ErrorState } from '@/design-system'

interface StatusViewEvent {
  jid: string
  phone?: string
  name?: string
  viewedAt: string
}

export interface StatusPostDetail {
  _id: string
  title: string
  type: 'text' | 'image'
  text?: string
  caption?: string
  backgroundColor?: string
  font?: number
  audience: string
  status: string
  scheduledFor: string
  processedAt?: string
  lastError?: string
  statusJidCount?: number
  hasImage?: boolean
  viewCount?: number
  viewEvents?: StatusViewEvent[]
}

interface Props {
  postId: string
  onClose: () => void
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

const AUDIENCE_LABEL: Record<string, string> = {
  whatsapp: 'Meu WhatsApp (padrão)',
  all_contacts: 'Contatos RadarZap',
  consented: 'Com consentimento',
}

export function StatusPostDetailModal({ postId, onClose }: Props) {
  const { data: post, isLoading, error, refetch } = useQuery<StatusPostDetail>({
    queryKey: ['status-post-detail', postId],
    queryFn: () => api.get(`/status-posts/${postId}`),
    refetchInterval: 15_000,
  })

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const displayText = post?.type === 'text' ? post.text : post?.caption

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div
        className="w-full max-w-lg rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)] shadow-xl max-h-[90vh] flex flex-col"
        role="dialog"
        aria-labelledby="status-detail-title"
      >
        <div className="flex items-center justify-between px-4 py-3 border-b border-[var(--rz-border)] shrink-0">
          <div>
            <p id="status-detail-title" className="text-sm font-medium text-[var(--rz-text-primary)]">
              {post?.title ?? 'Detalhe do status'}
            </p>
            {post?.processedAt && (
              <p className="text-xs text-[var(--rz-text-muted)]">Publicado em {formatWhen(post.processedAt)}</p>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)] hover:bg-[var(--rz-surface-muted)]"
            aria-label="Fechar"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto flex-1 p-4 space-y-4">
          {isLoading && <LoadingState rows={4} className="py-6" />}
          {error && (
            <ErrorState message={(error as Error).message} title="Erro ao carregar status" />
          )}
          {post && (
            <>
              <div className="flex flex-wrap gap-2">
                <Badge
                  label={post.type === 'image' ? 'Foto' : 'Texto'}
                  variant="blue"
                />
                <Badge label={AUDIENCE_LABEL[post.audience] ?? post.audience} variant="yellow" />
                {post.statusJidCount != null && (
                  <span className="text-xs text-[var(--rz-text-muted)] flex items-center gap-1">
                    <Users size={12} /> {post.statusJidCount} na audiência
                  </span>
                )}
              </div>

              {post.type === 'image' && post.hasImage && (
                <div className="rounded-xl overflow-hidden border border-[var(--rz-border)] bg-black/30">
                  <img
                    src={`/api/status-posts/${post._id}/media`}
                    alt=""
                    className="w-full max-h-72 object-contain mx-auto"
                  />
                </div>
              )}

              {post.type === 'text' && (
                <div
                  className="rounded-xl p-6 text-center min-h-[120px] flex items-center justify-center"
                  style={{ backgroundColor: post.backgroundColor ?? '#FFFCF5' }}
                >
                  <p
                    className={`text-base leading-relaxed ${
                      post.backgroundColor === '#1F2C34' ? 'text-white' : 'text-[var(--rz-on-light-surface)]'
                    }`}
                  >
                    {displayText ? (
                      <WhatsAppFormattedMessage text={displayText} />
                    ) : (
                      <span className="opacity-50">Sem texto</span>
                    )}
                  </p>
                </div>
              )}

              {post.type === 'image' && displayText && (
                <div className="rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)] p-3">
                  <p className="text-xs text-[var(--rz-text-muted)] mb-1 flex items-center gap-1">
                    <Type size={12} /> Legenda
                  </p>
                  <p className="text-sm text-[var(--rz-text-primary)]">
                    <WhatsAppFormattedMessage text={displayText} />
                  </p>
                </div>
              )}

              {post.lastError && (
                <p className="text-sm text-red-400">{post.lastError}</p>
              )}

              <div>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-medium text-[var(--rz-text-secondary)] flex items-center gap-1.5">
                    <Eye size={14} /> Quem visualizou ({post.viewCount ?? 0})
                  </p>
                  <button
                    type="button"
                    onClick={() => void refetch()}
                    className="text-[11px] text-brand-400 hover:underline"
                  >
                    Atualizar
                  </button>
                </div>
                {(post.viewEvents?.length ?? 0) === 0 ? (
                  <p className="text-xs text-[var(--rz-text-muted)] leading-relaxed">
                    Nenhuma visualização registrada ainda. O WhatsApp envia confirmações ao longo
                    do dia — mantenha a sessão conectada para capturar quem abriu.
                  </p>
                ) : (
                  <ul className="space-y-1.5 max-h-40 overflow-y-auto">
                    {[...(post.viewEvents ?? [])]
                      .sort(
                        (a, b) =>
                          new Date(b.viewedAt).getTime() - new Date(a.viewedAt).getTime(),
                      )
                      .map(v => (
                        <li
                          key={v.jid}
                          className="flex items-center justify-between text-xs py-1.5 px-2 rounded-lg bg-[var(--rz-surface-muted)]/80"
                        >
                          <span className="text-[var(--rz-text-primary)]">
                            {v.name || v.phone || v.jid.replace(/@.*/, '')}
                          </span>
                          <span className="text-[var(--rz-text-muted)] shrink-0 ml-2">
                            {formatWhen(v.viewedAt)}
                          </span>
                        </li>
                      ))}
                  </ul>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
