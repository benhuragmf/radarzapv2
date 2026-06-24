export function liveQueueState(
  suggestedAt: string | undefined,
  pullTimeoutSeconds: number,
  tick = 0,
): { elapsedSec: number; urgency: number } {
  void tick
  if (!suggestedAt) return { elapsedSec: 0, urgency: 0 }
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(suggestedAt).getTime()) / 1000),
  )
  const timeout = Math.max(30, pullTimeoutSeconds || 120)
  return { elapsedSec, urgency: Math.min(1, elapsedSec / timeout) }
}

export function liveInactivityCloseAllowed(
  inactivityWarnedAt: string | undefined,
  closeAfterWarningMinutes: number,
  tick = 0,
): boolean {
  void tick
  if (!inactivityWarnedAt) return false
  if (closeAfterWarningMinutes <= 0) return true
  const elapsedMin = (Date.now() - new Date(inactivityWarnedAt).getTime()) / 60_000
  return elapsedMin >= closeAfterWarningMinutes
}

export function liveGracefulCloseAllowed(
  gracefulClosePromptAt: string | undefined,
  gracefulCloseAckAt: string | undefined,
  afterPromptMinutes: number,
  tick = 0,
): boolean {
  void tick
  if (gracefulCloseAckAt && gracefulClosePromptAt) {
    return new Date(gracefulCloseAckAt).getTime() >= new Date(gracefulClosePromptAt).getTime()
  }
  if (!gracefulClosePromptAt) return false
  if (afterPromptMinutes <= 0) return true
  const elapsedMin = (Date.now() - new Date(gracefulClosePromptAt).getTime()) / 60_000
  return elapsedMin >= afterPromptMinutes
}

export function liveCloseQuickReplyAllowed(
  conv: {
    inactivityWarnedAt?: string
    gracefulClosePromptAt?: string
    gracefulCloseAckAt?: string
  },
  sla: {
    inactivityCloseAfterWarningMinutes: number
    gracefulCloseAfterPromptMinutes: number
  },
  tick = 0,
): boolean {
  return (
    liveInactivityCloseAllowed(
      conv.inactivityWarnedAt,
      sla.inactivityCloseAfterWarningMinutes,
      tick,
    ) ||
    liveGracefulCloseAllowed(
      conv.gracefulClosePromptAt,
      conv.gracefulCloseAckAt,
      sla.gracefulCloseAfterPromptMinutes,
      tick,
    )
  )
}

export function liveTriageWaitState(
  triageWaitSince: string | undefined,
  inactivityCloseMinutes = 15,
  tick = 0,
): { elapsedSec: number; urgency: number } {
  void tick
  if (!triageWaitSince) return { elapsedSec: 0, urgency: 0 }
  const elapsedSec = Math.max(
    0,
    Math.floor((Date.now() - new Date(triageWaitSince).getTime()) / 1000),
  )
  const timeoutSec = Math.max(60, (inactivityCloseMinutes > 0 ? inactivityCloseMinutes : 15) * 60)
  return { elapsedSec, urgency: Math.min(1, elapsedSec / timeoutSec) }
}

export function formatQueueTimer(elapsedSec: number): string {
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

/** Cor do cronômetro: amarelo → âmbar → laranja → vermelho */
export function queueUrgencyTimerClass(urgency: number): string {
  if (urgency >= 0.85) return 'text-red-400'
  if (urgency >= 0.6) return 'text-orange-400'
  if (urgency >= 0.35) return 'text-amber-400'
  return 'text-yellow-400'
}

/** Banner de prioridade no cabeçalho do chat */
export function queueUrgencyPanelClass(urgency: number): string {
  const base = 'mt-2 flex items-center gap-2 text-xs rounded-lg px-3 py-2 border '
  if (urgency >= 0.85) return `${base}text-red-300 bg-red-500/10 border-red-500/30`
  if (urgency >= 0.6) return `${base}text-orange-300 bg-orange-500/10 border-orange-500/30`
  if (urgency >= 0.35) return `${base}text-amber-300 bg-amber-500/10 border-amber-500/30`
  return `${base}text-yellow-300 bg-yellow-500/5 border-yellow-500/15`
}

export function priorityBorderClass(
  urgency: number,
  priorityForMe: boolean,
  canPull: boolean,
  hasPriorityTimer: boolean,
): string {
  if (hasPriorityTimer) {
    if (urgency >= 0.85) {
      return priorityForMe
        ? 'ring-2 ring-inset ring-red-500 shadow-[inset_0_0_20px_rgba(239,68,68,0.25)]'
        : 'ring-2 ring-inset ring-red-600/70'
    }
    if (urgency >= 0.6) {
      return priorityForMe
        ? 'ring-2 ring-inset ring-orange-500 shadow-[inset_0_0_16px_rgba(249,115,22,0.2)]'
        : 'ring-2 ring-inset ring-orange-600/60'
    }
    if (urgency >= 0.35) {
      return priorityForMe
        ? 'ring-2 ring-inset ring-amber-500 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]'
        : 'ring-2 ring-inset ring-amber-600/50'
    }
    return priorityForMe
      ? 'ring-2 ring-inset ring-yellow-400 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]'
      : 'ring-2 ring-inset ring-yellow-600/40'
  }
  if (canPull) {
    return 'ring-1 ring-inset ring-orange-700/60'
  }
  return ''
}
