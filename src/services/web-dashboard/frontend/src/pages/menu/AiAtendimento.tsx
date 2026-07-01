import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useUrlHashTab } from '@/lib/useUrlHashTab'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import {
  Sparkles,
  Trash2,
  Zap,
  BookOpen,
  Shield,
  BarChart3,
  MessageSquare,
  Settings2,
  Brain,
  Hand,
  CheckCircle2,
  XCircle,
  Store,
  Package,
  CreditCard,
  Pencil,
} from 'lucide-react'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'
import { InboxStatsRow } from '../../components/inbox/InboxStatsRow'
import { AiModelPicker, type AiModelOption } from '../../components/ai/AiModelPicker'
import {
  AttendanceModePicker,
  CredentialSourcePicker,
} from '../../components/ai/AttendanceModePicker'
import {
  attendanceModeLabel,
  attendanceSelectionFromSettings,
  attendanceSettingsPatchFromSelection,
  credentialSourceLabel,
  isLegacyGenerativeAiActive,
  type AttendanceMode,
  type AttendanceUiSelection,
  type AiCredentialSource,
} from '../../lib/attendanceMode'
import { notifyInfo, notifyConfigSaved, mutationError, notifyError } from '../../lib/notify'
import { deliveryAddressValidationError } from '@radarchat-types/catalog-delivery-address'
import { buildCatalogPixInstructions } from '@radarchat-types/catalog-sales-pix'
import { DeliveryOriginAddressFields } from '../../components/catalog/DeliveryOriginAddressFields'
import { AiEmpresaCatalogSection } from '../../components/ai/AiEmpresaCatalogSection'
import { inputCls, textareaCls, LoadingState, ConfigSaveFooter } from '@/design-system'

interface CatalogProductSalesMeta {
  aiSellable?: boolean
  saleMode?: 'link' | 'pix' | 'link_or_pix'
  acceptsPix?: boolean
  useCompanyWhatsapp?: boolean
  productWhatsapp?: string
  responsibleSector?: string
  requireHumanReview?: boolean
  madeToOrder?: boolean
  deliveryFee?: string
  requiresDeliveryAddress?: boolean
}

interface CatalogSalesCompanyConfig {
  enabled?: boolean
  pixEnabled?: boolean
  pixInstructions?: string
  pixKey?: string
  pixHolderName?: string
  notifyWhatsapp?: boolean
  internalWhatsapp?: string
  responsibleName?: string
  internalMessageTemplate?: string
  autoCreateOrderOnPurchase?: boolean
  escalateOnProof?: boolean
  requireHumanApproval?: boolean
  allowManualResend?: boolean
  requireDeliveryAddress?: boolean
  businessCatalogProfile?: 'none' | 'retail_delivery' | 'retail_pickup' | 'catalog_general'
  deliveryInstructions?: string
  deliveryOriginAddress?: string
  useDistanceBasedDelivery?: boolean
  deliveryKmRates?: Record<string, string>
  forceCollectAddress?: boolean
  notifyCustomerOnApprove?: boolean
  notifyCustomerOnReject?: boolean
  notifyCustomerOnRequestNewProof?: boolean
  customerApproveMessage?: string
  customerRejectMessage?: string
  customerRequestNewProofMessage?: string
}

const textareaClsAi = `${textareaCls} min-h-[120px]`

function usageUnitShort(mode?: 'radarchat_calls' | 'company_calls'): string {
  return mode === 'company_calls' ? 'chamadas' : 'chamadas LLM'
}

function formatCredits(n: number): string {
  if (n <= 0) return '0'
  if (n < 0.1) return n.toFixed(3)
  return n.toFixed(2)
}

type TabId =
  | 'geral'
  | 'saudacoes'
  | 'provedor'
  | 'regras'
  | 'coleta'
  | 'empresa'
  | 'kb'
  | 'skills'
  | 'memory'
  | 'limites'
  | 'transferencia'
  | 'logs'
  | 'testar'

const TABS: { id: TabId; label: string }[] = [
  { id: 'geral', label: 'Geral' },
  { id: 'saudacoes', label: 'Saudações' },
  { id: 'provedor', label: 'Provedor' },
  { id: 'regras', label: 'Economia e regras' },
  { id: 'coleta', label: 'Dados a coletar' },
  { id: 'empresa', label: 'Empresa e IA' },
  { id: 'kb', label: 'Base de conhecimento' },
  { id: 'skills', label: 'Skills' },
  { id: 'memory', label: 'Memória' },
  { id: 'limites', label: 'Limites de uso' },
  { id: 'transferencia', label: 'Regras de transferência' },
  { id: 'logs', label: 'Logs e custos' },
  { id: 'testar', label: 'Testar IA' },
]

const AI_TAB_IDS: readonly TabId[] = TABS.map(t => t.id)

interface AiPayload {
  settings: {
    enabled: boolean
    mode: 'radarchat' | 'company' | 'disabled'
    attendanceMode?: AttendanceMode
    provider: 'openai' | 'gemini'
    model: string
    temperature: number
    maxTokens: number
    dailyLimit: number
    monthlyLimit: number
    perConversationLimit: number
    transferRules: Record<string, boolean | number>
  }
  prompt: {
    agentName: string
    greetingKnown: string
    greetingUnknown: string
    customRules: string
    useSystemContext: boolean
    skipKnownFields: boolean
    autoResolveEnabled: boolean
    basicTriageLlmFallbackEnabled: boolean
    learnSkillsEnabled: boolean
    learnMemoryEnabled: boolean
    collectName: boolean
    collectEmail: boolean
    collectProblem: boolean
    collectCpfCnpj: boolean
    collectAddress: boolean
    collectPhone: boolean
    collectCompany: boolean
    collectDeliveryNotes: boolean
    collectPreferredSchedule: boolean
    collectOrderNumber: boolean
    collectUrgency: boolean
    collectAttachments: boolean
  }
  knowledgeBase: Array<{
    id: string
    title: string
    content: string
    category?: string
    active: boolean
    keywords?: string[]
    links?: Array<{ label: string; url: string; openInNewTab?: boolean }>
    showAsQuickReply?: boolean
    quickReplyLabel?: string
    salesMeta?: CatalogProductSalesMeta
    _delete?: boolean
  }>
  catalogSales: CatalogSalesCompanyConfig
  skills: Array<{
    id: string
    title: string
    triggers: string
    solution: string
    status: 'pending' | 'approved' | 'rejected'
    source: 'learned' | 'manual'
    sourceProblem?: string
    usageCount: number
    updatedAt: string
    _delete?: boolean
  }>
  memories: Array<{
    id: string
    title: string
    content: string
    tags: string
    status: 'pending' | 'approved' | 'rejected'
    source: 'learned' | 'manual'
    usageCount: number
    updatedAt: string
    _delete?: boolean
  }>
  usage: {
    dailyUsed: number
    monthlyUsed: number
    dailyLimit: number
    monthlyLimit: number
    perConversationLimit: number
    meteringMode?: 'radarchat_calls' | 'company_calls'
    companyCallsToday?: number
    dailyCreditsSpent?: number
    monthlyCreditsSpent?: number
    moduleCreditEstimates?: { basic_triage: number; premium_assistant: number }
    dailyByKind?: {
      premium_assistant: { calls: number; tokens: number; cost: number; credits?: number }
      basic_triage: { calls: number; tokens: number; cost: number; credits?: number }
    }
    dailyCreditsByKind?: {
      premium_assistant: { calls: number; tokens: number; cost: number; credits?: number }
      basic_triage: { calls: number; tokens: number; cost: number; credits?: number }
    }
    wallet?: {
      monthlyIncluded: number
      purchased: number
      totalAllowance: number
      usedThisMonth: number
      balance: number
      learningUsed: number
      learningLimit: number
      learningBalance: number
      depleted: boolean
      learningDepleted: boolean
      actionHint: 'recharge' | 'own_api' | null
    }
  }
  apiKeyMasked: string | null
  hasApiKey: boolean
  planLimits: { radarchatAllowed: boolean; dailyLimit: number; monthlyLimit: number }
  modelCatalog: AiModelOption[]
  modelCatalogs: { gemini: AiModelOption[]; openai: AiModelOption[] }
  selectedModelPricing: AiModelOption | null
  blueprintInfo: {
    managedBy: 'radarchat'
    version: number
    agentName: string
    defaultAgentName: string
    defaultGreetingKnown: string
    defaultGreetingUnknown: string
    updatedAt: string
  }
}

type KnowledgeBaseItem = AiPayload['knowledgeBase'][number]
type ProductDraft = {
  name: string
  sku: string
  price: string
  stock: string
  link: string
  description: string
  paymentNotes: string
  deliveryFee: string
  salesMeta: CatalogProductSalesMeta
}

const COMPANY_PROFILE_TITLE = 'O que a empresa faz'
const PAYMENT_GUIDE_TITLE = 'Pagamento por PIX e comprovantes'
const PRODUCT_CATEGORY = 'Produtos e estoque'
const COMPANY_CATEGORY = 'Empresa'
const PAYMENT_CATEGORY = 'Pagamentos'

const emptyProductDraft: ProductDraft = {
  name: '',
  sku: '',
  price: '',
  stock: '',
  link: '',
  description: '',
  paymentNotes: '',
  deliveryFee: '',
  salesMeta: {
    aiSellable: true,
    saleMode: 'link_or_pix',
    acceptsPix: true,
    useCompanyWhatsapp: true,
    requireHumanReview: true,
    requiresDeliveryAddress: false,
  },
}

function makeKnowledgeBaseItem(partial: Partial<KnowledgeBaseItem>): KnowledgeBaseItem {
  return {
    id: '',
    title: partial.title ?? 'Novo item',
    content: partial.content ?? '',
    category: partial.category ?? 'Geral',
    active: partial.active ?? true,
    keywords: partial.keywords ?? [],
    links: partial.links ?? [],
    showAsQuickReply: partial.showAsQuickReply ?? false,
    quickReplyLabel: partial.quickReplyLabel ?? '',
  }
}

function parseProductContentField(content: string, prefix: string): string {
  const line = content.split('\n').find(row => row.startsWith(prefix))
  return line ? line.slice(prefix.length).trim() : ''
}

function knowledgeItemToProductDraft(item: KnowledgeBaseItem): ProductDraft {
  const content = item.content ?? ''
  return {
    name: item.title,
    sku: parseProductContentField(content, 'SKU/código:'),
    price: parseProductContentField(content, 'Valor atual:'),
    stock: parseProductContentField(content, 'Estoque disponível:'),
    description: parseProductContentField(content, 'Descrição:'),
    paymentNotes: parseProductContentField(content, 'Pagamento/condições:'),
    deliveryFee: parseProductContentField(content, 'Taxa de entrega:'),
    link: item.links?.[0]?.url ?? '',
    salesMeta: {
      aiSellable: item.salesMeta?.aiSellable !== false,
      saleMode: item.salesMeta?.saleMode ?? (item.links?.[0]?.url ? 'link_or_pix' : 'pix'),
      acceptsPix: item.salesMeta?.acceptsPix !== false,
      useCompanyWhatsapp: item.salesMeta?.useCompanyWhatsapp !== false,
      productWhatsapp: item.salesMeta?.productWhatsapp ?? '',
      responsibleSector: item.salesMeta?.responsibleSector ?? '',
      requireHumanReview: item.salesMeta?.requireHumanReview !== false,
      madeToOrder: item.salesMeta?.madeToOrder === true,
      deliveryFee: item.salesMeta?.deliveryFee ?? parseProductContentField(content, 'Taxa de entrega:'),
      requiresDeliveryAddress: item.salesMeta?.requiresDeliveryAddress === true,
    },
  }
}

function productMatchesRef(
  item: KnowledgeBaseItem,
  ref: { id?: string; title: string },
): boolean {
  if (item._delete) return false
  if ((item.category ?? 'Geral') !== PRODUCT_CATEGORY) return false
  if (ref.id && item.id) return item.id === ref.id
  return item.title.trim().toLowerCase() === ref.title.trim().toLowerCase()
}

function upsertProductInKnowledgeBase(
  knowledgeBase: KnowledgeBaseItem[],
  product: ProductDraft,
  editingRef?: { id?: string; title: string } | null,
): KnowledgeBaseItem[] {
  const next = [...knowledgeBase]
  const newItem = productDraftToKnowledgeItem(product)
  const normalizedName = product.name.trim().toLowerCase()

  if (editingRef) {
    const idx = next.findIndex(item => productMatchesRef(item, editingRef))
    if (idx >= 0) {
      next[idx] = { ...next[idx], ...newItem, id: next[idx].id || newItem.id }
      return next
    }
  }

  const dupIdx = next.findIndex(
    item =>
      !item._delete &&
      (item.category ?? 'Geral') === PRODUCT_CATEGORY &&
      item.title.trim().toLowerCase() === normalizedName,
  )
  if (dupIdx >= 0) {
    next[dupIdx] = { ...next[dupIdx], ...newItem, id: next[dupIdx].id }
    return next
  }

  next.push(newItem)
  return next
}

function productDraftToKnowledgeItem(product: ProductDraft): KnowledgeBaseItem {
  const title = product.name.trim() || 'Novo produto'
  const content = [
    `Produto: ${title}`,
    product.sku.trim() ? `SKU/código: ${product.sku.trim()}` : '',
    product.price.trim() ? `Valor atual: ${product.price.trim()}` : '',
    product.stock.trim() ? `Estoque disponível: ${product.stock.trim()}` : '',
    product.description.trim() ? `Descrição: ${product.description.trim()}` : '',
    product.paymentNotes.trim() ? `Pagamento/condições: ${product.paymentNotes.trim()}` : '',
    product.deliveryFee.trim() || product.salesMeta.deliveryFee?.trim()
      ? `Taxa de entrega: ${(product.deliveryFee.trim() || product.salesMeta.deliveryFee?.trim()) ?? ''}`
      : '',
    'Regra para a IA: informe preço, disponibilidade e link somente com base neste item. Se o produto tiver link de loja, envie o link quando o cliente preferir comprar pelo site. Para PIX no chat, colete endereço se necessário, informe taxa de entrega e oriente pagamento conforme configuração. Nunca confirme pagamento apenas com imagem de comprovante.',
  ]
    .filter(Boolean)
    .join('\n')

  return makeKnowledgeBaseItem({
    title,
    content,
    category: PRODUCT_CATEGORY,
    active: true,
    keywords: [title, product.sku, 'produto', 'estoque', 'comprar', 'valor']
      .map(k => k.trim())
      .filter(Boolean),
    links: product.link.trim()
      ? [{ label: `Ver ${title}`.slice(0, 80), url: product.link.trim(), openInNewTab: true }]
      : [],
    showAsQuickReply: true,
    quickReplyLabel: title.slice(0, 60),
    salesMeta: {
      ...product.salesMeta,
      deliveryFee: product.deliveryFee.trim() || product.salesMeta.deliveryFee,
    },
  })
}

export default function AiAtendimento() {
  const qc = useQueryClient()
  const [tab, setTab] = useUrlHashTab(AI_TAB_IDS, 'geral')
  const [form, setForm] = useState<AiPayload | null>(null)
  const [attendanceUi, setAttendanceUi] = useState<AttendanceUiSelection>({
    attendanceMode: 'disabled',
    credentialSource: 'none',
  })
  const [apiKeyInput, setApiKeyInput] = useState('')
  const [testResult, setTestResult] = useState<string | null>(null)
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft)
  const [editingProductRef, setEditingProductRef] = useState<{ id?: string; title: string } | null>(
    null,
  )

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canManage = can(me ?? null, 'inbox:ai:manage')

  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.get<AiPayload>('/platform/ai/settings'),
    enabled: canManage,
  })

  const { data: usageDetail } = useQuery({
    queryKey: ['ai-usage'],
    queryFn: () =>
      api.get<{
        rows: Array<{
          id: string
          createdAt: string
          usageKindLabel: string
          creditWeight?: number
          llmModel: string
          totalTokens: number
          estimatedCost: number
        }>
        totals: {
          calls: number
          tokens: number
          cost: number
          credits?: number
          byKind: {
            premium_assistant: { calls: number; tokens: number; cost: number; credits?: number }
            basic_triage: { calls: number; tokens: number; cost: number; credits?: number }
            unknown: { calls: number; tokens: number; cost: number; credits?: number }
          }
        }
        snapshot: AiPayload['usage']
      }>('/platform/ai/usage'),
    enabled: canManage && tab === 'logs',
  })

  useEffect(() => {
    if (!data) return undefined

    const nextForm: AiPayload = {
      ...data,
      catalogSales: data.catalogSales ?? {},
      skills: data.skills ?? [],
      memories: data.memories ?? [],
      prompt: {
        ...data.prompt,
        learnMemoryEnabled: data.prompt?.learnMemoryEnabled ?? true,
      },
    }
    const nextAttendanceUi = attendanceSelectionFromSettings(data.settings)
    const timer = window.setTimeout(() => {
      setForm(nextForm)
      setAttendanceUi(nextAttendanceUi)
    }, 0)

    return () => window.clearTimeout(timer)
  }, [data])

  const save = useMutation({
    mutationFn: (payload: Record<string, unknown>) =>
      api.patch<AiPayload>('/platform/ai/settings', payload),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      setAttendanceUi(attendanceSelectionFromSettings(res.settings))
      qc.setQueryData(['ai-settings'], res)
      setApiKeyInput('')
      notifyConfigSaved()
    },
    onError: mutationError,
  })

  const removeKey = useMutation({
    mutationFn: () => api.delete<AiPayload>('/platform/ai/key'),
    onSuccess: (res: AiPayload) => {
      setForm(res)
      qc.setQueryData(['ai-settings'], res)
    },
    onError: mutationError,
  })

  const testConn = useMutation({
    mutationFn: (apiKey?: string) =>
      api.post<{ ok: boolean; message: string }>('/platform/ai/test', apiKey ? { apiKey } : {}),
    onSuccess: r => setTestResult(r.ok ? `OK: ${r.message}` : `Falha: ${r.message}`),
  })

  const approveSkill = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/skills/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const rejectSkill = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/skills/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const approveMemory = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/memory/${id}/approve`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  const rejectMemory = useMutation({
    mutationFn: (id: string) => api.post(`/platform/ai/memory/${id}/reject`, {}),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['ai-settings'] }),
    onError: mutationError,
  })

  if (!canManage) {
    return (
      <PlatformPage title="IA de Atendimento">
        <p className="text-[var(--rz-text-muted)]">Sem permissão para configurar IA.</p>
      </PlatformPage>
    )
  }

  if (isLoading || !form) {
    return (
      <PlatformPage title="IA de Atendimento">
        <LoadingState rows={4} className="pt-4" />
      </PlatformPage>
    )
  }

  const patch = (partial: Partial<AiPayload['settings']>) =>
    setForm(f => {
      if (!f) return f
      const next = { ...f.settings, ...partial }
      let catalog = f.modelCatalog
      if (partial.provider && partial.provider !== f.settings.provider) {
        catalog = f.modelCatalogs[partial.provider]
        const first = catalog.find(m => m.recommended) ?? catalog[0]
        if (first) next.model = first.id
      }
      const pricing =
        catalog.find(m => m.id === next.model) ??
        (next.model === f.settings.model ? f.selectedModelPricing : null)
      return {
        ...f,
        settings: next,
        modelCatalog: catalog,
        selectedModelPricing: pricing ?? f.selectedModelPricing,
      }
    })

  const selectModel = (modelId: string) => {
    setForm(f => {
      if (!f) return f
      const pricing = f.modelCatalog.find(m => m.id === modelId) ?? f.selectedModelPricing
      return {
        ...f,
        settings: { ...f.settings, model: modelId },
        selectedModelPricing: pricing ?? f.selectedModelPricing,
      }
    })
  }
  const patchPrompt = (partial: Partial<AiPayload['prompt']>) =>
    setForm(f => (f ? { ...f, prompt: { ...f.prompt, ...partial } } : f))

  const applyAttendanceSelection = (next: AttendanceUiSelection) => {
    setAttendanceUi(next)
    const patchSettings = attendanceSettingsPatchFromSelection(next)
    patch(patchSettings)
  }

  const handleAttendanceModeSelect = (mode: AttendanceMode) => {
    let credentialSource = attendanceUi.credentialSource
    if (mode === 'premium_assistant' || mode === 'hybrid') {
      if (credentialSource === 'none') {
        credentialSource = form?.planLimits.radarchatAllowed ? 'radarchat' : 'company'
      }
    } else {
      credentialSource = 'none'
    }
    applyAttendanceSelection({ attendanceMode: mode, credentialSource })
    if (form) {
      const patchSettings = attendanceSettingsPatchFromSelection({
        attendanceMode: mode,
        credentialSource,
      })
      save.mutate({
        settings: { ...form.settings, ...patchSettings },
        prompt: { ...form.prompt },
        knowledgeBase: form.knowledgeBase,
        catalogSales: form.catalogSales,
        skills: form.skills,
        memories: form.memories,
      })
    }
    if (mode === 'robotic') {
      notifyInfo(
        'Modo robotizado ativo sem IA generativa. Configure menus em Triagem e Bot.',
      )
    }
    if (mode === 'hybrid') {
      notifyInfo(
        'Modo híbrido: menu, triagem básica e IA Premium opcional com fallback humano.',
      )
    }
  }

  const handleCredentialSourceSelect = (credentialSource: AiCredentialSource) => {
    if (credentialSource === 'none') return
    const mode =
      attendanceUi.attendanceMode === 'hybrid' ? 'hybrid' : 'premium_assistant'
    applyAttendanceSelection({
      attendanceMode: mode,
      credentialSource,
    })
  }

  const credentialSourceEnabled =
    attendanceUi.attendanceMode === 'premium_assistant' ||
    attendanceUi.attendanceMode === 'hybrid'

  const handleSave = () => {
    if (!form) return
    if (form.catalogSales?.useDistanceBasedDelivery) {
      const addrErr = deliveryAddressValidationError(form.catalogSales.deliveryOriginAddress)
      if (addrErr) {
        notifyError(`Entrega por distância: ${addrErr}`)
        return
      }
    }
    const patchSettings = attendanceSettingsPatchFromSelection(attendanceUi)
    const body: Record<string, unknown> = {
      settings: { ...form.settings, ...patchSettings },
      prompt: { ...form.prompt },
      knowledgeBase: form.knowledgeBase,
      catalogSales: form.catalogSales,
      skills: form.skills,
      memories: form.memories,
    }
    if (apiKeyInput.trim()) {
      ;(body.settings as Record<string, unknown>).apiKey = apiKeyInput.trim()
    }
    save.mutate(body)
  }

  const upsertKnowledgeArticle = (
    matcher: (item: KnowledgeBaseItem) => boolean,
    item: KnowledgeBaseItem,
  ) => {
    setForm(f => {
      if (!f) return f
      const knowledgeBase = [...f.knowledgeBase]
      const idx = knowledgeBase.findIndex(k => !k._delete && matcher(k))
      if (idx >= 0) {
        knowledgeBase[idx] = {
          ...knowledgeBase[idx],
          ...item,
          id: knowledgeBase[idx].id || item.id,
        }
      } else {
        knowledgeBase.push(item)
      }
      return { ...f, knowledgeBase }
    })
  }

  const updateSystemArticle = (
    title: string,
    category: string,
    content: string,
    extra?: Partial<KnowledgeBaseItem>,
  ) => {
    upsertKnowledgeArticle(
      item => item.title === title && (item.category ?? 'Geral') === category,
      makeKnowledgeBaseItem({
        title,
        category,
        content,
        active: true,
        keywords: extra?.keywords ?? [title, category],
        showAsQuickReply: extra?.showAsQuickReply ?? true,
        quickReplyLabel: extra?.quickReplyLabel ?? title.slice(0, 60),
        links: extra?.links ?? [],
        ...extra,
      }),
    )
  }

  const removeKnowledgeBaseItem = (idx: number) => {
    setForm(f => {
      if (!f) return f
      const knowledgeBase = [...f.knowledgeBase]
      if (!knowledgeBase[idx]) return f
      if (!knowledgeBase[idx].id) knowledgeBase.splice(idx, 1)
      else knowledgeBase[idx] = { ...knowledgeBase[idx], _delete: true }
      return { ...f, knowledgeBase }
    })
  }

  const removeSkillItem = (idx: number) => {
    setForm(f => {
      if (!f) return f
      const skills = [...(f.skills ?? [])]
      if (!skills[idx]) return f
      if (!skills[idx].id) skills.splice(idx, 1)
      else skills[idx] = { ...skills[idx], _delete: true }
      return { ...f, skills }
    })
  }

  const removeMemoryItem = (idx: number) => {
    setForm(f => {
      if (!f) return f
      const memories = [...(f.memories ?? [])]
      if (!memories[idx]) return f
      if (!memories[idx].id) memories.splice(idx, 1)
      else memories[idx] = { ...memories[idx], _delete: true }
      return { ...f, memories }
    })
  }

  const companyProfile = form.knowledgeBase.find(
    item => !item._delete && item.title === COMPANY_PROFILE_TITLE && item.category === COMPANY_CATEGORY,
  )
  const paymentGuide = form.knowledgeBase.find(
    item => !item._delete && item.title === PAYMENT_GUIDE_TITLE && item.category === PAYMENT_CATEGORY,
  )
  const productItems = form.knowledgeBase.filter(
    item => !item._delete && (item.category ?? 'Geral') === PRODUCT_CATEGORY,
  )
  const catalogSales = form.catalogSales ?? {}
  const catalogProfile = catalogSales.businessCatalogProfile ?? 'none'
  const productsModuleVisible = catalogProfile !== 'none'

  const updateCatalogSales = (patch: Partial<CatalogSalesCompanyConfig>) => {
    setForm(f => (f ? { ...f, catalogSales: { ...f.catalogSales, ...patch } } : f))
  }

  const syncPaymentGuideFromPixConfig = (instructions: string) => {
    const content = [
      instructions.trim(),
      '',
      'Regra para a IA: ao receber comprovante PIX por imagem ou PDF, informe que a equipe vai conferir. Nunca confirme pagamento apenas pela imagem.',
    ]
      .filter(Boolean)
      .join('\n')
    upsertKnowledgeArticle(
      k => k.title === PAYMENT_GUIDE_TITLE,
      makeKnowledgeBaseItem({
        title: PAYMENT_GUIDE_TITLE,
        content,
        category: PAYMENT_CATEGORY,
        active: true,
        keywords: ['pix', 'pagamento', 'comprovante', 'valor', 'venda'],
        quickReplyLabel: 'Pagamento e PIX',
      }),
    )
  }

  const patchCatalogSalesPix = (patch: Partial<CatalogSalesCompanyConfig>) => {
    const next = { ...catalogSales, ...patch }
    const pixInstructions = buildCatalogPixInstructions(next)
    setForm(f =>
      f ? { ...f, catalogSales: { ...next, pixInstructions } } : f,
    )
    syncPaymentGuideFromPixConfig(pixInstructions)
  }

  const scrollToCatalogPixConfig = () => {
    document.getElementById('catalog-pix-config')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const catalogPixExtraNotes = (catalogSales.pixInstructions ?? '')
    .split('\n')
    .filter(line => {
      const t = line.trim()
      if (!t) return false
      if (/^chave\s*pix\s*:/i.test(t)) return false
      if (/^titular\s*:/i.test(t)) return false
      return true
    })
    .join('\n')

  const canEditSalesWhatsapp = me ? can(me, 'company:sales-config:update') : false

  const saveProductDraft = () => {
    if (!productDraft.name.trim() && !productDraft.description.trim()) return
    setForm(f =>
      f
        ? {
            ...f,
            knowledgeBase: upsertProductInKnowledgeBase(
              f.knowledgeBase,
              productDraft,
              editingProductRef,
            ),
          }
        : f,
    )
    const wasEdit = Boolean(editingProductRef)
    setProductDraft(emptyProductDraft)
    setEditingProductRef(null)
    notifyInfo(
      wasEdit
        ? 'Produto atualizado na base. Clique em Salvar alterações para persistir.'
        : 'Produto adicionado à base. Clique em Salvar alterações para persistir.',
    )
  }

  const startEditProduct = (item: KnowledgeBaseItem) => {
    setProductDraft(knowledgeItemToProductDraft(item))
    setEditingProductRef({ id: item.id || undefined, title: item.title })
  }

  const cancelEditProduct = () => {
    setProductDraft(emptyProductDraft)
    setEditingProductRef(null)
  }

  const removeProductItem = (item: KnowledgeBaseItem) => {
    const idx = form.knowledgeBase.findIndex(kb => productMatchesRef(kb, { id: item.id, title: item.title }))
    if (idx >= 0) removeKnowledgeBaseItem(idx)
    if (
      editingProductRef &&
      productMatchesRef(item, editingProductRef)
    ) {
      cancelEditProduct()
    }
  }

  return (
    <PlatformPage
      title="IA de Atendimento"
      description="Triagem, base de conhecimento, skills e transferência para humano."
      compact
    >
      <InboxAtendimentoNav me={me} compact />

      <div className="space-y-3">
      <InboxStatsRow
        compact
        items={[
          {
            label: 'Modo de atendimento',
            value: attendanceModeLabel(attendanceUi.attendanceMode),
            icon: Sparkles,
            colorClass: isLegacyGenerativeAiActive(form.settings)
              ? 'text-emerald-400'
              : 'text-[var(--rz-text-muted)]',
            description: isLegacyGenerativeAiActive(form.settings)
              ? `IA Premium · ${credentialSourceLabel(attendanceUi.credentialSource)}`
              : attendanceUi.attendanceMode === 'robotic'
                ? 'Robotizado · sem LLM'
                : 'Sem IA generativa',
          },
          {
            label: 'Saldo créditos IA',
            value: form.usage.wallet
              ? formatCredits(form.usage.wallet.balance)
              : '—',
            icon: BarChart3,
            colorClass: form.usage.wallet?.depleted ? 'text-red-400' : 'text-emerald-400',
            description: 'Franquia mensal',
            alert: Boolean(form.usage.wallet?.depleted),
          },
          {
            label: 'Créditos gastos hoje',
            value: formatCredits(form.usage.dailyCreditsSpent ?? 0),
            icon: BarChart3,
            colorClass: 'text-violet-400',
            description: 'Custo real proporcional',
          },
          {
            label: 'Chamadas no mês',
            value: `${form.usage.monthlyUsed}/${form.usage.monthlyLimit}`,
            icon: BarChart3,
            colorClass: 'text-violet-400',
            description: usageUnitShort(form.usage.meteringMode),
          },
          {
            label: 'Skills pendentes',
            value: (form.skills ?? []).filter(s => !s._delete && s.status === 'pending').length,
            icon: Brain,
            colorClass: 'text-amber-400',
            description: 'Aguardando aprovação',
            alert: (form.skills ?? []).some(s => !s._delete && s.status === 'pending'),
          },
          {
            label: 'Memórias pendentes',
            value: (form.memories ?? []).filter(m => !m._delete && m.status === 'pending').length,
            icon: MessageSquare,
            colorClass: 'text-amber-400',
            description: 'Aguardando aprovação',
          },
          {
            label: 'Base ativa',
            value: form.knowledgeBase.filter(k => !k._delete && k.active).length,
            icon: BookOpen,
            colorClass: 'text-brand-400',
            description: `${form.knowledgeBase.filter(k => !k._delete).length} itens no total`,
          },
        ]}
      />

      {form.blueprintInfo && (
        <details className="rounded-lg border border-brand-800/40 bg-brand-950/20 text-xs text-[var(--rz-text-secondary)]">
          <summary className="cursor-pointer select-none px-3 py-2 text-brand-300/90 font-medium">
            Assistente pré-configurado pelo Radar Chat — o que personalizar
          </summary>
          <p className="px-3 pb-3 leading-relaxed">
            Personalidade e fluxo já vêm prontos. Alimente{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
              Base de conhecimento
            </button>
            ,{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
              Skills
            </button>{' '}
            e{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
              Memória
            </button>
            . Opcional: nome (Geral),{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('saudacoes')}>
              saudações
            </button>{' '}
            ,{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('regras')}>
              regras
            </button>{' '}
            e{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('empresa')}>
              empresa/catálogo
            </button>
            .
          </p>
        </details>
      )}

      <div className="rounded-lg bg-[var(--rz-surface-muted)]/60 border border-[var(--rz-border)]/80 overflow-hidden">
        <div className="flex gap-0.5 p-0.5 overflow-x-auto scrollbar-thin">
          {TABS.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={`shrink-0 px-2 py-1 rounded-md text-[11px] font-medium transition-colors whitespace-nowrap ${
                tab === t.id
                  ? 'bg-brand-500/15 text-brand-400 border border-brand-500/30'
                  : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] border border-transparent hover:bg-[var(--rz-surface-muted)]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {tab === 'geral' && (
        <Card className="p-4 space-y-4">
          <div>
            <h2 className="text-base font-medium flex items-center gap-2">
              <Settings2 className="w-4 h-4" /> Modo de atendimento e provedor
            </h2>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              Escolha <strong>como</strong> o atendimento se comporta e, no modo Premium,{' '}
              <strong>quem fornece</strong> a IA. O modo é salvo em{' '}
              <code className="text-[10px]">attendanceMode</code>; o runtime de LLM ainda usa{' '}
              <code className="text-[10px]">mode</code> legado em paralelo.
            </p>
          </div>

          <AttendanceModePicker
            selected={attendanceUi.attendanceMode}
            onSelect={handleAttendanceModeSelect}
          />

          <CredentialSourcePicker
            selected={attendanceUi.credentialSource}
            onSelect={handleCredentialSourceSelect}
            disabled={!credentialSourceEnabled}
            radarchatAllowed={form.planLimits.radarchatAllowed}
          />

          {attendanceUi.attendanceMode === 'robotic' && (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3 text-xs text-[var(--rz-text-secondary)]">
              O modo robotizado não ativa IA generativa. Menu de setores no WhatsApp e no chat do site.
              Configure textos e setores em{' '}
              <Link to="/platform/inbox/bot" className="text-brand-400 hover:underline">
                Triagem e Bot
              </Link>
              .
            </div>
          )}

          {attendanceUi.attendanceMode === 'basic_triage' && (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-[var(--rz-text-secondary)] space-y-2">
              <p>
                IA Básica usa classificador local e base de conhecimento — sem assistente conversacional
                completo. Encaminha para setores quando a intenção é clara. LLM opcional só em ambiguidade
                (aba <strong>Economia e regras</strong>).
              </p>
              <p className="text-amber-400/90">
                Expectativa de consumo: <strong>~1 crédito</strong> por atendimento típico com LLM.
                Triagem local e KB não geram custo. A cobrança real é pelo custo de cada chamada.
              </p>
            </div>
          )}

          {attendanceUi.attendanceMode === 'hybrid' && (
            <div className="rounded-lg border border-violet-500/30 bg-violet-500/5 p-3 text-xs text-[var(--rz-text-secondary)] space-y-2">
              <p>
                O modo híbrido usa menu de setores primeiro; mensagens livres passam por triagem básica.
                Com provedor configurado abaixo, IA Premium pode responder antes de encaminhar para humano.
              </p>
              <p>
                Configure setores em{' '}
                <Link to="/platform/inbox/bot" className="text-brand-400 hover:underline">
                  Triagem e Bot
                </Link>
                .
              </p>
            </div>
          )}

          {attendanceUi.attendanceMode === 'premium_assistant' && (
            <div className="rounded-lg border border-brand-500/30 bg-brand-500/5 p-3 text-xs text-[var(--rz-text-secondary)] space-y-2">
              <p>
                No WebChat, marque <strong>Usar IA Premium no widget</strong> em{' '}
                <Link to="/platform/webchat" className="text-brand-400 hover:underline">
                  WebChat
                </Link>{' '}
                (resposta automática). KB, skills e memória abaixo alimentam o assistente Premium.
              </p>
              {attendanceUi.credentialSource === 'radarchat' && (
                <p className="text-brand-400/90">
                  Expectativa de consumo: <strong>~2 créditos</strong> por turno típico de conversa.
                  Cada chamada LLM debita créditos conforme o custo real — Premium não é cobrado em dobro
                  automaticamente.
                </p>
              )}
              {attendanceUi.credentialSource === 'company' && (
                <p className="text-emerald-400/90">
                  Com chave própria, o limite abaixo conta <strong>chamadas</strong> — não debita créditos
                  Radar Chat.
                </p>
              )}
            </div>
          )}

          {form.usage.wallet?.depleted && (
            <div className="rounded-lg border border-red-500/40 bg-red-500/10 p-4 text-sm text-red-200">
              <strong>Saldo de créditos IA esgotado.</strong> Recarregue em{' '}
              <Link to="/plans" className="underline font-medium">
                Planos e cobrança
              </Link>
              , compre créditos extras ou configure{' '}
              <button
                type="button"
                className="underline font-medium"
                onClick={() => setTab('geral')}
              >
                API própria
              </button>{' '}
              na aba Provedor.
            </div>
          )}

          {form.usage.meteringMode === 'radarchat_calls' && form.usage.wallet && (
            <div className="rounded-lg border border-blue-500/30 bg-blue-500/5 p-4 space-y-3">
              <h3 className="text-sm font-medium text-blue-300 flex items-center gap-2">
                <BarChart3 className="w-4 h-4" /> Carteira de créditos IA (mensal)
              </h3>
              <p className="text-xs text-[var(--rz-text-secondary)]">
                Cada cliente recebe créditos mensais no plano. O gasto é proporcional ao custo real de
                cada chamada LLM. Ao esgotar: recarregar, comprar extras ou usar API própria.
              </p>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3 text-center text-xs">
                <div className="rounded-lg bg-[var(--rz-surface-muted)]/50 p-3">
                  <div className="text-lg font-semibold">
                    {formatCredits(form.usage.wallet.balance)}
                  </div>
                  <div className="text-[var(--rz-text-muted)]">Saldo disponível</div>
                </div>
                <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 p-3">
                  <div className="text-lg font-semibold">
                    {formatCredits(form.usage.wallet.usedThisMonth)} /{' '}
                    {formatCredits(form.usage.wallet.totalAllowance)}
                  </div>
                  <div className="text-[var(--rz-text-muted)]">Gasto / franquia</div>
                </div>
                <div className="rounded-lg bg-violet-500/10 border border-violet-500/20 p-3">
                  <div className="text-lg font-semibold">
                    {formatCredits(form.usage.wallet.purchased)}
                  </div>
                  <div className="text-[var(--rz-text-muted)]">Créditos comprados</div>
                </div>
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <div className="text-lg font-semibold">
                    {form.usage.wallet.learningUsed}/{form.usage.wallet.learningLimit}
                  </div>
                  <div className="text-[var(--rz-text-muted)]">Aprendizagem (mês)</div>
                </div>
              </div>
              {form.usage.wallet.learningDepleted && (
                <p className="text-xs text-amber-400">
                  Cota de aprendizagem (skills/memória automáticas) esgotada neste mês — consome
                  processamento da plataforma.
                </p>
              )}
              <p className="text-xs text-[var(--rz-text-muted)]">
                Incluídos no plano: {form.usage.wallet.monthlyIncluded} créditos ·{' '}
                {form.usage.wallet.learningLimit} ops de aprendizagem/mês
              </p>
            </div>
          )}

          {form.blueprintInfo && (
            <div className="rounded-lg border border-[var(--rz-border)] p-4 space-y-3">
              <div>
                <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                  Nome do assistente virtual
                </label>
                <input
                  className={inputCls}
                  value={form.prompt.agentName ?? ''}
                  onChange={e => patchPrompt({ agentName: e.target.value })}
                  placeholder={form.blueprintInfo.defaultAgentName || 'Assistente'}
                  disabled={!credentialSourceEnabled}
                />
                <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                  Usado no modo <strong>IA Premium</strong>. Vazio usa o padrão Radar Chat (
                  <em>{form.blueprintInfo.defaultAgentName}</em>). Saudações na aba{' '}
                  <button
                    type="button"
                    className="text-brand-400 hover:underline"
                    onClick={() => setTab('saudacoes')}
                  >
                    Saudações
                  </button>
                  .
                </p>
              </div>
            </div>
          )}

          <p className="text-xs text-[var(--rz-text-muted)] border-t border-[var(--rz-border)] pt-4">
            Chamadas hoje: {form.usage.dailyUsed}/{form.usage.dailyLimit} · Créditos gastos:{' '}
            {formatCredits(form.usage.dailyCreditsSpent ?? 0)} · Mês: {form.usage.monthlyUsed}/
            {form.usage.monthlyLimit} chamadas (
            {formatCredits(form.usage.monthlyCreditsSpent ?? 0)} créditos)
          </p>
        </Card>
      )}

      {tab === 'saudacoes' && form.blueprintInfo && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Hand className="w-5 h-5" /> Saudações da IA
          </h2>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 text-sm text-[var(--rz-text-secondary)]">
            <p>
              Primeira mensagem automática quando a IA assume o atendimento no <strong>WhatsApp</strong>.
              No chat do site, a conversa segue o fluxo da triagem (nome já vem do formulário).
            </p>
            <p className="text-xs text-[var(--rz-text-muted)] mt-2">
              Variáveis: {'{companyName}'}, {'{agentName}'}, {'{customerName}'} (apenas no cliente
              conhecido). Deixe em branco para usar o padrão Radar Chat.
            </p>
          </div>
          <div className="space-y-4">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                Cliente com nome no cadastro
              </label>
              <textarea
                className={`${textareaCls} min-h-[100px] text-sm`}
                value={form.prompt.greetingKnown ?? ''}
                onChange={e => patchPrompt({ greetingKnown: e.target.value })}
                placeholder={form.blueprintInfo.defaultGreetingKnown}
              />
              <button
                type="button"
                className="text-xs text-brand-400 hover:underline mt-1"
                onClick={() => patchPrompt({ greetingKnown: '' })}
              >
                Usar padrão Radar Chat
              </button>
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
                Cliente sem nome no cadastro
              </label>
              <textarea
                className={`${textareaCls} min-h-[100px] text-sm`}
                value={form.prompt.greetingUnknown ?? ''}
                onChange={e => patchPrompt({ greetingUnknown: e.target.value })}
                placeholder={form.blueprintInfo.defaultGreetingUnknown}
              />
              <button
                type="button"
                className="text-xs text-brand-400 hover:underline mt-1"
                onClick={() => patchPrompt({ greetingUnknown: '' })}
              >
                Usar padrão Radar Chat
              </button>
            </div>
          </div>
        </Card>
      )}

      {tab === 'provedor' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Modelo LLM e parâmetros</h2>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Credencial da IA (Radar Chat ou chave própria) fica na aba{' '}
            <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('geral')}>
              Geral
            </button>
            . Aqui você escolhe o <strong>motor</strong> (OpenAI ou Gemini), modelo, temperature e API Key
            quando usar chave própria.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Provedor</label>
              <select
                className={inputCls}
                value={form.settings.provider}
                onChange={e => patch({ provider: e.target.value as 'openai' | 'gemini' })}
                disabled={form.settings.mode !== 'company'}
              >
                <option value="openai">OpenAI</option>
                <option value="gemini">Google Gemini</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="text-xs text-[var(--rz-text-muted)] mb-2 block">Modelo e preço (por 1M tokens)</label>
              <AiModelPicker
                models={form.modelCatalog}
                selectedId={form.settings.model}
                onSelect={selectModel}
                disabled={form.settings.mode !== 'company'}
                dailyLimit={form.settings.dailyLimit}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Temperature ({form.settings.temperature})</label>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={form.settings.temperature}
                onChange={e => patch({ temperature: Number(e.target.value) })}
                className="w-full"
              />
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)]">Max tokens</label>
              <input
                type="number"
                min={400}
                max={4096}
                className={inputCls}
                value={form.settings.maxTokens}
                onChange={e => patch({ maxTokens: Math.max(400, Number(e.target.value)) })}
              />
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">Mínimo 400 — valores baixos truncam a resposta (ex.: &quot;Here&quot;).</p>
            </div>
          </div>
          {form.settings.mode === 'company' && (
            <div className="border-t border-[var(--rz-border)] pt-4 space-y-3">
              <p className="text-sm text-[var(--rz-text-muted)]">
                Chave salva: {form.hasApiKey ? form.apiKeyMasked : 'nenhuma'}
              </p>
              <input
                type="password"
                className={inputCls}
                placeholder="Nova API Key (não exibida após salvar)"
                value={apiKeyInput}
                onChange={e => setApiKeyInput(e.target.value)}
                autoComplete="off"
              />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="secondary" onClick={() => testConn.mutate(apiKeyInput || undefined)}>
                  <Zap className="w-4 h-4 mr-1" /> Testar conexão
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => removeKey.mutate()}
                  disabled={!form.hasApiKey}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Remover chave
                </Button>
              </div>
              {testResult && <p className="text-sm text-[var(--rz-text-secondary)]">{testResult}</p>}
            </div>
          )}
        </Card>
      )}

      {tab === 'regras' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5" /> Economia de créditos e regras da empresa
          </h2>
          <p className="text-xs text-[var(--rz-text-muted)]">
            O assistente já vem com triagem e comportamento padrão do Radar Chat. Aqui você ajusta
            economia de créditos e regras específicas do seu negócio (horários, produtos, o que não
            oferecer).
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {(
              [
                ['useSystemContext', 'Usar dados do cadastro (nome, e-mail, tickets)'],
                ['skipKnownFields', 'Não pedir dados que já existem no contato'],
                ['autoResolveEnabled', 'Resolver com base de conhecimento antes da IA (sem gastar crédito)'],
                ...(attendanceUi.attendanceMode === 'basic_triage'
                  ? ([
                      [
                        'basicTriageLlmFallbackEnabled',
                        'IA Básica: usar LLM Radar Chat só quando classificador local tiver baixa confiança',
                      ],
                    ] as const)
                  : []),
                ['learnSkillsEnabled', 'Aprender skills ao escalar (dono aprova depois)'],
                ['learnMemoryEnabled', 'Aprender memória curada ao escalar (dono aprova depois)'],
              ] as const
            ).map(([key, label]) => (
              <label key={key} className="flex items-start gap-2 text-sm">
                <input
                  type="checkbox"
                  className="mt-1"
                  checked={form.prompt[key]}
                  onChange={e => patchPrompt({ [key]: e.target.checked })}
                />
                {label}
              </label>
            ))}
          </div>
          {form.usage.wallet && (
            <p className="text-xs text-[var(--rz-text-muted)] rounded-lg border border-amber-500/20 bg-amber-500/5 p-3">
              Aprendizagem automática (skills/memória ao escalar) consome processamento e conta na cota
              mensal: {form.usage.wallet.learningUsed}/{form.usage.wallet.learningLimit} operações neste
              ciclo.
            </p>
          )}
          <div>
            <label className="text-xs text-[var(--rz-text-muted)] block mb-1">
              Regras adicionais da sua empresa (opcional)
            </label>
            <textarea
              className={textareaClsAi}
              placeholder="Ex.: Não oferecer desconto. Horário 8h–18h. Produto principal: rastreador veicular."
              value={form.prompt.customRules}
              onChange={e => patchPrompt({ customRules: e.target.value })}
            />
          </div>
        </Card>
      )}

      {tab === 'coleta' && (
        <Card className="p-6 space-y-6">
          <div>
            <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Dados do contato</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['collectName', 'Nome'],
                  ['collectEmail', 'E-mail'],
                  ['collectPhone', 'Telefone / WhatsApp'],
                  ['collectCompany', 'Empresa'],
                  ['collectCpfCnpj', 'CPF/CNPJ'],
                  ['collectAddress', 'Endereço completo'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.prompt[key]}
                    onChange={e => patchPrompt({ [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-medium text-[var(--rz-text-secondary)] mb-3">Atendimento</h3>
            <div className="grid sm:grid-cols-2 gap-3">
              {(
                [
                  ['collectProblem', 'Problema / motivo'],
                  ['collectUrgency', 'Urgência'],
                  ['collectOrderNumber', 'Número do pedido'],
                  ['collectAttachments', 'Anexos / fotos'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.prompt[key]}
                    onChange={e => patchPrompt({ [key]: e.target.checked })}
                  />
                  {label}
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-lg border border-[var(--rz-border)] p-4 space-y-3">
            <h3 className="text-sm font-medium">Entrega e logística</h3>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Ative o requisito de entrega para pedidos PIX com endereço, frete por distância e cotação
              automática pelo sistema (aba Empresa e catálogo).
            </p>
            <label className="flex items-center gap-2 text-sm font-medium">
              <input
                type="checkbox"
                checked={form.catalogSales?.requireDeliveryAddress !== false}
                onChange={e => {
                  const on = e.target.checked
                  updateCatalogSales({
                    requireDeliveryAddress: on,
                    forceCollectAddress: on,
                    useDistanceBasedDelivery: on
                      ? form.catalogSales?.useDistanceBasedDelivery
                      : false,
                  })
                  patchPrompt({
                    collectAddress: on ? true : form.prompt.collectAddress,
                    collectDeliveryNotes: on ? true : form.prompt.collectDeliveryNotes,
                  })
                }}
              />
              Exigir endereço antes do PIX (padrão ativo — evita enviar chave antes da entrega)
            </label>
            <div
              className={`grid sm:grid-cols-2 gap-3 pt-1 ${
                form.catalogSales?.requireDeliveryAddress ? '' : 'opacity-50 pointer-events-none'
              }`}
            >
              {(
                [
                  ['collectDeliveryNotes', 'Complemento / referência'],
                  ['collectPreferredSchedule', 'Horário preferido'],
                ] as const
              ).map(([key, label]) => (
                <label key={key} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={form.prompt[key]}
                    onChange={e => patchPrompt({ [key]: e.target.checked })}
                    disabled={!form.catalogSales?.requireDeliveryAddress}
                  />
                  {label}
                </label>
              ))}
            </div>
            {form.catalogSales?.requireDeliveryAddress && (
              <p className="text-xs text-[var(--rz-text-muted)]">
                No WhatsApp o cliente pode enviar o <strong>pin de localização fixa</strong> — o sistema
                calcula o frete pela rota. Se o pin não tiver número confiável, pede rua e número antes de cotar
                (sem a IA informar valores).
              </p>
            )}
          </div>
        </Card>
      )}

      {tab === 'empresa' && (
        <Card className="p-6 space-y-5">
          <div>
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Store className="w-5 h-5" /> Empresa e inteligência comercial
            </h2>
            <p className="text-xs text-[var(--rz-text-muted)] mt-1">
              Perfil comercial, ativação do catálogo na IA e orientações de comportamento. Produtos,
              PIX, pedidos e frete estão no menu{' '}
              <Link to="/platform/produtos" className="text-brand-400 hover:underline">
                Produtos
              </Link>
              .
            </p>
          </div>

          <div className="rounded-lg border border-amber-800/35 bg-amber-950/15 p-4 space-y-3">
            <h3 className="text-sm font-medium">Perfil comercial do negócio</h3>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Só libere <strong>Produtos e estoque</strong> se o atendimento vende pelo chat. Negócios de
              suporte, assinatura ou consultoria devem manter <em>Sem catálogo</em> para a IA não misturar
              fluxo de entrega/PIX com outros padrões.
            </p>
            <label className="block text-sm">
              <span className="text-[var(--rz-text-secondary)] mb-1 block">Setor / modelo</span>
              <select
                className={inputCls}
                value={catalogProfile}
                onChange={e => {
                  const profile = e.target.value as CatalogSalesCompanyConfig['businessCatalogProfile']
                  const patch: Partial<CatalogSalesCompanyConfig> = {
                    businessCatalogProfile: profile ?? 'none',
                  }
                  if (profile === 'retail_delivery') {
                    patch.requireDeliveryAddress = true
                    patch.forceCollectAddress = true
                  }
                  if (profile === 'none') {
                    patch.enabled = false
                  }
                  updateCatalogSales(patch)
                }}
              >
                <option value="none">Sem catálogo (suporte, planos, consultoria)</option>
                <option value="retail_delivery">Varejo com entrega (frete + PIX após endereço)</option>
                <option value="retail_pickup">Varejo com retirada na loja</option>
                <option value="catalog_general">Catálogo geral (produtos sem logística obrigatória)</option>
              </select>
            </label>
            {catalogProfile !== 'none' && catalogSales.enabled !== true && (
              <p className="text-xs text-amber-300/90">
                Perfil selecionado — ative também <strong>Pedidos via IA/catálogo</strong> abaixo para a IA
                usar o fluxo de compra.
              </p>
            )}
          </div>

          <div className="rounded-lg border border-[var(--rz-border)] p-4 space-y-2">
            <h3 className="text-sm font-medium flex items-center gap-2">
              <Store className="w-4 h-4" /> O que a empresa faz
            </h3>
            <textarea
              className={textareaClsAi}
              value={companyProfile?.content ?? ''}
              onChange={e =>
                updateSystemArticle(COMPANY_PROFILE_TITLE, COMPANY_CATEGORY, e.target.value, {
                  keywords: ['empresa', 'sobre', 'quem somos', 'serviços', 'o que faz'],
                  quickReplyLabel: 'Sobre a empresa',
                })
              }
              placeholder="Explique em linguagem simples: o que a empresa vende/faz, para quem atende, região, diferenciais, horários e como contratar."
            />
          </div>

          {productsModuleVisible ? (
            <AiEmpresaCatalogSection
              catalogSales={catalogSales}
              updateCatalogSales={updateCatalogSales}
              productItems={productItems as import('../../lib/catalog/productKnowledge').KnowledgeBaseItem[]}
            />
          ) : (
            <p className="text-xs text-[var(--rz-text-muted)] rounded-lg border border-dashed border-[var(--rz-border)] p-4">
              Selecione um perfil comercial acima (ex.: varejo com entrega) para cadastrar produtos, PIX e
              frete. Enquanto isso, a IA usa apenas o texto &quot;O que a empresa faz&quot; e ignora artigos de
              Produtos/Pagamentos na base.
            </p>
          )}
        </Card>
      )}

      {tab === 'skills' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <Brain className="w-5 h-5" /> Skills da empresa
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        skills: [
                          ...f.skills,
                          {
                            id: '',
                            title: 'Nova skill',
                            triggers: '',
                            solution: '',
                            status: 'approved',
                            source: 'manual',
                            usageCount: 0,
                            updatedAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar manual
            </Button>
          </div>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                <strong>Skills</strong> são <em>receitas de solução</em>: quando o cliente descreve um problema
                recorrente, a IA segue o passo a passo que você cadastrou — muitas vezes <strong>sem chamar
                atendente</strong> e sem gastar créditos extras de IA.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> nome curto do problema — ex. &quot;Rastreador offline&quot;, &quot;App não
                  conecta&quot;.
                </li>
                <li>
                  <strong>Gatilhos:</strong> palavras que o cliente costuma usar — ex. &quot;offline, sem sinal,
                  parou de atualizar, gps&quot;.
                </li>
                <li>
                  <strong>Solução:</strong> instruções claras em ordem — ex. reiniciar equipamento, conferir
                  cabo, reinstalar app.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> use Skills para <em>resolver um problema</em>. Use a{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
                Base de conhecimento
              </button>{' '}
              para informações gerais (preços, planos, políticas) e{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
                Memória
              </button>{' '}
              para fatos curtos que valem em qualquer conversa. Itens <em>pendentes</em> podem surgir do
              aprendizado após atendimentos — você aprova ou rejeita antes de entrarem no ar.
            </p>
          </div>
          {(form.skills ?? []).filter(s => !s._delete).length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma skill ainda. A IA pode propor após atendimentos.</p>
          )}
          {(form.skills ?? []).map((skill, idx) => skill._delete ? null : (
            <div
              key={skill.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                skill.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : skill.status === 'rejected'
                    ? 'border-[var(--rz-border)] opacity-60'
                    : 'border-[var(--rz-border)]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">
                  {skill.status === 'pending' && 'Pendente aprovação'}
                  {skill.status === 'approved' && 'Aprovada'}
                  {skill.status === 'rejected' && 'Rejeitada'}
                  {skill.source === 'learned' && ' · aprendida'}
                  {skill.usageCount > 0 && ` · ${skill.usageCount} usos`}
                </span>
                <div className="flex flex-wrap gap-2">
                  {skill.status !== 'approved' && skill.id && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => approveSkill.mutate(skill.id)}
                      disabled={approveSkill.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                  )}
                  {skill.status === 'pending' && skill.id && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => rejectSkill.mutate(skill.id)}
                      disabled={rejectSkill.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeSkillItem(idx)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
              <input
                className={inputCls}
                value={skill.title}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Ex.: Rastreador offline / App não conecta"
              />
              <input
                className={inputCls}
                value={skill.triggers}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], triggers: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Ex.: offline, sem sinal, parou, não atualiza, gps"
              />
              <textarea
                className={textareaClsAi}
                value={skill.solution}
                onChange={e => {
                  const skills = [...(form.skills ?? [])]
                  skills[idx] = { ...skills[idx], solution: e.target.value }
                  setForm(f => (f ? { ...f, skills } : f))
                }}
                placeholder="Passo a passo para o cliente seguir. Ex.: 1) Desligue o rastreador por 30s. 2) Verifique se o LED pisca verde. 3) Abra o app e atualize a posição."
              />
              {skill.sourceProblem && (
                <p className="text-xs text-[var(--rz-text-muted)]">Problema origem: {skill.sourceProblem}</p>
              )}
            </div>
          ))}
        </Card>
      )}

      {tab === 'memory' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <MessageSquare className="w-5 h-5" /> Memória curada (MEMORY)
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        memories: [
                          ...(f.memories ?? []),
                          {
                            id: '',
                            title: 'Novo fato',
                            content: '',
                            tags: '',
                            status: 'approved',
                            source: 'manual',
                            usageCount: 0,
                            updatedAt: new Date().toISOString(),
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar manual
            </Button>
          </div>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                <strong>Memória</strong> guarda <em>fatos curtos e permanentes</em> que a IA deve lembrar em
                qualquer atendimento — regras internas, exceções, promoções vigentes ou decisões da empresa.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> rótulo do fato — ex. &quot;Promoção março&quot;, &quot;Plano VIP&quot;.
                </li>
                <li>
                  <strong>Tags:</strong> palavras para a IA achar o fato — ex. &quot;promoção, desconto,
                  vip, plano anual&quot;.
                </li>
                <li>
                  <strong>Conteúdo:</strong> o fato em 1–3 frases — ex. &quot;Em março o plano anual tem 20%
                  de desconto&quot; ou &quot;Não vendemos mais o plano Básico 2019&quot;.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> Memória é um <em>lembrete rápido</em>, não um tutorial (isso é{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
                Skill
              </button>
              ) nem um artigo longo (isso é{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('kb')}>
                Base de conhecimento
              </button>
              ). Sugestões aprendidas em atendimentos ficam <em>pendentes</em> até você aprovar.
            </p>
          </div>
          {(form.memories ?? []).filter(m => !m._delete).length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">Nenhuma memória ainda.</p>
          )}
          {(form.memories ?? []).map((mem, idx) => mem._delete ? null : (
            <div
              key={mem.id || idx}
              className={`border rounded-lg p-4 space-y-2 ${
                mem.status === 'pending'
                  ? 'border-amber-700/50 bg-amber-950/20'
                  : mem.status === 'rejected'
                    ? 'border-[var(--rz-border)] opacity-60'
                    : 'border-[var(--rz-border)]'
              }`}
            >
              <div className="flex flex-wrap items-center gap-2 justify-between">
                <span className="text-xs uppercase tracking-wide text-[var(--rz-text-muted)]">
                  {mem.status === 'pending' && 'Pendente aprovação'}
                  {mem.status === 'approved' && 'Aprovada'}
                  {mem.status === 'rejected' && 'Rejeitada'}
                  {mem.source === 'learned' && ' · aprendida'}
                </span>
                <div className="flex flex-wrap gap-2">
                  {mem.status !== 'approved' && mem.id && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => approveMemory.mutate(mem.id)}
                      disabled={approveMemory.isPending}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" /> Aprovar
                    </Button>
                  )}
                  {mem.status === 'pending' && mem.id && (
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => rejectMemory.mutate(mem.id)}
                      disabled={rejectMemory.isPending}
                    >
                      <XCircle className="w-4 h-4 mr-1" /> Rejeitar
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="danger"
                    size="sm"
                    onClick={() => removeMemoryItem(idx)}
                  >
                    <Trash2 className="w-4 h-4 mr-1" /> Excluir
                  </Button>
                </div>
              </div>
              <input
                className={inputCls}
                value={mem.title}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Ex.: Promoção março / Plano VIP / Horário especial"
              />
              <input
                className={inputCls}
                value={mem.tags}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], tags: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Ex.: promoção, desconto, vip, plano anual"
              />
              <textarea
                className={textareaClsAi}
                value={mem.content}
                onChange={e => {
                  const memories = [...(form.memories ?? [])]
                  memories[idx] = { ...memories[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, memories } : f))
                }}
                placeholder="Fato em poucas frases. Ex.: Em março o plano anual tem 20% de desconto. / Clientes VIP têm suporte prioritário."
              />
            </div>
          ))}
        </Card>
      )}

      {tab === 'kb' && (
        <Card className="p-6 space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-medium flex items-center gap-2">
              <BookOpen className="w-5 h-5" /> Base de conhecimento
            </h2>
            <Button
              type="button"
              variant="secondary"
              onClick={() =>
                setForm(f =>
                  f
                    ? {
                        ...f,
                        knowledgeBase: [
                          ...f.knowledgeBase,
                          {
                            id: '',
                            title: 'Novo item',
                            content: '',
                            category: 'Geral',
                            active: true,
                            keywords: [],
                            links: [],
                            showAsQuickReply: false,
                          },
                        ],
                      }
                    : f,
                )
              }
            >
              Adicionar
            </Button>
          </div>
          <div className="rounded-lg border border-brand-800/30 bg-brand-950/15 p-4 space-y-3 text-sm text-[var(--rz-text-secondary)]">
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">Para que serve</p>
              <p className="mt-1">
                A <strong>Base de conhecimento</strong> é o <em>FAQ oficial</em> da sua empresa: produtos,
                serviços, preços, horários, políticas, promoções e qualquer informação que o cliente possa
                perguntar. A IA busca os itens mais relevantes na mensagem e responde com base neles.
              </p>
            </div>
            <div>
              <p className="font-medium text-[var(--rz-text-primary)]">O que colocar aqui</p>
              <ul className="mt-1 list-disc pl-5 space-y-1">
                <li>
                  <strong>Título:</strong> tema da pergunta — ex. &quot;Planos e preços&quot;, &quot;Horário de
                  atendimento&quot;, &quot;Como contratar&quot;.
                </li>
                <li>
                  <strong>Categoria:</strong> agrupa artigos no botão <strong>FAQ</strong> do chat do site — ex.
                  &quot;Planos&quot;, &quot;Suporte&quot;, &quot;Contratação&quot;.
                </li>
                <li>
                  <strong>Conteúdo:</strong> texto completo e oficial — valores, condições, passos de
                  contratação, o que está incluso em cada plano, links úteis.
                </li>
              </ul>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              <strong>Diferença:</strong> use a base para <em>informar</em> (o que vendemos, quanto custa, como
              funciona). Use{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('skills')}>
                Skills
              </button>{' '}
              para <em>resolver problemas</em> com passo a passo e{' '}
              <button type="button" className="text-brand-400 hover:underline" onClick={() => setTab('memory')}>
                Memória
              </button>{' '}
              para fatos curtos que valem em qualquer conversa. Só itens <strong>ativos</strong> entram na
              busca — desative os desatualizados em vez de apagar.
            </p>
          </div>
          {form.knowledgeBase.filter(k => !k._delete).length === 0 && (
            <p className="text-sm text-[var(--rz-text-muted)]">
              Nenhum item ainda. Comece pelos temas que os clientes mais perguntam: planos, preços, suporte e
              como contratar.
            </p>
          )}
          {form.knowledgeBase.map((item, idx) => item._delete ? null : (
            <div key={item.id || idx} className="border border-[var(--rz-border)] rounded-lg p-4 space-y-2">
              <div className="grid gap-2 sm:grid-cols-2">
                <input
                  className={inputCls}
                  value={item.category ?? 'Geral'}
                  list="kb-category-suggestions"
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], category: e.target.value }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                  placeholder="Categoria — ex.: Planos, Suporte, Contratação"
                />
                <p className="text-xs text-[var(--rz-text-muted)] self-center sm:text-right">
                  Agrupa no botão FAQ do chat do site
                </p>
              </div>
              <input
                className={inputCls}
                value={item.title}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], title: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Ex.: Planos e preços / Horário de atendimento / Promoções vigentes"
              />
              <textarea
                className={textareaClsAi}
                value={item.content}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = { ...kb[idx], content: e.target.value }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Texto oficial com todas as informações. Ex.: Oferecemos planos Mensal (R$ 49), Anual (R$ 490 com 2 meses grátis) e VIP (R$ 99/mês com suporte prioritário). Horário comercial: seg–sex 8h–18h."
              />
              <input
                className={inputCls}
                value={(item.keywords ?? []).join(', ')}
                onChange={e => {
                  const kb = [...form.knowledgeBase]
                  kb[idx] = {
                    ...kb[idx],
                    keywords: e.target.value
                      .split(',')
                      .map(s => s.trim())
                      .filter(Boolean),
                  }
                  setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                }}
                placeholder="Palavras-chave (separadas por vírgula): rastreio, pedido, entrega"
              />
              <div className="space-y-2">
                <p className="text-xs text-[var(--rz-text-muted)]">Links no chat (rótulo + URL https)</p>
                {(item.links ?? []).map((link, linkIdx) => (
                  <div key={linkIdx} className="flex flex-col sm:flex-row gap-2">
                    <input
                      className={inputCls}
                      value={link.label}
                      placeholder="Rótulo — ex.: Acompanhar pedido"
                      onChange={e => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links[linkIdx] = { ...links[linkIdx], label: e.target.value }
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    />
                    <input
                      className={inputCls}
                      value={link.url}
                      placeholder="https://…"
                      onChange={e => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links[linkIdx] = { ...links[linkIdx], url: e.target.value }
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => {
                        const kb = [...form.knowledgeBase]
                        const links = [...(kb[idx].links ?? [])]
                        links.splice(linkIdx, 1)
                        kb[idx] = { ...kb[idx], links }
                        setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = {
                      ...kb[idx],
                      links: [...(kb[idx].links ?? []), { label: '', url: '', openInNewTab: true }],
                    }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                >
                  Adicionar link
                </Button>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={Boolean(item.showAsQuickReply)}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], showAsQuickReply: e.target.checked }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                />
                Sugestão rápida no chat do site
              </label>
              {item.showAsQuickReply && (
                <input
                  className={inputCls}
                  value={item.quickReplyLabel ?? ''}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], quickReplyLabel: e.target.value }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                  placeholder="Texto do botão (opcional — usa o título se vazio)"
                />
              )}
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={item.active}
                  onChange={e => {
                    const kb = [...form.knowledgeBase]
                    kb[idx] = { ...kb[idx], active: e.target.checked }
                    setForm(f => (f ? { ...f, knowledgeBase: kb } : f))
                  }}
                />
                Ativo
              </label>
              <div className="flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="danger"
                  size="sm"
                  onClick={() => removeKnowledgeBaseItem(idx)}
                >
                  <Trash2 className="w-4 h-4 mr-1" /> Excluir item
                </Button>
              </div>
            </div>
          ))}
          <datalist id="kb-category-suggestions">
            {[...new Set(form.knowledgeBase.filter(k => !k._delete).map(k => (k.category?.trim() || 'Geral')))]
              .sort((a, b) => a.localeCompare(b, 'pt-BR'))
              .map(cat => (
                <option key={cat} value={cat} />
              ))}
          </datalist>
        </Card>
      )}

      {tab === 'limites' && (
        <Card className="p-6 grid md:grid-cols-3 gap-4">
          <div className="md:col-span-3 rounded-lg border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40 p-3 text-xs text-[var(--rz-text-secondary)]">
            {form.usage.meteringMode === 'company_calls' ? (
              <p>
                Com <strong>chave própria</strong>, os limites contam <strong>chamadas LLM</strong>. O
                custo externo fica com a empresa — sem débito de créditos Radar Chat.
              </p>
            ) : (
              <p>
                Com <strong>Radar Chat</strong>, o limite do plano é em <strong>chamadas LLM</strong> (1 por
                resposta, igual para Básica e Premium). Os <strong>créditos gastos</strong> refletem o
                custo real de cada chamada — cobrança proporcional ao consumo do cliente.
              </p>
            )}
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">
              Limite diário (chamadas LLM)
            </label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.dailyLimit}
              onChange={e => patch({ dailyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">
              Limite mensal (chamadas LLM)
            </label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.monthlyLimit}
              onChange={e => patch({ monthlyLimit: Number(e.target.value) })}
            />
          </div>
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Por conversa</label>
            <input
              type="number"
              className={inputCls}
              value={form.settings.perConversationLimit}
              onChange={e => patch({ perConversationLimit: Number(e.target.value) })}
            />
          </div>
          <p className="md:col-span-3 text-xs text-[var(--rz-text-muted)]">
            Plano Radar Chat: máx. {form.planLimits.dailyLimit} chamadas/dia ·{' '}
            {form.planLimits.monthlyLimit} chamadas/mês · Créditos gastos hoje:{' '}
            {formatCredits(form.usage.dailyCreditsSpent ?? 0)}
          </p>
        </Card>
      )}

      {tab === 'transferencia' && (
        <Card className="p-6 grid sm:grid-cols-2 gap-3">
          <h2 className="sm:col-span-2 text-lg font-medium flex items-center gap-2">
            <Shield className="w-5 h-5" /> Quando transferir para humano
          </h2>
          {(
            [
              ['onHumanRequest', 'Cliente pedir atendente'],
              ['onAngryClient', 'Cliente irritado'],
              ['onCancellation', 'Cancelamento'],
              ['onLegal', 'Assunto jurídico'],
              ['onLowConfidence', 'Baixa confiança'],
              ['onRepeatedQuestion', 'Pergunta repetida'],
              ['onMinDataCollected', 'Dados mínimos coletados'],
              ['onSensitiveMessage', 'Mensagem sensível'],
              ['onUninterpretableMedia', 'Mídia não interpretável'],
            ] as const
          ).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={Boolean(form.settings.transferRules[key])}
                onChange={e =>
                  patch({
                    transferRules: { ...form.settings.transferRules, [key]: e.target.checked },
                  })
                }
              />
              {label}
            </label>
          ))}
          <div>
            <label className="text-xs text-[var(--rz-text-muted)]">Limiar confiança</label>
            <input
              type="number"
              step={0.05}
              min={0}
              max={1}
              className={inputCls}
              value={Number(form.settings.transferRules.lowConfidenceThreshold ?? 0.45)}
              onChange={e =>
                patch({
                  transferRules: {
                    ...form.settings.transferRules,
                    lowConfidenceThreshold: Number(e.target.value),
                  },
                })
              }
            />
          </div>
        </Card>
      )}

      {tab === 'logs' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium flex items-center gap-2">
            <BarChart3 className="w-5 h-5" /> Uso e custos estimados
          </h2>
          <p className="text-xs text-[var(--rz-text-muted)]">
            Período padrão: últimos 30 dias. Créditos = custo real proporcional; expectativa Básica ~1 ·
            Premium ~2 por atendimento típico.
          </p>
          {usageDetail && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-center">
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">{usageDetail.totals.calls}</div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Total chamadas</div>
                </div>
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {formatCredits(usageDetail.totals.credits ?? 0)}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Créditos (gasto real)</div>
                </div>
                <div className="bg-brand-500/10 border border-brand-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {usageDetail.totals.byKind.premium_assistant.calls}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">IA Premium</div>
                </div>
                <div className="bg-amber-500/10 border border-amber-500/20 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    {usageDetail.totals.byKind.basic_triage.calls}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">IA Básica (LLM)</div>
                </div>
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">{usageDetail.totals.tokens}</div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Tokens</div>
                </div>
                <div className="bg-[var(--rz-surface-muted)]/50 rounded-lg p-4">
                  <div className="text-2xl font-semibold">
                    US$ {usageDetail.totals.cost.toFixed(4)}
                  </div>
                  <div className="text-xs text-[var(--rz-text-muted)]">Custo est.</div>
                </div>
              </div>

              {usageDetail.snapshot && (
                <p className="text-xs text-[var(--rz-text-muted)]">
                  Hoje: {usageDetail.snapshot.dailyUsed}/{usageDetail.snapshot.dailyLimit} chamadas ·{' '}
                  {formatCredits(usageDetail.snapshot.dailyCreditsSpent ?? 0)} créditos gastos
                </p>
              )}

              {usageDetail.rows.length > 0 && (
                <div className="overflow-x-auto rounded-lg border border-[var(--rz-border)]">
                  <table className="w-full text-xs">
                    <thead className="bg-[var(--rz-surface-muted)]/50 text-[var(--rz-text-muted)]">
                      <tr>
                        <th className="text-left px-3 py-2 font-medium">Data</th>
                        <th className="text-left px-3 py-2 font-medium">Modo</th>
                        <th className="text-right px-3 py-2 font-medium">Créditos</th>
                        <th className="text-left px-3 py-2 font-medium">Modelo</th>
                        <th className="text-right px-3 py-2 font-medium">Tokens</th>
                        <th className="text-right px-3 py-2 font-medium">Custo</th>
                      </tr>
                    </thead>
                    <tbody>
                      {usageDetail.rows.slice(0, 50).map(row => (
                        <tr key={row.id} className="border-t border-[var(--rz-border)]">
                          <td className="px-3 py-2 whitespace-nowrap">
                            {new Date(row.createdAt).toLocaleString('pt-BR')}
                          </td>
                          <td className="px-3 py-2">{row.usageKindLabel}</td>
                          <td className="px-3 py-2 text-right tabular-nums">
                            {row.creditWeight != null && row.creditWeight > 0
                              ? formatCredits(row.creditWeight)
                              : '—'}
                          </td>
                          <td className="px-3 py-2 font-mono text-[10px]">{row.llmModel}</td>
                          <td className="px-3 py-2 text-right">{row.totalTokens}</td>
                          <td className="px-3 py-2 text-right">
                            US$ {row.estimatedCost.toFixed(4)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </>
          )}
        </Card>
      )}

      {tab === 'testar' && (
        <Card className="p-6 space-y-4">
          <h2 className="text-lg font-medium">Testar conexão com o provedor</h2>
          <Button type="button" onClick={() => testConn.mutate(undefined)} disabled={testConn.isPending}>
            Ping no provedor
          </Button>
          {testResult && <p className="text-sm">{testResult}</p>}
        </Card>
      )}

      {tab !== 'testar' && tab !== 'logs' && (
        <ConfigSaveFooter onSave={handleSave} saving={save.isPending} />
      )}
      </div>
    </PlatformPage>
  )
}
