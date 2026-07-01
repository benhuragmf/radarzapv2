import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Lock } from 'lucide-react'
import { api } from '../../lib/api'
import { can, type AuthUser } from '../../lib/auth'

export interface OperationalBlock {
  id: string
  module: string
  moduleLabel: string
  title: string
  reason: string
  href?: string
  severity: 'critical' | 'warning'
  ownerOnly?: boolean
}

interface OperationalBlocksPayload {
  hasBlocks: boolean
  criticalCount: number
  warningCount: number
  blocks: OperationalBlock[]
  checkedAt: string
}

interface Props {
  user: AuthUser
}

export function OperationalLockIndicator({ user }: Props) {
  const canViewBilling = can(user, 'billing:view')
  const [open, setOpen] = useState(false)

  const { data } = useQuery<OperationalBlocksPayload>({
    queryKey: ['operational-blocks', user.organizationId, canViewBilling],
    queryFn: () => api.get('/platform/operational-blocks'),
    refetchInterval: 30_000,
    staleTime: 15_000,
  })

  if (!data?.hasBlocks) return null

  const visibleBlocks = data.blocks.filter(b => !b.ownerOnly || canViewBilling)
  if (visibleBlocks.length === 0) return null

  const criticalCount = visibleBlocks.filter(b => b.severity === 'critical').length
  const isCritical = criticalCount > 0
  const badgeCount = visibleBlocks.length

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        className={`relative flex items-center justify-center w-8 h-8 rounded-lg border transition-colors ${
          isCritical
            ? 'border-red-500/50 hover:bg-red-950/30 text-red-300'
            : 'border-amber-500/50 hover:bg-amber-950/25 text-amber-300'
        }`}
        title={
          isCritical
            ? `${criticalCount} bloqueio(s) crítico(s) — clique para detalhes`
            : `${badgeCount} aviso(s) de configuração — clique para detalhes`
        }
        aria-label="Bloqueios operacionais"
        aria-expanded={open}
      >
        <Lock size={15} />
        <span
          className={`absolute -top-1 -right-1 min-w-[16px] h-4 px-1 rounded-full text-[10px] font-bold text-white flex items-center justify-center ${
            isCritical ? 'bg-red-600 ring-2 ring-red-400/60' : 'bg-amber-500 text-[var(--rz-on-accent)]'
          }`}
        >
          {badgeCount > 9 ? '9+' : badgeCount}
        </span>
      </button>

      {open && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-[55] cursor-default bg-black/40 sm:bg-transparent"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div className="fixed left-3 right-3 top-[calc(3.5rem+env(safe-area-inset-top,0px))] z-[60] max-h-[min(28rem,calc(100dvh-4.5rem-env(safe-area-inset-bottom,0px)))] overflow-y-auto bg-[var(--rz-surface)] border border-[var(--rz-border)] rounded-xl shadow-xl sm:absolute sm:inset-x-auto sm:left-auto sm:right-0 sm:top-full sm:mt-1 sm:w-96 sm:max-h-[28rem]">
            <div className="px-3 py-2.5 border-b border-[var(--rz-border)]">
              <div className="flex items-center gap-2">
                <Lock size={14} className={isCritical ? 'text-red-400' : 'text-amber-400'} />
                <span className="text-xs font-semibold text-[var(--rz-text-primary)]">
                  Bloqueios operacionais
                </span>
              </div>
              <p className="text-[10px] text-[var(--rz-text-muted)] mt-1">
                Recursos que impedem o funcionamento normal do sistema.
              </p>
            </div>

            {visibleBlocks.map(block => {
              const rowClass = `block px-3 py-2.5 border-b border-[var(--rz-border)]/80 hover:bg-[var(--rz-surface-muted)] ${
                block.severity === 'critical'
                  ? 'bg-red-950/25 border-l-2 border-l-red-500'
                  : 'bg-amber-950/15 border-l-2 border-l-amber-500'
              }`

              const content = (
                <>
                  <div className="flex items-center justify-between gap-2 mb-0.5">
                    <span
                      className={`text-xs font-medium ${
                        block.severity === 'critical' ? 'text-red-300' : 'text-amber-200'
                      }`}
                    >
                      {block.title}
                    </span>
                    <span className="text-[10px] text-[var(--rz-text-muted)] shrink-0">
                      {block.moduleLabel}
                    </span>
                  </div>
                  <p className="text-xs text-[var(--rz-text-muted)] line-clamp-3">{block.reason}</p>
                </>
              )

              if (block.href) {
                return (
                  <Link
                    key={block.id}
                    to={block.href}
                    onClick={() => setOpen(false)}
                    className={rowClass}
                  >
                    {content}
                  </Link>
                )
              }

              return (
                <div key={block.id} className={rowClass}>
                  {content}
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
