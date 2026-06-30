import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import { Badge } from '../../components/ui/Badge'
import {
  Circle,
  Image as ImageIcon,
  Type,
  Calendar,
  Clock,
  Send,
  Trash2,
  AlertCircle,
  Smartphone,
  ChevronRight,
  Eye,
} from 'lucide-react'
import {
  clampDatetimeLocal,
  minDatetimeLocalFromNow,
  validateFutureSchedule,
} from '../../lib/schedule-time'
import { WhatsAppTextEditor } from '../../components/whatsapp/WhatsAppTextEditor'
import { StatusImageUpload } from '../../components/whatsapp/StatusImageUpload'
import { StatusPostDetailModal } from '../../components/whatsapp/StatusPostDetailModal'
import { statusFontPreviewClass, type WaStatusFont } from '../../lib/whatsapp-status-fonts'
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
import { WA_STATUS_COLORS, waStatusPreviewTextClass } from '../../lib/wa-status-colors'
import { RadarPageShell, PageHeader, inputCls, LoadingState } from '@/design-system'

type StatusType = 'text' | 'image'
type StatusAudience = 'whatsapp' | 'all_contacts' | 'consented'

interface StatusPost {
  _id: string
  title: string
  type: StatusType
  text?: string
  caption?: string
  backgroundColor?: string
  font?: number
  audience: StatusAudience
  status: 'pending' | 'processing' | 'sent' | 'failed'
  scheduledFor: string
  processedAt?: string
  lastError?: string
  statusJidCount?: number
  hasImage?: boolean
  viewCount?: number
  createdAt: string
}

const STATUS_COLORS = WA_STATUS_COLORS

const STATUS_LABEL: Record<StatusPost['status'], string> = {
  pending: 'Agendado',
  processing: 'Publicando…',
  sent: 'Publicado',
  failed: 'Falhou',
}

const STATUS_BADGE: Record<StatusPost['status'], 'yellow' | 'blue' | 'green' | 'red'> = {
  pending: 'yellow',
  processing: 'blue',
  sent: 'green',
  failed: 'red',
}

function defaultScheduleLocal(): string {
  const d = new Date()
  d.setMinutes(d.getMinutes() + 30)
  d.setSeconds(0, 0)
  const pad = (n: number) => String(n).padStart(2, '0')
  const raw = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
  return clampDatetimeLocal(raw, minDatetimeLocalFromNow())
}

function formatWhen(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

export default function WaStatusPosts() {
  const qc = useQueryClient()

  const [title, setTitle] = useState('')
  const [statusType, setStatusType] = useState<StatusType>('text')
  const [text, setText] = useState('')
  const [caption, setCaption] = useState('')
  const [imageData, setImageData] = useState<string | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [backgroundColor, setBackgroundColor] = useState<string>(STATUS_COLORS[0].value)
  const [font, setFont] = useState<WaStatusFont>(0)
  const [audience, setAudience] = useState<StatusAudience>('whatsapp')
  const [scheduleMode, setScheduleMode] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleLocal)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)
  const [detailPostId, setDetailPostId] = useState<string | null>(null)

  const minSendAtLocal = useMemo(() => minDatetimeLocalFromNow(), [scheduleMode])

  const { data: sessions = [] } = useQuery<Array<{ status: string }>>({
    queryKey: ['sessions'],
    queryFn: () => api.get('/sessions'),
    refetchInterval: 15_000,
  })
  const waConnected = sessions.some(s => s.status === 'connected')

  const { data: audiencePreview } = useQuery<{
    count: number
    waCache: number
    deviceListPhones: number
    radarchatContacts: number
  }>({
    queryKey: ['status-posts-audience', audience],
    queryFn: () => api.get(`/status-posts/audience-preview?audience=${audience}`),
    enabled: waConnected && audience !== 'whatsapp',
    refetchInterval: 30_000,
  })

  const { data: posts = [], isLoading } = useQuery<StatusPost[]>({
    queryKey: ['status-posts'],
    queryFn: () => api.get('/status-posts'),
    refetchInterval: query => {
      const list = query.state.data ?? []
      const active = list.some(p => p.status === 'pending' || p.status === 'processing')
      return active ? 3_000 : 15_000
    },
  })

  const queue = posts.filter(p => p.status === 'pending' || p.status === 'processing')
  const history = posts.filter(p => p.status === 'sent' || p.status === 'failed')

  const createPost = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.post<{
        ok: boolean
        status: string
        queued?: boolean
        lastError?: string
        statusJidCount?: number
      }>('/status-posts', payload),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ['status-posts'] })
      qc.invalidateQueries({ queryKey: ['status-posts-audience'] })
      if (res.queued) {
        setResult({
          ok: true,
          message:
            'Status na fila — publicando agora. Acompanhe abaixo; quando aparecer "Publicado", confira em Atualizações no WhatsApp.',
        })
      } else if (res.status === 'pending') {
        setResult({ ok: true, message: 'Status agendado com sucesso.' })
      } else if (res.status === 'sent') {
        const n = res.statusJidCount
        setResult({
          ok: true,
          message:
            n != null
              ? `Status publicado (${n} contato(s) na lista de visualização). Confira em Atualizações no WhatsApp.`
              : 'Status publicado no WhatsApp. Confira em Atualizações no app.',
        })
      } else if (res.status === 'failed') {
        setResult({ ok: false, message: res.lastError ?? 'Falha ao publicar.' })
      } else {
        setResult({ ok: true, message: 'Status em processamento.' })
      }
      setTitle('')
      setText('')
      setCaption('')
      setImageData(null)
      setImagePreview(null)
    },
    onError: (err: Error) => setResult({ ok: false, message: err.message }),
  })

  const cancelPost = useMutation({
    mutationFn: (id: string) => api.delete(`/status-posts/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['status-posts'] }),
    onError: mutationError,
  })

  const onPickImage = (dataUrl: string | null, preview: string | null) => {
    setImageData(dataUrl)
    setImagePreview(preview)
  }

  const handleSubmit = () => {
    setResult(null)
    const t = title.trim()
    if (!t) {
      setResult({ ok: false, message: 'Informe um título interno (só para você organizar).' })
      return
    }

    let sendAt: string | null = null
    if (scheduleMode) {
      const scheduleErr = validateFutureSchedule(sendAtLocal)
      if (scheduleErr) {
        setResult({ ok: false, message: scheduleErr })
        return
      }
      sendAt = new Date(sendAtLocal).toISOString()
    } else if (!waConnected) {
      setResult({
        ok: false,
        message: 'WhatsApp desconectado — conecte em Sessões ou agende para mais tarde.',
      })
      return
    }

    if (statusType === 'text' && !text.trim()) {
      setResult({ ok: false, message: 'Escreva o texto do status.' })
      return
    }
    if (statusType === 'image' && !imageData) {
      setResult({ ok: false, message: 'Selecione uma imagem.' })
      return
    }

    createPost.mutate({
      title: t,
      type: statusType,
      text: statusType === 'text' ? text.trim() : caption.trim() || undefined,
      image: statusType === 'image' ? imageData : undefined,
      caption: statusType === 'image' ? caption.trim() || undefined : undefined,
      backgroundColor: statusType === 'text' ? backgroundColor : undefined,
      font: statusType === 'text' ? font : undefined,
      audience,
      sendAt,
    })
  }

  const previewTextStyle =
    waStatusPreviewTextClass(backgroundColor)

  return (
    <RadarPageShell maxWidth="wide">
      <PageHeader
        title="Publicar status WhatsApp"
        subtitle="Poste texto ou foto no seu status (stories), como no app do WhatsApp. Agendamentos são processados pelo servidor a cada ~15 s — não precisa manter esta página aberta."
      />

      {!waConnected && (
        <Card className="border-amber-900/40 bg-amber-950/20 flex gap-3 items-start">
          <AlertCircle size={18} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="text-sm text-amber-200/90">
            WhatsApp desconectado.{' '}
            <Link to="/sessions" className="text-brand-400 hover:underline">
              Conecte em Sessões
            </Link>{' '}
            para publicar agora, ou agende para quando estiver online.
          </div>
        </Card>
      )}

      <div className="grid lg:grid-cols-2 gap-6">
        <Card className="space-y-4">
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Título interno</label>
            <input
              className={inputCls}
              placeholder="Ex.: Promoção sexta"
              value={title}
              onChange={e => setTitle(e.target.value)}
              maxLength={120}
            />
          </div>

          <div className="flex gap-2">
            <Button
              size="sm"
              variant={statusType === 'text' ? 'primary' : 'secondary'}
              onClick={() => setStatusType('text')}
            >
              <Type size={14} /> Texto
            </Button>
            <Button
              size="sm"
              variant={statusType === 'image' ? 'primary' : 'secondary'}
              onClick={() => setStatusType('image')}
            >
              <ImageIcon size={14} /> Foto
            </Button>
          </div>

          {statusType === 'text' ? (
            <>
              <WhatsAppTextEditor
                label={
                  <label className="text-xs text-[var(--rz-text-muted)] block">
                    Texto ({text.length}/700)
                  </label>
                }
                value={text}
                onChange={v => setText(v.slice(0, 700))}
                maxLength={700}
                rows={5}
                minHeight="120px"
                placeholder="O que você quer publicar no status?"
                showPreview
                showFontPicker
                font={font}
                onFontChange={setFont}
              />
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Cor de fundo</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setBackgroundColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        backgroundColor === c.value ? 'border-brand-400' : 'border-[var(--rz-border)]'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Imagem do status</label>
                <StatusImageUpload
                  preview={imagePreview}
                  onChange={onPickImage}
                  onError={msg => setResult({ ok: false, message: msg })}
                />
              </div>
              <WhatsAppTextEditor
                label={
                  <label className="text-xs text-[var(--rz-text-muted)] block">
                    Legenda opcional ({caption.length}/700)
                  </label>
                }
                value={caption}
                onChange={v => setCaption(v.slice(0, 700))}
                maxLength={700}
                rows={3}
                placeholder="Legenda da foto"
                showHint={false}
              />
            </>
          )}

          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Quem pode ver</label>
            <select
              className={inputCls}
              value={audience}
              onChange={e => setAudience(e.target.value as StatusAudience)}
            >
              <option value="whatsapp">Meu WhatsApp (padrão — sem cadastrar contatos)</option>
              <option value="all_contacts">Contatos cadastrados no Radar Chat</option>
              <option value="consented">Radar Chat — só com consentimento</option>
            </select>
            {waConnected && audiencePreview && audience !== 'whatsapp' && (
              <p className="text-[11px] mt-1.5 text-brand-400/90">
                Audiência estimada: <strong>{audiencePreview.count}</strong> contato(s) do Radar Chat
              </p>
            )}
            <p className="text-[11px] text-[var(--rz-text-muted)] mt-1">
              {audience === 'whatsapp'
                ? 'Publica direto na sessão WhatsApp conectada — igual ao app, não precisa de contatos no Radar Chat.'
                : audience === 'all_contacts'
                  ? 'Opcional: restringe quem vê usando a lista de Contatos do painel.'
                  : 'Opcional: só contatos com consentimento aceito.'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-[var(--rz-text-muted)] cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleMode}
              onChange={e => setScheduleMode(e.target.checked)}
              className="rounded border-[var(--rz-border)]"
            />
            <Calendar size={14} /> Agendar publicação
          </label>

          {scheduleMode && (
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Data e hora</label>
              <input
                type="datetime-local"
                className={inputCls}
                min={minSendAtLocal}
                value={sendAtLocal}
                onChange={e =>
                  setSendAtLocal(clampDatetimeLocal(e.target.value, minSendAtLocal))
                }
              />
            </div>
          )}

          {result && (
            <p className={`text-sm ${result.ok ? 'text-green-400' : 'text-red-400'}`}>
              {result.message}
            </p>
          )}

          <Button
            onClick={handleSubmit}
            disabled={createPost.isPending}
            className="w-full"
          >
            {createPost.isPending ? (
              <Spinner size={16} />
            ) : scheduleMode ? (
              <>
                <Clock size={16} /> Agendar status
              </>
            ) : (
              <>
                <Send size={16} /> Publicar agora
              </>
            )}
          </Button>
        </Card>

        <Card>
          <p className="text-xs text-[var(--rz-text-muted)] mb-3">Pré-visualização</p>
          <div className="mx-auto w-[220px] aspect-[9/16] rounded-2xl overflow-hidden border border-[var(--rz-border)] bg-[var(--rz-surface)] relative">
            {statusType === 'image' && imagePreview ? (
              <>
                <img src={imagePreview} alt="" className="w-full h-full object-cover" />
                {caption && (
                  <p className="absolute bottom-0 left-0 right-0 p-3 text-xs text-white bg-gradient-to-t from-black/70 to-transparent">
                    {caption}
                  </p>
                )}
              </>
            ) : (
              <div
                className="w-full h-full flex items-center justify-center p-6 text-center"
                style={{ backgroundColor }}
              >
                <p className={`text-lg font-medium leading-snug ${previewTextStyle} ${statusFontPreviewClass(font)}`}>
                  {text.trim() || 'Seu texto aparece aqui'}
                </p>
              </div>
            )}
            <div className="absolute top-3 left-3 flex items-center gap-1 text-[10px] text-white/80">
              <Smartphone size={12} /> Status
            </div>
          </div>
        </Card>
      </div>

      {isLoading ? (
        <LoadingState rows={4} className="pt-4" />
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--rz-text-secondary)] flex items-center gap-2">
              <Clock size={16} /> Na fila ({queue.length})
            </h2>
            {queue.length === 0 ? (
              <p className="text-sm text-[var(--rz-text-muted)]">Nenhum status agendado.</p>
            ) : (
              <div className="space-y-2">
                {queue.map(p => (
                  <Card key={p._id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-white font-medium">{p.title}</span>
                        <Badge label={STATUS_LABEL[p.status]} variant={STATUS_BADGE[p.status]} />
                        <Badge label={p.type === 'image' ? 'Foto' : 'Texto'} variant="blue" />
                      </div>
                      <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                        {formatWhen(p.scheduledFor)}
                        {p.text && ` · ${p.text.slice(0, 60)}${p.text.length > 60 ? '…' : ''}`}
                      </p>
                    </div>
                    {p.status === 'processing' && (
                      <span className="text-xs text-brand-400 flex items-center gap-1">
                        <Spinner size={12} /> Publicando no WhatsApp…
                      </span>
                    )}
                    {p.status === 'pending' && (
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => cancelPost.mutate(p._id)}
                        disabled={cancelPost.isPending}
                      >
                        <Trash2 size={14} /> Cancelar
                      </Button>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-medium text-[var(--rz-text-secondary)]">Histórico</h2>
            {history.length === 0 ? (
              <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma publicação ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 20).map(p => (
                  <div
                    key={p._id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setDetailPostId(p._id)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') setDetailPostId(p._id)
                    }}
                  >
                    <Card className="py-3 cursor-pointer hover:border-[var(--rz-border)] transition-colors group">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex flex-wrap items-center gap-2 min-w-0">
                        <span className="text-sm text-white">{p.title}</span>
                        <Badge label={STATUS_LABEL[p.status]} variant={STATUS_BADGE[p.status]} />
                        <Badge label={p.type === 'image' ? 'Foto' : 'Texto'} variant="blue" />
                        {p.statusJidCount != null && p.status === 'sent' && (
                          <span className="text-xs text-[var(--rz-text-muted)]">
                            {p.statusJidCount} na audiência
                          </span>
                        )}
                        {p.status === 'sent' && (p.viewCount ?? 0) > 0 && (
                          <span className="text-xs text-brand-400/90 flex items-center gap-0.5">
                            <Eye size={11} /> {p.viewCount} visualizações
                          </span>
                        )}
                      </div>
                      <ChevronRight
                        size={16}
                        className="text-[var(--rz-text-muted)] group-hover:text-brand-400 shrink-0"
                      />
                    </div>
                    <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                      {p.processedAt ? formatWhen(p.processedAt) : formatWhen(p.scheduledFor)}
                      {p.text && ` · ${p.text.slice(0, 60)}${p.text.length > 60 ? '…' : ''}`}
                      {p.lastError && (
                        <span className="text-red-400 block mt-1">{p.lastError}</span>
                      )}
                    </p>
                    <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">Clique para ver conteúdo e visualizações</p>
                    </Card>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {detailPostId && (
        <StatusPostDetailModal postId={detailPostId} onClose={() => setDetailPostId(null)} />
      )}
    </RadarPageShell>
  )
}
