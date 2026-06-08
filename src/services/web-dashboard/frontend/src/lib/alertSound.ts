let audioCtx: AudioContext | null = null

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (!audioCtx) audioCtx = new AudioContext()
  return audioCtx
}

export function playAlertSound(kind: 'chat' | 'message' | 'urgent' = 'chat'): void {
  const ctx = getCtx()
  if (!ctx) return
  if (ctx.state === 'suspended') void ctx.resume()

  const osc = ctx.createOscillator()
  const gain = ctx.createGain()
  osc.connect(gain)
  gain.connect(ctx.destination)

  const freqs = kind === 'urgent' ? [880, 660, 880] : kind === 'message' ? [520] : [740, 880]
  const duration = kind === 'urgent' ? 0.12 : 0.1

  let t = ctx.currentTime
  for (const f of freqs) {
    osc.frequency.setValueAtTime(f, t)
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.08, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + duration)
    t += duration + 0.04
  }

  osc.type = 'sine'
  osc.start(ctx.currentTime)
  osc.stop(t + 0.05)
}
