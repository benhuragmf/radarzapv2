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
} from 'lucide-react'
import {
  clampDatetimeLocal,
  minDatetimeLocalFromNow,
  validateFutureSchedule,
} from '../../lib/schedule-time'

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
  createdAt: string
}

const inputCls =
  'w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200 focus:outline-none focus:border-brand-500'

const STATUS_COLORS = [
  { id: 'cream', value: '#FFFCF5', label: 'Creme' },
  { id: 'yellow', value: '#FFEECF', label: 'Amarelo' },
  { id: 'peach', value: '#FFD8A8', label: 'Pêssego' },
  { id: 'pink', value: '#FECDCA', label: 'Rosa' },
  { id: 'lavender', value: '#FCD6FF', label: 'Lilás' },
  { id: 'blue', value: '#D1E9FF', label: 'Azul' },
  { id: 'mint', value: '#CFF5E7', label: 'Menta' },
  { id: 'dark', value: '#1F2C34', label: 'Escuro' },
]

const STATUS_FONTS = [
  { value: 0, label: 'Padrão' },
  { value: 1, label: 'Serif' },
  { value: 2, label: 'Manuscrito' },
  { value: 3, label: 'Elegante' },
]

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
  const [backgroundColor, setBackgroundColor] = useState(STATUS_COLORS[0].value)
  const [font, setFont] = useState(0)
  const [audience, setAudience] = useState<StatusAudience>('whatsapp')
  const [scheduleMode, setScheduleMode] = useState(false)
  const [sendAtLocal, setSendAtLocal] = useState(defaultScheduleLocal)
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(null)

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
    radarzapContacts: number
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
    onError: (err: Error) => alert(err.message),
  })

  const onPickImage = (file: File | null) => {
    if (!file) return
    if (file.size > 5 * 1024 * 1024) {
      alert('Imagem muito grande — máximo 5 MB')
      return
    }
    const reader = new FileReader()
    reader.onload = () => {
      const data = reader.result as string
      setImageData(data)
      setImagePreview(data)
    }
    reader.readAsDataURL(file)
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
      const v = validateFutureSchedule(sendAtLocal)
      if (!v.ok) {
        setResult({ ok: false, message: v.error })
        return
      }
      sendAt = v.date.toISOString()
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
    backgroundColor === '#1F2C34' ? 'text-white' : 'text-gray-900'

  return (
    <div className="max-w-4xl space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-white flex items-center gap-2">
          <Circle size={20} className="text-brand-400" />
          Publicar status WhatsApp
        </h1>
        <p className="text-sm text-gray-500 mt-1 max-w-2xl">
          Poste texto ou foto no seu status (stories), como no app do WhatsApp. Agendamentos
          são processados pelo servidor a cada ~15 s — não precisa manter esta página aberta.
        </p>
      </div>

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
            <label className="text-xs text-gray-500 mb-1 block">Título interno</label>
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
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Texto ({text.length}/700)
                </label>
                <textarea
                  className={`${inputCls} min-h-[120px] resize-y`}
                  placeholder="O que você quer publicar no status?"
                  value={text}
                  onChange={e => setText(e.target.value.slice(0, 700))}
                  maxLength={700}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-2 block">Cor de fundo</label>
                <div className="flex flex-wrap gap-2">
                  {STATUS_COLORS.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      title={c.label}
                      onClick={() => setBackgroundColor(c.value)}
                      className={`w-8 h-8 rounded-full border-2 ${
                        backgroundColor === c.value ? 'border-brand-400' : 'border-gray-700'
                      }`}
                      style={{ backgroundColor: c.value }}
                    />
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Fonte</label>
                <select
                  className={inputCls}
                  value={font}
                  onChange={e => setFont(Number(e.target.value))}
                >
                  {STATUS_FONTS.map(f => (
                    <option key={f.value} value={f.value}>
                      {f.label}
                    </option>
                  ))}
                </select>
              </div>
            </>
          ) : (
            <>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">Imagem (máx. 5 MB)</label>
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="text-sm text-gray-400"
                  onChange={e => onPickImage(e.target.files?.[0] ?? null)}
                />
              </div>
              <div>
                <label className="text-xs text-gray-500 mb-1 block">
                  Legenda opcional ({caption.length}/700)
                </label>
                <textarea
                  className={`${inputCls} min-h-[80px] resize-y`}
                  placeholder="Legenda da foto"
                  value={caption}
                  onChange={e => setCaption(e.target.value.slice(0, 700))}
                  maxLength={700}
                />
              </div>
            </>
          )}

          <div>
            <label className="text-xs text-gray-500 mb-1 block">Quem pode ver</label>
            <select
              className={inputCls}
              value={audience}
              onChange={e => setAudience(e.target.value as StatusAudience)}
            >
              <option value="whatsapp">Meu WhatsApp (padrão — sem cadastrar contatos)</option>
              <option value="all_contacts">Contatos cadastrados no RadarZap</option>
              <option value="consented">RadarZap — só com consentimento</option>
            </select>
            {waConnected && audiencePreview && audience !== 'whatsapp' && (
              <p className="text-[11px] mt-1.5 text-brand-400/90">
                Audiência estimada: <strong>{audiencePreview.count}</strong> contato(s) do RadarZap
              </p>
            )}
            <p className="text-[11px] text-gray-600 mt-1">
              {audience === 'whatsapp'
                ? 'Publica direto na sessão WhatsApp conectada — igual ao app, não precisa de contatos no RadarZap.'
                : audience === 'all_contacts'
                  ? 'Opcional: restringe quem vê usando a lista de Contatos do painel.'
                  : 'Opcional: só contatos com consentimento aceito.'}
            </p>
          </div>

          <label className="flex items-center gap-2 text-sm text-gray-400 cursor-pointer">
            <input
              type="checkbox"
              checked={scheduleMode}
              onChange={e => setScheduleMode(e.target.checked)}
              className="rounded border-gray-600"
            />
            <Calendar size={14} /> Agendar publicação
          </label>

          {scheduleMode && (
            <div>
              <label className="text-xs text-gray-500 mb-1 block">Data e hora</label>
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
          <p className="text-xs text-gray-500 mb-3">Pré-visualização</p>
          <div className="mx-auto w-[220px] aspect-[9/16] rounded-2xl overflow-hidden border border-gray-700 bg-gray-900 relative">
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
                <p className={`text-lg font-medium leading-snug ${previewTextStyle}`}>
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
        <div className="flex justify-center py-8">
          <Spinner size={28} />
        </div>
      ) : (
        <>
          <section className="space-y-3">
            <h2 className="text-sm font-medium text-gray-300 flex items-center gap-2">
              <Clock size={16} /> Na fila ({queue.length})
            </h2>
            {queue.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhum status agendado.</p>
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
                      <p className="text-xs text-gray-500 mt-1">
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
            <h2 className="text-sm font-medium text-gray-300">Histórico</h2>
            {history.length === 0 ? (
              <p className="text-sm text-gray-600">Nenhuma publicação ainda.</p>
            ) : (
              <div className="space-y-2">
                {history.slice(0, 20).map(p => (
                  <Card key={p._id} className="py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-sm text-white">{p.title}</span>
                      <Badge label={STATUS_LABEL[p.status]} variant={STATUS_BADGE[p.status]} />
                      {p.statusJidCount != null && p.status === 'sent' && (
                        <span className="text-xs text-gray-500">
                          {p.statusJidCount} contato(s)
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      {p.processedAt ? formatWhen(p.processedAt) : formatWhen(p.scheduledFor)}
                      {p.lastError && (
                        <span className="text-red-400 block mt-1">{p.lastError}</span>
                      )}
                    </p>
                  </Card>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </div>
  )
}
