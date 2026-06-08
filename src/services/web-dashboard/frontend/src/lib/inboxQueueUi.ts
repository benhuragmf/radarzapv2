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

export function formatQueueTimer(elapsedSec: number): string {
  const m = Math.floor(elapsedSec / 60)
  const s = elapsedSec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

export function priorityBorderClass(urgency: number, priorityForMe: boolean, canPull: boolean): string {
  if (priorityForMe) {
    if (urgency < 0.25) return 'ring-2 ring-inset ring-yellow-400 shadow-[inset_0_0_0_1px_rgba(250,204,21,0.35)]'
    if (urgency < 0.5) return 'ring-2 ring-inset ring-amber-500 shadow-[inset_0_0_12px_rgba(245,158,11,0.15)]'
    if (urgency < 0.75) return 'ring-2 ring-inset ring-orange-600 shadow-[inset_0_0_16px_rgba(234,88,12,0.2)]'
    return 'ring-2 ring-inset ring-red-900 shadow-[inset_0_0_20px_rgba(127,29,29,0.35)]'
  }
  if (canPull) {
    return 'ring-1 ring-inset ring-orange-700/60'
  }
  return ''
}
