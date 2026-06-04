import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { useQuery } from '@tanstack/react-query'
import Logs from '../Logs'
import Queue from '../Queue'

type Tab = 'tenant' | 'system'

export default function PlatformReports() {
  const [tab, setTab] = useState<Tab>('tenant')

  const { data: me } = useQuery<AuthUser | null>({
    queryKey: ['auth-me'],
    queryFn: getMe,
  })

  const canSystem =
    can(me ?? null, 'logs:global') ||
    can(me ?? null, 'queue:global') ||
    Boolean(me?.isInternalStaff)

  return (
    <PlatformPage
      title="Relatórios (tenant)"
      description="Dados da sua empresa: logs de envio e fila. Infraestrutura global fica em Operação (equipe RadarZap)."
      phase="Fase 1"
    >
      <div className="flex flex-wrap gap-2 border-b border-gray-800 pb-3">
        <button
          type="button"
          onClick={() => setTab('tenant')}
          className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
            tab === 'tenant'
              ? 'border-brand-500 bg-brand-600/20 text-brand-300'
              : 'border-gray-700 text-gray-500 hover:border-gray-600'
          }`}
        >
          Meu negócio
        </button>
        {canSystem && (
          <button
            type="button"
            onClick={() => setTab('system')}
            className={`text-sm px-3 py-1.5 rounded-lg border transition-colors ${
              tab === 'system'
                ? 'border-amber-500 bg-amber-600/20 text-amber-300'
                : 'border-gray-700 text-gray-500 hover:border-gray-600'
            }`}
          >
            Sistema
          </button>
        )}
      </div>

      {tab === 'tenant' && (
        <div className="space-y-8">
          <section>
            <h2 className="text-sm font-medium text-gray-300 mb-3">Logs de envio</h2>
            <Logs scope="tenant" />
          </section>
          <section>
            <h2 className="text-sm font-medium text-gray-300 mb-3">Fila de mensagens</h2>
            <Queue scope="tenant" />
          </section>
        </div>
      )}

      {tab === 'system' && canSystem && (
        <CardSystemLinks />
      )}
    </PlatformPage>
  )
}

function CardSystemLinks() {
  return (
    <div className="space-y-4 text-sm text-gray-400">
      <p>Visão de infraestrutura (sem filtro de tenant). Abra as páginas de operação:</p>
      <ul className="list-disc list-inside space-y-1 text-brand-400">
        <li>
          <Link to="/admin/logs" className="hover:underline">
            Logs globais
          </Link>
        </li>
        <li>
          <Link to="/admin/queue" className="hover:underline">
            Fila global
          </Link>
        </li>
        <li>
          <Link to="/admin/sessions" className="hover:underline">
            Sessões (admin)
          </Link>
        </li>
      </ul>
    </div>
  )
}
