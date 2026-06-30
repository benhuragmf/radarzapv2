import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import {
  FileText,
  BookOpen,
  Pencil,
  RotateCcw,
  X,
  Check,
  ArrowRight,
  MessageSquare,
  Radio,
  List,
  Tag,
  Bell,
  ScrollText,
  Image,
  Paperclip,
  BarChart3,
  Layers,
  Sparkles,
} from 'lucide-react'
import { DiscordPage } from '../components/discord/DiscordPage'
import { DiscordPostMock } from '../components/discord/DiscordPostMock'
import { WhatsAppPreviewBubble } from '../components/platform/WhatsAppPreviewBubble'
import { LoadingState, MetricCard, waPreviewPanelCls, previewChannelLabelDiscordCls, previewChannelLabelWaCls } from '@/design-system'

interface Template {
  _id: string
  name: string
  content: string
  description?: string
  discordKind?: string
  isDefault: boolean
  clientId?: string | null
  usage?: { timesUsed: number }
  usageCount?: number
  variables: string[]
}

const KIND_META: Record<
  string,
  { label: string; icon: typeof FileText; accent: string; badge: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }
> = {
  auto: { label: 'Automático', icon: Sparkles, accent: 'border-brand-500/50 bg-brand-950/20', badge: 'blue' },
  text: { label: 'Texto', icon: MessageSquare, accent: 'border-[var(--rz-border)]/50 bg-[var(--rz-surface)]/40', badge: 'gray' },
  embed: { label: 'Embed', icon: FileText, accent: 'border-indigo-600/40 bg-indigo-950/20', badge: 'blue' },
  embed_list: { label: 'Lista', icon: List, accent: 'border-emerald-600/40 bg-emerald-950/20', badge: 'green' },
  live: { label: 'Live', icon: Radio, accent: 'border-red-600/40 bg-red-950/25', badge: 'red' },
  video: { label: 'Vídeo', icon: Radio, accent: 'border-purple-600/40 bg-purple-950/20', badge: 'blue' },
  promo: { label: 'Promoção', icon: Tag, accent: 'border-amber-600/40 bg-amber-950/20', badge: 'yellow' },
  alert: { label: 'Alerta', icon: Bell, accent: 'border-orange-600/40 bg-orange-950/20', badge: 'yellow' },
  log: { label: 'Log', icon: ScrollText, accent: 'border-[var(--rz-border)]/60 bg-[var(--rz-background)]/40', badge: 'gray' },
  media: { label: 'Mídia', icon: Image, accent: 'border-cyan-600/40 bg-cyan-950/20', badge: 'blue' },
  file: { label: 'Arquivo', icon: Paperclip, accent: 'border-[var(--rz-border)]/50 bg-[var(--rz-surface-muted)]/30', badge: 'gray' },
  poll: { label: 'Enquete', icon: BarChart3, accent: 'border-violet-600/40 bg-violet-950/20', badge: 'blue' },
  mixed: { label: 'Misto', icon: Layers, accent: 'border-teal-600/40 bg-teal-950/20', badge: 'green' },
}

const SAMPLE_VARS: Record<string, string> = {
  titulo: 'Jogos Gratuitos (1/2)',
  corpo: 'Lista formatada do Discord…',
  conteudo: 'Conteúdo principal',
  lista_conteudo: '*Steam*\n• Jogo A\n• Jogo B',
  autor: 'Radar Gamer',
  canal: 'promocoes',
  servidor: 'SK2 Staff',
  data: '02/06/2026',
  hora: '14:10',
  link_principal: 'https://store.steampowered.com',
  opcoes_botoes: '*Opções — responda com o número:*\n1️⃣ *Ver Steam*\n   https://…',
  anexos: '',
  streamer: 'SkulksGamer',
  jogo: 'Elden Ring',
  viewers: '1.2K',
  plataforma: '🔴 Twitch',
  preco: 'R$ 29,90',
  desconto: '50% OFF',
  loja: 'Steam',
  embed_titulo: 'Título do embed',
}

function usageCount(t: Template): number {
  return t.usage?.timesUsed ?? t.usageCount ?? 0
}

function previewContent(content: string): string {
  let out = content
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return out.replace(/\{[^}]+\}/g, '').trim()
}

export default function Templates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<Template | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [saveError, setSaveError] = useState('')

  const { data: templates = [], isLoading } = useQuery<Template[]>({
    queryKey: ['templates'],
    queryFn: () => api.get('/templates'),
  })

  const { data: varDocs = {} } = useQuery<Record<string, string>>({
    queryKey: ['template-variables'],
    queryFn: () => api.get('/templates/variables'),
  })

  const dwTemplates = useMemo(
    () => templates.filter(t => t.name.startsWith('dw-')).sort((a, b) => a.name.localeCompare(b.name)),
    [templates]
  )
  const legacyTemplates = useMemo(
    () => templates.filter(t => !t.name.startsWith('dw-')),
    [templates]
  )
  const editedCount = useMemo(() => dwTemplates.filter(t => t.clientId).length, [dwTemplates])
  const totalUsage = useMemo(
    () => dwTemplates.reduce((s, t) => s + usageCount(t), 0),
    [dwTemplates]
  )

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/templates/${editing!._id}`, {
        content: draftContent,
        description: draftDesc || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setEditing(null)
      setSaveError('')
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.post(`/templates/${id}/reset`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['templates'] })
      setEditing(null)
    },
  })

  const openEdit = (t: Template) => {
    setEditing(t)
    setPreviewId(t._id)
    setDraftContent(t.content)
    setDraftDesc(t.description ?? '')
    setSaveError('')
  }

  const previewTemplate =
    editing ?? dwTemplates.find(t => t._id === previewId) ?? dwTemplates[0]
  const previewText = previewTemplate
    ? previewContent(editing ? draftContent : previewTemplate.content)
    : ''

  if (isLoading) {
    return (
      <DiscordPage description="Define como cada mensagem capturada no Discord aparece no WhatsApp.">
        <LoadingState rows={5} className="pt-8" />
      </DiscordPage>
    )
  }

  return (
    <DiscordPage
      description="Define como cada mensagem capturada no Discord aparece no WhatsApp. As regras escolhem qual formato usar — recomendamos dw-padrao para detecção automática."
      actions={
        <Link
          to="/discord/rules"
          className="text-xs text-brand-400 hover:underline flex items-center gap-1"
        >
          <BookOpen size={12} /> Ir para regras
        </Link>
      }
    >
      {/* Métricas — mesmo padrão de Regras / Canais */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <MetricCard title="Formatos" value={dwTemplates.length} icon={FileText} />
        <MetricCard title="Personalizados" value={editedCount} icon={Pencil} />
        <MetricCard title="Usos totais" value={totalUsage} icon={BarChart3} />
        <MetricCard title="Variáveis" value={Object.keys(varDocs).length} icon={Tag} />
      </div>

      {/* Fluxo Discord → WhatsApp */}
      <Card className="border-[var(--rz-border)] bg-gradient-to-br from-[var(--rz-surface)]/80 to-[var(--rz-surface-muted)]/80 overflow-hidden">
        <p className="text-xs text-[var(--rz-text-muted)] mb-4">
          <strong className="text-[var(--rz-text-muted)]">Variáveis comuns:</strong>{' '}
          <code className="text-brand-400">{'{titulo}'}</code>,{' '}
          <code className="text-brand-400">{'{corpo}'}</code>,{' '}
          <code className="text-brand-400">{'{lista_conteudo}'}</code>,{' '}
          <code className="text-brand-400">{'{opcoes_botoes}'}</code>,{' '}
          <code className="text-brand-400">{'{autor}'}</code>,{' '}
          <code className="text-brand-400">{'{canal}'}</code>,{' '}
          <code className="text-brand-400">{'{link_principal}'}</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div>
            <p className={previewChannelLabelDiscordCls}>Discord</p>
            <DiscordPostMock title={previewTemplate?.name ?? 'dw-padrao'} />
          </div>
          <div className="hidden md:flex flex-col items-center text-[var(--rz-text-muted)]">
            <ArrowRight size={28} className="text-brand-500" />
            <span className="text-[10px] mt-1">captura</span>
          </div>
          <div>
            <p className={previewChannelLabelWaCls}>WhatsApp</p>
            <div className={`${waPreviewPanelCls} min-h-[120px]`}>
              <WhatsAppPreviewBubble text={previewText} timeLabel="14:10 ✓✓" />
            </div>
          </div>
        </div>
      </Card>

      {/* Editor */}
      {editing && (
        <Card className="border-brand-600/40 bg-brand-950/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-brand-300">Editando formato</p>
              <p className="text-lg font-semibold text-[var(--rz-text-primary)]">{editing.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-2 rounded-lg text-[var(--rz-text-muted)] hover:bg-[var(--rz-surface-muted)] hover:text-[var(--rz-text-secondary)]"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div>
              <textarea
                value={draftContent}
                onChange={e => setDraftContent(e.target.value)}
                rows={16}
                className="w-full text-xs font-mono bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg p-3 text-[var(--rz-text-secondary)] focus:border-brand-500 outline-none leading-relaxed"
              />
              <input
                value={draftDesc}
                onChange={e => setDraftDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="mt-2 w-full text-xs bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-lg px-3 py-2 text-[var(--rz-text-muted)]"
              />
              {saveError && <p className="text-xs text-red-400 mt-2">{saveError}</p>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  <Check size={12} /> Salvar
                </Button>
                {editing.isDefault && (
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={resetMutation.isPending}
                    onClick={() => resetMutation.mutate(editing._id)}
                  >
                    <RotateCcw size={12} /> Restaurar padrão
                  </Button>
                )}
              </div>
            </div>
            <div>
              <p className="text-xs text-[var(--rz-text-muted)] mb-2">Pré-visualização no WhatsApp</p>
              <div className={`${waPreviewPanelCls} min-h-[280px]`}>
                <WhatsAppPreviewBubble text={previewContent(draftContent)} timeLabel="14:10 ✓✓" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {dwTemplates.length === 0 && (
        <Card className="text-center py-12 text-[var(--rz-text-muted)]">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-[var(--rz-text-muted)]">Nenhum formato cadastrado</p>
          <p className="text-sm mt-1">Reinicie o backend ou execute npm run seed:templates</p>
        </Card>
      )}

      <p className="text-sm text-[var(--rz-text-muted)]">{dwTemplates.length} formato(s) Discord → WhatsApp</p>

      {/* Grid de cards — layout original enriquecido */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {dwTemplates.map(t => {
          const kind = t.discordKind ?? 'text'
          const meta = KIND_META[kind] ?? KIND_META.text
          const Icon = meta.icon
          const selected = previewId === t._id || editing?._id === t._id

          return (
            <Card
              key={t._id}
              className={`border-l-4 transition-colors ${meta.accent} ${
                selected ? 'ring-1 ring-brand-500/40' : ''
              }`}
              onMouseEnter={() => !editing && setPreviewId(t._id)}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon size={16} className="text-[var(--rz-text-muted)] shrink-0" />
                <span className="font-medium text-sm truncate">{t.name}</span>
                {t.isDefault && <Badge label="padrão" variant="blue" />}
                {t.clientId && <Badge label="editado" variant="green" />}
                <Badge label={meta.label} variant={meta.badge} />
                <span className="ml-auto text-xs text-[var(--rz-text-muted)] shrink-0">{usageCount(t)} usos</span>
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="p-1.5 rounded-lg text-[var(--rz-text-muted)] hover:text-brand-400 hover:bg-[var(--rz-surface-muted)] shrink-0"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
              </div>

              {t.description && (
                <p className="text-xs text-[var(--rz-text-muted)] mb-2 leading-relaxed">{t.description}</p>
              )}

              <pre className="text-xs text-[var(--rz-text-muted)] bg-[var(--rz-surface-muted)] rounded-lg p-3 whitespace-pre-wrap break-words font-mono leading-relaxed border border-[var(--rz-border)] max-h-48 overflow-y-auto">
                {t.content}
              </pre>

              <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[var(--rz-text-muted)]">
                {t.variables?.length > 0 && (
                  <span className="flex flex-wrap items-center gap-1">
                    Variáveis:
                    {t.variables.slice(0, 8).map(v => (
                      <code key={v} className="text-brand-400 mx-0.5">{`{${v}}`}</code>
                    ))}
                    {t.variables.length > 8 && (
                      <span className="text-[var(--rz-text-muted)]">+{t.variables.length - 8}</span>
                    )}
                  </span>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      {/* Variáveis — referência compacta */}
      <details className="group">
        <summary className="text-sm text-[var(--rz-text-muted)] cursor-pointer hover:text-[var(--rz-text-secondary)] list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
          Dicionário de variáveis ({Object.keys(varDocs).length})
        </summary>
        <Card className="mt-3 border-[var(--rz-border)]">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {Object.entries(varDocs).map(([k, v]) => (
              <div key={k} className="text-[var(--rz-text-muted)]">
                <code className="text-brand-400">{`{${k}}`}</code>
                <span className="text-[var(--rz-text-muted)]"> — </span>
                {v}
              </div>
            ))}
          </div>
        </Card>
      </details>

      {legacyTemplates.length > 0 && (
        <details className="text-sm text-[var(--rz-text-muted)]">
          <summary className="cursor-pointer hover:text-[var(--rz-text-muted)] list-none">
            Templates legados ({legacyTemplates.length}) — radarchat-*, game-*
          </summary>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mt-3 opacity-75">
            {legacyTemplates.map(t => (
              <Card key={t._id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  {t.isDefault && <Badge label="legado" variant="gray" />}
                  <span className="ml-auto text-xs text-[var(--rz-text-muted)]">{usageCount(t)} usos</span>
                </div>
                <pre className="text-xs text-[var(--rz-text-muted)] bg-[var(--rz-surface-muted)] rounded-lg p-3 font-mono border border-[var(--rz-border)] max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {t.content}
                </pre>
              </Card>
            ))}
          </div>
        </details>
      )}
    </DiscordPage>
  )
}
