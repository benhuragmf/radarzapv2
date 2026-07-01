import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can } from '../../lib/auth'
import { useCatalogForm } from './CatalogFormContext'
import { PageHeader, StatusBadge } from '@/design-system'
import { fulfillmentModeFromConfig } from '@/lib/catalog/productDisplay'

interface SessionRow {
  status: string
  phoneNumber?: string
}

export function ProductsPageHeader({ compact = true }: { compact?: boolean }) {
  const { catalogSales, productStats, me } = useCatalogForm()

  const { data: sessions = [] } = useQuery<SessionRow[]>({
    queryKey: ['sessions', 'tenant'],
    queryFn: () => api.get('/sessions'),
    enabled: Boolean(me && can(me, 'whatsapp:session:view')),
  })

  const waConnected = sessions.some(s => s.status === 'connected')
  const fulfillment = fulfillmentModeFromConfig(catalogSales)

  const badges = (
    <>
      <StatusBadge
        size="sm"
        status={catalogSales.enabled ? 'success' : 'neutral'}
        text={catalogSales.enabled ? 'Catálogo ativo' : 'Catálogo inativo'}
        title="Ativação na IA Atendimento → Empresa"
      />
      <StatusBadge
        size="sm"
        status={catalogSales.pixEnabled ? 'info' : 'neutral'}
        text={catalogSales.pixEnabled ? 'PIX ativo' : 'PIX inativo'}
      />
      <StatusBadge
        size="sm"
        status={
          fulfillment === 'delivery_only' || catalogSales.requireDeliveryAddress
            ? 'info'
            : 'neutral'
        }
        text={
          fulfillment === 'pickup_only'
            ? 'Só retirada'
            : fulfillment === 'delivery_only'
              ? 'Só entrega'
              : 'Retirada + entrega'
        }
      />
      {productStats.withoutPrice > 0 && (
        <StatusBadge
          size="sm"
          status="warning"
          text={`${productStats.withoutPrice} sem preço`}
        />
      )}
      {(productStats.uncertainStock ?? 0) > 0 && (
        <StatusBadge
          size="sm"
          status="warning"
          text={`${productStats.uncertainStock} estoque a confirmar`}
        />
      )}
      {!waConnected && (
        <StatusBadge size="sm" status="danger" text="WA loja offline" />
      )}
    </>
  )

  return (
    <PageHeader
      compact={compact}
      title="Produtos"
      subtitle="Gerencie catálogo, estoque, pedidos, PIX, entrega e retirada em um só lugar."
      badges={badges}
      actions={
        <Link
          to="/platform/inbox/ia#empresa"
          className="text-xs text-brand-400 hover:underline"
        >
          IA e perfil comercial
        </Link>
      }
    />
  )
}
