import { useUrlHashTab } from '@/lib/useUrlHashTab'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { CatalogFormProvider, useCatalogForm } from '../../components/products/CatalogFormContext'
import { ProductsGateScreen } from '../../components/products/ProductsGateScreen'
import { ProductsOverviewTab } from '../../components/products/ProductsOverviewTab'
import { ProductsItemsTab } from '../../components/products/ProductsItemsTab'
import { ProductsOrdersTab } from '../../components/products/ProductsOrdersTab'
import { ProductsSettingsTab } from '../../components/products/ProductsSettingsTab'
import { ProductsDeliveryTab } from '../../components/products/ProductsDeliveryTab'
import { ProductsPageHeader } from '../../components/products/ProductsPageHeader'
import { useCatalogMenuGate } from '../../hooks/useCatalogMenuGate'
import { can } from '../../lib/auth'
import { ConfigSaveFooter, LoadingState } from '@/design-system'
import { cn } from '@/lib/utils'

const TAB_IDS = [
  'visao',
  'itens',
  'pedidos',
  'comprovantes',
  'entrega',
  'configuracoes',
] as const
type TabId = (typeof TAB_IDS)[number]

const TABS: { id: TabId; label: string }[] = [
  { id: 'visao', label: 'Visão geral' },
  { id: 'itens', label: 'Produtos e estoque' },
  { id: 'pedidos', label: 'Pedidos' },
  { id: 'comprovantes', label: 'Comprovantes PIX' },
  { id: 'entrega', label: 'Entrega e frete' },
  { id: 'configuracoes', label: 'Configurações' },
]

const TABS_WITH_SAVE: TabId[] = ['itens', 'entrega', 'configuracoes']

function ProdutosInner() {
  const [tab, setTab] = useUrlHashTab(TAB_IDS, 'visao')
  const { loading, handleSave, saving, canManage, me } = useCatalogForm()
  const canViewOrders = Boolean(me && can(me, 'orders:view'))
  const { menuEnabled, loading: gateLoading } = useCatalogMenuGate()

  if (gateLoading || loading) {
    return <LoadingState label="Carregando produtos…" />
  }

  if (!menuEnabled) {
    return <ProductsGateScreen />
  }

  if (!canManage && !canViewOrders) {
    return (
      <PlatformPage title="Produtos" compact hideHeader>
        <ProductsPageHeader />
        <p className="text-sm text-[var(--rz-text-muted)] mt-4">
          Você não tem permissão para acessar este módulo.
        </p>
      </PlatformPage>
    )
  }

  if (!canManage) {
    const orderTabs = TABS.filter(t => t.id === 'pedidos' || t.id === 'comprovantes')
    const activeTab =
      tab === 'pedidos' || tab === 'comprovantes' ? tab : 'pedidos'

    return (
      <PlatformPage title="Produtos" compact hideHeader>
        <ProductsPageHeader />
        <nav className="flex flex-wrap gap-1 border-b border-[var(--rz-border)] pb-2 mb-2 mt-4">
          {orderTabs.map(t => (
            <button
              key={t.id}
              type="button"
              onClick={() => setTab(t.id)}
              className={cn(
                'px-3 py-2 rounded-md text-sm transition-colors',
                activeTab === t.id
                  ? 'bg-[var(--rz-sidebar-item-active)] text-[var(--rz-text-primary)] font-medium'
                  : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]',
              )}
            >
              {t.label}
            </button>
          ))}
        </nav>
        <ProductsOrdersTab proofOnly={activeTab === 'comprovantes'} />
      </PlatformPage>
    )
  }

  const showSaveFooter = TABS_WITH_SAVE.includes(tab)

  return (
    <PlatformPage title="Produtos" compact hideHeader>
      <ProductsPageHeader />

      <nav
        className="flex flex-wrap gap-1 border-b border-[var(--rz-border)] pb-2 mt-4"
        aria-label="Abas do módulo Produtos"
      >
        {TABS.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              'px-3 py-2 rounded-md text-sm transition-colors',
              tab === t.id
                ? 'bg-[var(--rz-sidebar-item-active)] text-[var(--rz-text-primary)] font-medium'
                : 'text-[var(--rz-text-muted)] hover:text-[var(--rz-text-primary)]',
            )}
          >
            {t.label}
          </button>
        ))}
      </nav>

      {tab === 'visao' && <ProductsOverviewTab />}
      {tab === 'itens' && <ProductsItemsTab />}
      {tab === 'pedidos' && <ProductsOrdersTab />}
      {tab === 'comprovantes' && <ProductsOrdersTab proofOnly />}
      {tab === 'entrega' && <ProductsDeliveryTab />}
      {tab === 'configuracoes' && <ProductsSettingsTab />}

      {showSaveFooter && <ConfigSaveFooter onSave={handleSave} saving={saving} />}
    </PlatformPage>
  )
}

export default function Produtos() {
  return (
    <CatalogFormProvider>
      <ProdutosInner />
    </CatalogFormProvider>
  )
}
