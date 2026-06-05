import type { Campaign } from './campaigns'

export type ScheduleTab = 'fila' | 'historico' | 'todos'

export function scheduleCountdown(scheduledFor: string): string {
  const diff = new Date(scheduledFor).getTime() - Date.now()
  if (diff <= 0) return 'agora'
  const mins = Math.floor(diff / 60_000)
  if (mins < 60) return `em ${mins} min`
  const hours = Math.floor(mins / 60)
  const rem = mins % 60
  if (hours < 24) return rem > 0 ? `em ${hours}h ${rem}min` : `em ${hours}h`
  const days = Math.floor(hours / 24)
  const h = hours % 24
  return h > 0 ? `em ${days}d ${h}h` : `em ${days}d`
}

export function scheduleStats(campaigns: Campaign[]) {
  const pending = campaigns.filter(c => c.status === 'pending')
  const processing = campaigns.filter(c => c.status === 'processing')
  const sent = campaigns.filter(c => c.status === 'sent')
  const failed = campaigns.filter(c => c.status === 'failed')
  return {
    pending: pending.length,
    processing: processing.length,
    sent: sent.length,
    failed: failed.length,
    queue: pending.length + processing.length,
  }
}

export function sortByScheduled(campaigns: Campaign[]): Campaign[] {
  return [...campaigns].sort(
    (a, b) => new Date(a.scheduledFor).getTime() - new Date(b.scheduledFor).getTime(),
  )
}

export function nextScheduled(campaigns: Campaign[]): Campaign | null {
  const upcoming = campaigns.filter(c => c.status === 'pending' || c.status === 'processing')
  if (upcoming.length === 0) return null
  return sortByScheduled(upcoming)[0]
}

function sortForTab(list: Campaign[], tab: ScheduleTab): Campaign[] {
  if (tab === 'historico') {
    return [...list].sort((a, b) => {
      const ta = new Date(a.processedAt ?? a.scheduledFor).getTime()
      const tb = new Date(b.processedAt ?? b.scheduledFor).getTime()
      return tb - ta
    })
  }
  return sortByScheduled(list)
}

export function filterCampaigns(
  campaigns: Campaign[],
  tab: ScheduleTab,
  search: string,
): Campaign[] {
  let list = campaigns
  if (tab === 'fila') {
    list = list.filter(c => c.status === 'pending' || c.status === 'processing')
  } else if (tab === 'historico') {
    list = list.filter(c => c.status === 'sent' || c.status === 'failed')
  }
  const q = search.trim().toLowerCase()
  const filtered = q
    ? list.filter(
        c =>
          c.title.toLowerCase().includes(q) ||
          c.message.toLowerCase().includes(q) ||
          c.destinations.some(d => d.name.toLowerCase().includes(q)),
      )
    : list
  return sortForTab(filtered, tab)
}
