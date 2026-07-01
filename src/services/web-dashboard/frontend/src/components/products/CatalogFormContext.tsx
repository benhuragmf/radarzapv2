import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { notifyError, notifyInfo, mutationError } from '../../lib/notify'
import { buildCatalogPixInstructions } from '@radarchat-types/catalog-sales-pix'
import type { CatalogSalesCompanyConfig } from '@/lib/catalog/catalogSalesTypes'
import { deliveryAddressValidationError } from '@radarchat-types/catalog-delivery-address'
import {
  PAYMENT_GUIDE_TITLE,
  PAYMENT_CATEGORY,
  emptyProductDraft,
  knowledgeItemToProductDraft,
  listProductItems,
  makeKnowledgeBaseItem,
  productStatsFromItems,
  upsertProductInKnowledgeBase,
  type KnowledgeBaseItem,
  type ProductDraft,
} from '../../lib/catalog/productKnowledge'

type AiCatalogPayload = {
  knowledgeBase: KnowledgeBaseItem[]
  catalogSales: CatalogSalesCompanyConfig
  settings?: Record<string, unknown>
  prompt?: Record<string, unknown>
  skills?: unknown[]
  memories?: unknown[]
}

type CatalogFormContextValue = {
  loading: boolean
  saving: boolean
  form: AiCatalogPayload | null
  me: AuthUser | null | undefined
  canManage: boolean
  canEditSalesWhatsapp: boolean
  catalogSales: CatalogSalesCompanyConfig
  productItems: KnowledgeBaseItem[]
  productStats: ReturnType<typeof productStatsFromItems>
  productDraft: ProductDraft
  setProductDraft: React.Dispatch<React.SetStateAction<ProductDraft>>
  editingProductRef: { id?: string; title: string } | null
  updateCatalogSales: (patch: Partial<CatalogSalesCompanyConfig>) => void
  patchCatalogSalesPix: (patch: Partial<CatalogSalesCompanyConfig>) => void
  saveProductDraft: () => void
  startEditProduct: (item: KnowledgeBaseItem) => void
  startDuplicateProduct: (item: KnowledgeBaseItem) => void
  cancelEditProduct: () => void
  productFormOpen: boolean
  setProductFormOpen: (open: boolean) => void
  removeProductItem: (item: KnowledgeBaseItem) => void
  handleSave: () => void
  catalogPixExtraNotes: string
}

const CatalogFormContext = createContext<CatalogFormContextValue | null>(null)

export function useCatalogForm() {
  const ctx = useContext(CatalogFormContext)
  if (!ctx) throw new Error('useCatalogForm outside CatalogFormProvider')
  return ctx
}

export function CatalogFormProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AiCatalogPayload | null>(null)
  const [productDraft, setProductDraft] = useState<ProductDraft>(emptyProductDraft)
  const [editingProductRef, setEditingProductRef] = useState<{ id?: string; title: string } | null>(
    null,
  )
  const [productFormOpen, setProductFormOpen] = useState(false)

  const { data: me } = useQuery<AuthUser | null>({ queryKey: ['auth-me'], queryFn: getMe })
  const canManage = can(me ?? null, 'inbox:ai:manage')
  const canViewOrders = can(me ?? null, 'orders:view')
  const canEditSalesWhatsapp = me ? can(me, 'company:sales-config:update') : false

  const { data, isLoading } = useQuery({
    queryKey: ['ai-settings'],
    queryFn: () => api.get<AiCatalogPayload>('/platform/ai/settings'),
    enabled: canManage || canViewOrders,
  })

  useEffect(() => {
    if (!data) return
    setForm({
      knowledgeBase: data.knowledgeBase ?? [],
      catalogSales: data.catalogSales ?? {},
      settings: data.settings,
      prompt: data.prompt,
      skills: data.skills,
      memories: data.memories,
    })
  }, [data])

  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api.patch('/platform/ai/settings', body),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['ai-settings'] })
      qc.invalidateQueries({ queryKey: ['ai-settings-catalog-gate'] })
      notifyInfo('Configurações salvas.')
    },
    onError: mutationError,
  })

  const upsertKnowledgeArticle = useCallback(
    (matcher: (item: KnowledgeBaseItem) => boolean, item: KnowledgeBaseItem) => {
      setForm(f => {
        if (!f) return f
        const knowledgeBase = [...f.knowledgeBase]
        const idx = knowledgeBase.findIndex(k => !k._delete && matcher(k))
        if (idx >= 0) {
          knowledgeBase[idx] = { ...knowledgeBase[idx], ...item, id: knowledgeBase[idx].id || item.id }
        } else {
          knowledgeBase.push(item)
        }
        return { ...f, knowledgeBase }
      })
    },
    [],
  )

  const syncPaymentGuideFromPixConfig = useCallback(
    (instructions: string) => {
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
    },
    [upsertKnowledgeArticle],
  )

  const catalogSales = form?.catalogSales ?? {}
  const productItems = useMemo(
    () => (form ? listProductItems(form.knowledgeBase) : []),
    [form],
  )
  const productStats = useMemo(() => productStatsFromItems(productItems), [productItems])

  const updateCatalogSales = useCallback((patch: Partial<CatalogSalesCompanyConfig>) => {
    setForm(f => (f ? { ...f, catalogSales: { ...f.catalogSales, ...patch } } : f))
  }, [])

  const patchCatalogSalesPix = useCallback(
    (patch: Partial<CatalogSalesCompanyConfig>) => {
      setForm(f => {
        if (!f) return f
        const next = { ...f.catalogSales, ...patch }
        const pixInstructions = buildCatalogPixInstructions(next)
        syncPaymentGuideFromPixConfig(pixInstructions)
        return { ...f, catalogSales: { ...next, pixInstructions } }
      })
    },
    [syncPaymentGuideFromPixConfig],
  )

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

  const handleSave = useCallback(() => {
    if (!form) return
    if (form.catalogSales?.useDistanceBasedDelivery) {
      const addrErr = deliveryAddressValidationError(form.catalogSales.deliveryOriginAddress)
      if (addrErr) {
        notifyError(`Entrega por distância: ${addrErr}`)
        return
      }
    }
    save.mutate({
      settings: form.settings,
      prompt: form.prompt,
      skills: form.skills,
      memories: form.memories,
      knowledgeBase: form.knowledgeBase,
      catalogSales: form.catalogSales,
    })
  }, [form, save])

  const saveProductDraft = useCallback(() => {
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
    setProductFormOpen(false)
    notifyInfo(
      wasEdit
        ? 'Produto atualizado. Clique em Salvar para persistir.'
        : 'Produto adicionado. Clique em Salvar para persistir.',
    )
  }, [productDraft, editingProductRef])

  const startEditProduct = useCallback((item: KnowledgeBaseItem) => {
    setProductDraft(knowledgeItemToProductDraft(item))
    setEditingProductRef({ id: item.id || undefined, title: item.title })
    setProductFormOpen(true)
  }, [])

  const startDuplicateProduct = useCallback((item: KnowledgeBaseItem) => {
    const draft = knowledgeItemToProductDraft(item)
    setProductDraft({
      ...draft,
      name: `${draft.name} (cópia)`,
      sku: draft.sku ? `${draft.sku}-copia` : '',
    })
    setEditingProductRef(null)
    setProductFormOpen(true)
  }, [])

  const cancelEditProduct = useCallback(() => {
    setProductDraft(emptyProductDraft)
    setEditingProductRef(null)
    setProductFormOpen(false)
  }, [])

  const removeProductItem = useCallback((item: KnowledgeBaseItem) => {
    setForm(f => {
      if (!f) return f
      const knowledgeBase = [...f.knowledgeBase]
      const idx = knowledgeBase.findIndex(
        k => !k._delete && k.title === item.title && k.category === item.category,
      )
      if (idx < 0) return f
      if (!knowledgeBase[idx].id) knowledgeBase.splice(idx, 1)
      else knowledgeBase[idx] = { ...knowledgeBase[idx], _delete: true }
      return { ...f, knowledgeBase }
    })
  }, [])

  const value: CatalogFormContextValue = {
    loading: isLoading,
    saving: save.isPending,
    form,
    me,
    canManage,
    canEditSalesWhatsapp,
    catalogSales,
    productItems,
    productStats,
    productDraft,
    setProductDraft,
    editingProductRef,
    updateCatalogSales,
    patchCatalogSalesPix,
    saveProductDraft,
    startEditProduct,
    startDuplicateProduct,
    cancelEditProduct,
    productFormOpen,
    setProductFormOpen,
    removeProductItem,
    handleSave,
    catalogPixExtraNotes,
  }

  return <CatalogFormContext.Provider value={value}>{children}</CatalogFormContext.Provider>
}
