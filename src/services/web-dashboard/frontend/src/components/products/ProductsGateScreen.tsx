import { Link } from 'react-router-dom'
import { Package, Sparkles } from 'lucide-react'
import { Card } from '../ui/Card'
import { can, getMe } from '../../lib/auth'
import { useQuery } from '@tanstack/react-query'

export function ProductsGateScreen() {
  const { data: me } = useQuery({ queryKey: ['auth-me'], queryFn: getMe })
  const canManage = can(me ?? null, 'inbox:ai:manage')

  return (
    <Card className="p-8 max-w-lg mx-auto text-center space-y-4">
      <Package className="w-12 h-12 mx-auto text-[var(--rz-text-muted)]" />
      <h2 className="text-lg font-medium">Produtos não está ativo</h2>
      <p className="text-sm text-[var(--rz-text-muted)]">
        Ative o perfil comercial e os pedidos via IA em{' '}
        <strong>IA Atendimento → Empresa</strong> para liberar catálogo, estoque, PIX e pedidos.
      </p>
      {canManage ? (
        <Link
          to="/platform/inbox/ia#empresa"
          className="inline-flex items-center justify-center gap-1 rounded-md bg-[var(--rz-surface-muted)] px-4 py-2 text-sm font-medium hover:opacity-90"
        >
          <Sparkles className="w-4 h-4" /> Ativar em IA Atendimento
        </Link>
      ) : (
        <p className="text-xs text-[var(--rz-text-muted)]">
          Peça a um administrador para ativar o catálogo na empresa.
        </p>
      )}
    </Card>
  )
}
