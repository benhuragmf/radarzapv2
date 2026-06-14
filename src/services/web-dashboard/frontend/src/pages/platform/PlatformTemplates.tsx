import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { WhatsAppPreviewBubble } from '../../components/platform/WhatsAppPreviewBubble'
import { WhatsAppTextEditor } from '../../components/whatsapp/WhatsAppTextEditor'
import { api } from '../../lib/api'
import { Card } from '../../components/ui/Card'
import { Badge } from '../../components/ui/Badge'
import { Button } from '../../components/ui/Button'
import { Spinner } from '../../components/ui/Spinner'
import {
import { notifyError, notifySuccess, notifyInfo, mutationError } from '../../lib/notify'
  FileText,
  BookOpen,
  Pencil,
  RotateCcw,
  X,
  Check,
  ArrowRight,
  Cake,
  Info,
  Tag,
  Bell,
  Sparkles,
  Plus,
  Trash2,
} from 'lucide-react'

type Category = 'birthday' | 'informative' | 'promo' | 'reminder' | 'custom'

interface PlatformTemplate {
  _id: string
  name: string
  content: string
  description?: string
  category: Category
  platformKind?: string
  label?: string
  isDefault: boolean
  clientId?: string | null
  variables: string[]
  usage?: { timesUsed: number }
}

const CATEGORY_META: Record<
  Category,
  { label: string; icon: typeof FileText; accent: string; badge: 'blue' | 'green' | 'yellow' | 'red' | 'gray' }
> = {
  birthday: { label: 'Aniversário', icon: Cake, accent: 'border-pink-600/40 bg-pink-950/20', badge: 'red' },
  informative: { label: 'Informativo', icon: Info, accent: 'border-indigo-600/40 bg-indigo-950/20', badge: 'blue' },
  promo: { label: 'Promoção', icon: Tag, accent: 'border-amber-600/40 bg-amber-950/20', badge: 'yellow' },
  reminder: { label: 'Lembrete', icon: Bell, accent: 'border-cyan-600/40 bg-cyan-950/20', badge: 'green' },
  custom: { label: 'Personalizado', icon: Sparkles, accent: 'border-gray-600/50 bg-gray-900/40', badge: 'gray' },
}

const SAMPLE_VARS: Record<string, string> = {
  nome: 'Maria Silva',
  empresa: 'Radar Gamer',
  aniversario: '15/03',
  mensagem: 'Conteúdo da campanha ou aviso.',
  titulo: 'Novidade da semana',
  link_bloco: '🔗 https://exemplo.com/oferta',
  data: '04/06/2026',
  hora: '14:30',
  rodape: 'Radar Gamer • 04/06/2026 14:30',
  autor: 'Equipe Marketing',
  desconto: '30% OFF',
  preco: 'R$ 49,90',
  validade: '10/06/2026',
  evento: 'Live especial',
  local: 'Canal oficial',
  cupom: 'RADAR30',
}

function previewContent(content: string): string {
  let out = content
  for (const [k, v] of Object.entries(SAMPLE_VARS)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v)
  }
  return out.replace(/\{[^}]+\}/g, '').trim()
}

function ContactMock({ name }: { name: string }) {
  return (
    <div className="rounded-lg bg-gray-900/80 border border-gray-800 p-3 text-xs">
      <p className="text-gray-500 text-[10px] uppercase tracking-wider mb-2">Destinatário</p>
      <p className="text-white font-medium">{name}</p>
      <p className="text-gray-500 mt-1">Campanha / aniversário / lembrete</p>
    </div>
  )
}

const emptyCustom = {
  name: '',
  category: 'custom' as Category,
  content: '📢 *{titulo}*\n\n{mensagem}\n\n_{rodape}_',
}

export default function PlatformTemplates() {
  const qc = useQueryClient()
  const [editing, setEditing] = useState<PlatformTemplate | null>(null)
  const [previewId, setPreviewId] = useState<string | null>(null)
  const [draftContent, setDraftContent] = useState('')
  const [draftDesc, setDraftDesc] = useState('')
  const [saveError, setSaveError] = useState('')
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customForm, setCustomForm] = useState(emptyCustom)

  const { data: templates = [], isLoading } = useQuery<PlatformTemplate[]>({
    queryKey: ['platform-templates'],
    queryFn: () => api.get('/platform/templates'),
  })

  const { data: varDocs = {} } = useQuery<Record<string, string>>({
    queryKey: ['platform-template-variables'],
    queryFn: () => api.get('/platform/templates/variables'),
  })

  const pwTemplates = useMemo(
    () => templates.filter((t) => t.name.startsWith('pw-')).sort((a, b) => a.name.localeCompare(b.name)),
    [templates],
  )
  const customTemplates = useMemo(
    () => templates.filter((t) => !t.name.startsWith('pw-')),
    [templates],
  )
  const editedCount = useMemo(() => pwTemplates.filter((t) => t.clientId).length, [pwTemplates])

  const saveMutation = useMutation({
    mutationFn: () =>
      api.patch(`/platform/templates/${editing!._id}`, {
        content: draftContent,
        description: draftDesc || undefined,
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-templates'] })
      setEditing(null)
      setSaveError('')
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const resetMutation = useMutation({
    mutationFn: (id: string) => api.post(`/platform/templates/${id}/reset`, {}),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-templates'] })
      setEditing(null)
    },
  })

  const createCustomMutation = useMutation({
    mutationFn: () => api.post('/platform/templates', customForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['platform-templates'] })
      setShowCustomForm(false)
      setCustomForm(emptyCustom)
    },
    onError: (e: Error) => setSaveError(e.message),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.delete(`/platform/templates/${id}`),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['platform-templates'] }),
    onError: mutationError,
  })

  const openEdit = (t: PlatformTemplate) => {
    setEditing(t)
    setPreviewId(t._id)
    setDraftContent(t.content)
    setDraftDesc(t.description ?? '')
    setSaveError('')
  }

  const previewTemplate =
    editing ?? pwTemplates.find((t) => t._id === previewId) ?? pwTemplates[0]
  const previewText = previewTemplate
    ? previewContent(editing ? draftContent : previewTemplate.content)
    : ''
  const displayLabel = (t: PlatformTemplate) => t.label ?? t.name

  if (isLoading) {
    return (
      <div className="flex justify-center pt-20">
        <Spinner size={32} />
      </div>
    )
  }

  return (
    <PlatformPage
      title="Modelos de mensagem"
      description="Define como campanhas, aniversários e envios manuais aparecem no WhatsApp. Catálogo pw-* (igual ao padrão dw-* do Discord). Variáveis no formato {nome}, {empresa}, {mensagem}…"
      phase="Fase 2"
      actions={
        <Link
          to="/discord/templates"
          className="text-xs text-brand-400 hover:underline flex items-center gap-1"
        >
          <BookOpen size={12} /> Formato Discord → WhatsApp
        </Link>
      }
    >
      <div className="flex flex-wrap justify-end gap-2">
        <Button type="button" variant="secondary" onClick={() => setShowCustomForm((v) => !v)}>
          <Plus size={14} className="mr-1" />
          Modelo personalizado
        </Button>
      </div>

      {showCustomForm && (
        <Card className="border-brand-600/30 space-y-3">
          <p className="text-sm font-medium text-brand-300">Novo modelo (fora do catálogo pw-*)</p>
          <input
            className="w-full text-sm bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-gray-300"
            placeholder="Nome (ex.: campanha-black-friday)"
            value={customForm.name}
            onChange={(e) => setCustomForm((f) => ({ ...f, name: e.target.value }))}
          />
          <WhatsAppTextEditor
            value={customForm.content}
            onChange={v => setCustomForm(f => ({ ...f, content: v }))}
            rows={6}
            monospace
            showHint={false}
          />
          <Button
            size="sm"
            disabled={createCustomMutation.isPending}
            onClick={() => createCustomMutation.mutate()}
          >
            Criar
          </Button>
        </Card>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3">
          <p className="text-xs text-gray-500">Formatos pw-*</p>
          <p className="text-xl font-bold">{pwTemplates.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Personalizados</p>
          <p className="text-xl font-bold text-brand-400">{editedCount}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Extras</p>
          <p className="text-xl font-bold">{customTemplates.length}</p>
        </Card>
        <Card className="p-3">
          <p className="text-xs text-gray-500">Variáveis</p>
          <p className="text-xl font-bold">{Object.keys(varDocs).length}</p>
        </Card>
      </div>

      <Card className="border-gray-800 bg-gradient-to-br from-gray-900/80 to-gray-950/80 overflow-hidden">
        <p className="text-xs text-gray-500 mb-4">
          <strong className="text-gray-400">Variáveis comuns:</strong>{' '}
          <code className="text-brand-400">{'{nome}'}</code>,{' '}
          <code className="text-brand-400">{'{empresa}'}</code>,{' '}
          <code className="text-brand-400">{'{mensagem}'}</code>,{' '}
          <code className="text-brand-400">{'{link_bloco}'}</code>,{' '}
          <code className="text-brand-400">{'{data}'}</code>,{' '}
          <code className="text-brand-400">{'{rodape}'}</code>
        </p>
        <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] gap-4 items-center">
          <div>
            <p className="text-[10px] uppercase tracking-wider text-gray-400 mb-2 font-medium">Plataforma</p>
            <ContactMock name={SAMPLE_VARS.nome} />
          </div>
          <div className="hidden md:flex flex-col items-center text-gray-600">
            <ArrowRight size={28} className="text-brand-500" />
            <span className="text-[10px] mt-1">envio</span>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-emerald-400 mb-2 font-medium">WhatsApp</p>
            <div className="rounded-xl bg-[#0b141a] p-4 min-h-[120px] border border-[#1f2c34]">
              <WhatsAppPreviewBubble text={previewText} timeLabel="14:30 ✓✓" />
            </div>
          </div>
        </div>
      </Card>

      {editing && (
        <Card className="border-brand-600/40 bg-brand-950/10">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-sm font-medium text-brand-300">Editando formato</p>
              <p className="text-lg font-semibold text-white">{displayLabel(editing)}</p>
              <p className="text-xs text-gray-500 font-mono">{editing.name}</p>
            </div>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="p-2 rounded-lg text-gray-500 hover:bg-gray-800 hover:text-gray-300"
            >
              <X size={18} />
            </button>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_220px_1fr] gap-4">
            <div>
              <WhatsAppTextEditor
                value={draftContent}
                onChange={setDraftContent}
                rows={16}
                minHeight="320px"
                monospace
                showHint={false}
              />
              <input
                value={draftDesc}
                onChange={(e) => setDraftDesc(e.target.value)}
                placeholder="Descrição (opcional)"
                className="mt-2 w-full text-xs bg-gray-950 border border-gray-800 rounded-lg px-3 py-2 text-gray-400"
              />
              {saveError && <p className="text-xs text-red-400 mt-2">{saveError}</p>}
              <div className="flex gap-2 mt-3">
                <Button size="sm" disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
                  <Check size={12} /> Salvar
                </Button>
                {(editing.isDefault || editing.name.startsWith('pw-')) && (
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
            <aside className="hidden lg:block text-xs border border-gray-800 rounded-lg p-3 bg-gray-950/80 max-h-[320px] overflow-y-auto">
              <p className="text-gray-500 font-medium mb-2 sticky top-0 bg-gray-950/95 py-1">Variáveis</p>
              {Object.entries(varDocs).map(([k, v]) => (
                <div key={k} className="mb-2 text-gray-500">
                  <code className="text-brand-400">{`{${k}}`}</code>
                  <p className="text-[10px] text-gray-600 mt-0.5">{v}</p>
                </div>
              ))}
            </aside>
            <div>
              <p className="text-xs text-gray-500 mb-2">Pré-visualização no WhatsApp</p>
              <div className="rounded-xl bg-[#0b141a] p-4 border border-[#1f2c34] min-h-[280px]">
                <WhatsAppPreviewBubble text={previewContent(draftContent)} timeLabel="14:30 ✓✓" />
              </div>
            </div>
          </div>
        </Card>
      )}

      {pwTemplates.length === 0 && (
        <Card className="text-center py-12 text-gray-500">
          <FileText size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium text-gray-400">Nenhum formato pw-*</p>
          <p className="text-sm mt-1">Reinicie o backend ou execute npm run seed:platform-templates</p>
        </Card>
      )}

      <p className="text-sm text-gray-500">{pwTemplates.length} formato(s) Plataforma → WhatsApp</p>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {pwTemplates.map((t) => {
          const meta = CATEGORY_META[t.category] ?? CATEGORY_META.custom
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
                <Icon size={16} className="text-gray-400 shrink-0" />
                <span className="font-medium text-sm truncate">{displayLabel(t)}</span>
                <span className="text-[10px] text-gray-600 font-mono">{t.name}</span>
                {t.isDefault && <Badge label="catálogo" variant="blue" />}
                {t.clientId && <Badge label="editado" variant="green" />}
                <Badge label={meta.label} variant={meta.badge} />
                <button
                  type="button"
                  onClick={() => openEdit(t)}
                  className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 hover:bg-gray-800 shrink-0 ml-auto"
                  title="Editar"
                >
                  <Pencil size={14} />
                </button>
              </div>

              {t.description && (
                <p className="text-xs text-gray-500 mb-2 leading-relaxed">{t.description}</p>
              )}

              <pre className="text-xs text-gray-400 bg-gray-950 rounded-lg p-3 whitespace-pre-wrap break-words font-mono leading-relaxed border border-gray-800 max-h-48 overflow-y-auto">
                {t.content}
              </pre>

              <div className="mt-3 flex flex-wrap gap-1 text-xs text-gray-500">
                {t.variables?.slice(0, 8).map((v) => (
                  <code key={v} className="text-brand-400">{`{${v}}`}</code>
                ))}
                {(t.variables?.length ?? 0) > 8 && (
                  <span className="text-gray-600">+{t.variables.length - 8}</span>
                )}
              </div>
            </Card>
          )
        })}
      </div>

      <details className="group">
        <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300 list-none flex items-center gap-2">
          <span className="group-open:rotate-90 transition-transform inline-block">▸</span>
          Dicionário de variáveis ({Object.keys(varDocs).length})
        </summary>
        <Card className="mt-3 border-gray-800">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-2 text-xs">
            {Object.entries(varDocs).map(([k, v]) => (
              <div key={k} className="text-gray-500">
                <code className="text-brand-400">{`{${k}}`}</code>
                <span className="text-gray-600"> — </span>
                {v}
              </div>
            ))}
          </div>
        </Card>
      </details>

      {customTemplates.length > 0 && (
        <section className="mt-6">
          <p className="text-sm text-gray-500 mb-3">Modelos personalizados ({customTemplates.length})</p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {customTemplates.map((t) => (
              <Card key={t._id}>
                <div className="flex items-center gap-2 mb-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  <Badge label={CATEGORY_META[t.category]?.label ?? 'Custom'} variant="gray" />
                  <button
                    type="button"
                    onClick={() => openEdit(t)}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-brand-400 ml-auto"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (confirm(`Remover "${t.name}"?`)) deleteMutation.mutate(t._id)
                    }}
                    className="p-1.5 rounded-lg text-gray-500 hover:text-red-400"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
                <pre className="text-xs text-gray-500 bg-gray-950 rounded-lg p-3 font-mono border border-gray-800 max-h-32 overflow-y-auto whitespace-pre-wrap">
                  {t.content}
                </pre>
              </Card>
            ))}
          </div>
        </section>
      )}
    </PlatformPage>
  )
}
