import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { can, type AuthUser } from '../../lib/auth'
import { formatWaSessionLabel } from '../../lib/destinationFormat'
import { Smartphone, Sparkles, Cpu } from 'lucide-react'

interface WhatsAppStatusPayload {
  status: 'connected' | 'disconnected' | 'connecting' | 'qr-required' | string
  connected: boolean
  phoneNumber?: string
  profileName?: string
}

interface AiBalancePayload {
  wallet: {
    balance: number
    usedThisMonth: number
    totalAllowance: number
    depleted: boolean
  }
  llm: {
    dailyUsed: number
    dailyLimit: number
    monthlyUsed: number
    monthlyLimit: number
    meteringMode?: 'radarchat_calls' | 'company_calls'
  }
}

function formatCredits(n: number): string {
  if (n <= 0) return '0'
  if (n < 10) return n.toFixed(1)
  return Math.round(n).toString()
}

interface Props {
  user: AuthUser
  className?: string
}

export function HeaderStatusPills({ user, className }: Props) {
  const showWhatsApp = can(user, 'inbox:view')
  const showAiBalance = can(user, 'inbox:ai:balance:view')
  const canManageWa = can(user, 'whatsapp:session:view')

  const { data: waStatus } = useQuery<WhatsAppStatusPayload>({
    queryKey: ['inbox-whatsapp-status'],
    queryFn: () => api.get('/inbox/whatsapp-status'),
    enabled: showWhatsApp,
    refetchInterval: 15_000,
  })

  const { data: aiBalance } = useQuery<AiBalancePayload>({
    queryKey: ['ai-balance-header'],
    queryFn: () => api.get('/platform/ai/balance'),
    enabled: showAiBalance,
    refetchInterval: 30_000,
  })

  if (!showWhatsApp && !showAiBalance) return null

  const connected = waStatus?.connected === true
  const waLabel = connected
    ? formatWaSessionLabel({
        phoneNumber: waStatus?.phoneNumber,
        profileName: waStatus?.profileName,
      })
    : waStatus?.status === 'qr-required'
      ? 'QR pendente'
      : 'Desconectado'

  const waColor = connected
    ? 'text-brand-400 border-brand-600/40 bg-brand-600/10'
    : waStatus?.status === 'connecting' || waStatus?.status === 'qr-required'
      ? 'text-yellow-400 border-yellow-600/40 bg-yellow-600/10'
      : 'text-[var(--rz-text-secondary)] border-[var(--rz-border)] bg-[var(--rz-surface-muted)]'

  const waHref = canManageWa ? '/sessions' : '/platform/inbox'
  const waActionLabel = canManageWa ? 'Abrir conexão WhatsApp' : 'Abrir atendimentos'
  const waTitle = connected
    ? `WhatsApp conectado: ${waLabel}. ${waActionLabel}.`
    : waStatus?.status === 'qr-required'
      ? `WhatsApp com QR pendente. ${waActionLabel}.`
      : waStatus?.status === 'connecting'
        ? `WhatsApp conectando. ${waActionLabel}.`
        : `WhatsApp desconectado. ${waActionLabel}.`

  const wallet = aiBalance?.wallet
  const llm = aiBalance?.llm
  const iaHigh =
    wallet &&
    wallet.totalAllowance > 0 &&
    wallet.usedThisMonth >= wallet.totalAllowance * 0.9
  const llmHigh =
    llm && llm.monthlyLimit > 0 && llm.monthlyUsed >= llm.monthlyLimit * 0.9

  const pillBase =
    'inline-flex h-8 items-center gap-1.5 border rounded-lg px-2.5 text-xs transition-colors hover:opacity-90 shrink-0'
  const containerClassName = className
    ? `items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-thin ${className}`
    : 'flex items-center gap-1.5 min-w-0 overflow-x-auto scrollbar-thin'
  const iaTitle = wallet
    ? `${wallet.depleted ? 'Créditos IA esgotados' : iaHigh ? 'Créditos IA em atenção' : 'Créditos IA disponíveis'}: ${formatCredits(wallet.usedThisMonth)} usados de ${formatCredits(wallet.totalAllowance)}. Saldo ${formatCredits(wallet.balance)}.`
    : 'Créditos IA'
  const lmTitle = llm
    ? `${llmHigh ? 'Chamadas LM em atenção' : 'Chamadas LM disponíveis'}: ${llm.monthlyUsed} usadas de ${llm.monthlyLimit} no mês. Hoje ${llm.dailyUsed}/${llm.dailyLimit}.`
    : 'Chamadas LM'

  return (
    <div className={containerClassName}>
      {showWhatsApp && waStatus && (
        <Link to={waHref} className={`${pillBase} ${waColor}`} title={waTitle} aria-label={waTitle}>
          <Smartphone size={13} className="shrink-0" />
          <span className="hidden xl:inline truncate max-w-[180px]">{waLabel}</span>
          <span className="xl:hidden font-medium">WA</span>
          <span
            className={`w-1.5 h-1.5 rounded-full shrink-0 ${connected ? 'bg-brand-500' : 'bg-[var(--rz-text-muted)]'}`}
          />
        </Link>
      )}

      {showAiBalance && wallet && wallet.totalAllowance > 0 && (
        <Link
          to="/platform/inbox/ia"
          className={`${pillBase} ${
            wallet.depleted
              ? 'text-red-300 border-red-500/40 bg-red-500/10'
              : iaHigh
                ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
                : 'text-violet-300 border-violet-500/40 bg-violet-500/10'
          }`}
          title={iaTitle}
          aria-label={iaTitle}
        >
          <Sparkles size={13} className="shrink-0" />
          <span className="hidden xl:inline font-medium tabular-nums">
            IA {formatCredits(wallet.usedThisMonth)}/{formatCredits(wallet.totalAllowance)}
          </span>
          <span className="xl:hidden font-medium">IA</span>
        </Link>
      )}

      {showAiBalance && llm && llm.monthlyLimit > 0 && (
        <Link
          to="/platform/inbox/ia"
          className={`${pillBase} ${
            llmHigh
              ? 'text-amber-300 border-amber-500/40 bg-amber-500/10'
              : 'text-blue-300 border-blue-500/40 bg-blue-500/10'
          }`}
          title={lmTitle}
          aria-label={lmTitle}
        >
          <Cpu size={13} className="shrink-0" />
          <span className="hidden xl:inline font-medium tabular-nums">
            LM {llm.monthlyUsed}/{llm.monthlyLimit}
          </span>
          <span className="xl:hidden font-medium">LM</span>
        </Link>
      )}
    </div>
  )
}
