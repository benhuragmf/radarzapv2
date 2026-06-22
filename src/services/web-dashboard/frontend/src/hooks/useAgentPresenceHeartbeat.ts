import { useEffect, useRef, useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSocket } from '../lib/socket'
import { api } from '../lib/api'
import { useAgentPresenceContext } from '../lib/agentPresenceContext'
import type { AgentOperationalStatus, AgentStatusSource } from '@radarzap-types/agent-presence'

type PresenceConfigResponse = {
  idleTimeoutSeconds: number
  heartbeatIntervalSeconds: number
  offlineTimeoutSeconds: number
  selectableStatuses: AgentOperationalStatus[]
}

type PresenceMeResponse = {
  operationalStatus: AgentOperationalStatus
  statusSource: AgentStatusSource
  statusLabel: string
  lastManualStatus: AgentOperationalStatus
  online: boolean
  availableForQueue: boolean
}

function statusLabelFor(status: AgentOperationalStatus): string {
  switch (status) {
    case 'online':
      return 'Online'
    case 'ausente':
      return 'Ausente'
    case 'ocupado':
      return 'Ocupado / Não receber'
    case 'supervisor_online':
      return 'Online sem receber atendimento'
    default:
      return 'Offline'
  }
}

function mePresenceKey(data: PresenceMeResponse): string {
  return [
    data.operationalStatus,
    data.statusSource,
    data.statusLabel,
    data.lastManualStatus,
    data.online,
    data.availableForQueue,
  ].join('|')
}

/** Mantém presença do atendente: socket, heartbeat, inatividade e status operacional. */
export function useAgentPresenceHeartbeat(enabled = true) {
  const { pathname, search, hash } = useLocation()
  const [searchParams] = useSearchParams()
  const qc = useQueryClient()
  const {
    viewingConversationId: ctxViewingId,
    setIdleTimeoutMs,
    setHeartbeatIntervalMs,
    setSelectableStatuses,
    setPresenceLocal,
    setRestorePromptOpen,
    actionsRef,
    setStatusPending,
    idleTimeoutMs,
    heartbeatIntervalMs,
    lastActivityAt,
    touchActivity,
    presence,
  } = useAgentPresenceContext()

  const convFromUrl = searchParams.get('conv')
  const viewingConversationId = ctxViewingId ?? convFromUrl ?? null
  const route = `${pathname}${search}${hash}`
  const autoAusenteRef = useRef(false)
  const presenceHydratedRef = useRef(false)
  const lastMePresenceKeyRef = useRef<string | null>(null)
  const presenceRef = useRef(presence)
  presenceRef.current = presence
  const lastActivityAtRef = useRef(lastActivityAt)
  lastActivityAtRef.current = lastActivityAt

  const { data: config } = useQuery({
    queryKey: ['inbox-presence-config'],
    queryFn: () => api.get<PresenceConfigResponse>('/inbox/presence/config'),
    enabled,
    staleTime: 60_000,
  })

  useEffect(() => {
    if (!config) return
    setIdleTimeoutMs(config.idleTimeoutSeconds * 1000)
    setHeartbeatIntervalMs(config.heartbeatIntervalSeconds * 1000)
    setSelectableStatuses(config.selectableStatuses)
  }, [config, setIdleTimeoutMs, setHeartbeatIntervalMs, setSelectableStatuses])

  const { data: mePresence } = useQuery({
    queryKey: ['inbox-presence-me'],
    queryFn: () => api.get<PresenceMeResponse>('/inbox/presence/me'),
    enabled,
    staleTime: 30_000,
  })

  const { mutate: mutateStatus, isPending: statusPending } = useMutation({
    mutationFn: (status: AgentOperationalStatus) =>
      api.patch<PresenceMeResponse>('/inbox/presence/me', { status }),
    onSuccess: data => {
      autoAusenteRef.current = false
      setRestorePromptOpen(false)
      lastMePresenceKeyRef.current = mePresenceKey(data)
      setPresenceLocal({
        operationalStatus: data.operationalStatus,
        statusSource: data.statusSource,
        statusLabel: data.statusLabel,
        lastManualStatus: data.lastManualStatus ?? data.operationalStatus,
        online: data.online,
        availableForQueue: data.availableForQueue,
      })
      qc.setQueryData(['inbox-presence-me'], data)
    },
  })

  const mutateStatusRef = useRef(mutateStatus)
  mutateStatusRef.current = mutateStatus

  const pendingRef = useRef(false)
  pendingRef.current = statusPending

  useEffect(() => {
    if (!mePresence || pendingRef.current) return
    const key = mePresenceKey(mePresence)
    if (presenceHydratedRef.current && lastMePresenceKeyRef.current === key) return
    lastMePresenceKeyRef.current = key
    presenceHydratedRef.current = true
    setPresenceLocal({
      operationalStatus: mePresence.operationalStatus,
      statusSource: mePresence.statusSource,
      statusLabel: mePresence.statusLabel,
      lastManualStatus: mePresence.lastManualStatus,
      online: mePresence.online,
      availableForQueue: mePresence.availableForQueue,
    })
  }, [mePresence, setPresenceLocal])

  const setOperationalStatus = useCallback(
    (status: AgentOperationalStatus, source: AgentStatusSource = 'manual') => {
      setPresenceLocal({
        operationalStatus: status,
        statusSource: source,
        statusLabel: statusLabelFor(status),
        ...(source === 'manual' ? { lastManualStatus: status } : {}),
      })
      if (source === 'manual') {
        mutateStatusRef.current(status)
      }
    },
    [setPresenceLocal],
  )

  const restoreFromAutoAusente = useCallback(() => {
    const last = presenceRef.current.lastManualStatus
    const target = last === 'ausente' ? 'online' : last
    setOperationalStatus(target, 'manual')
  }, [setOperationalStatus])

  actionsRef.current = {
    setOperationalStatus,
    restoreFromAutoAusente,
    statusPending,
  }

  useEffect(() => {
    setStatusPending(statusPending)
  }, [statusPending, setStatusPending])

  useEffect(() => {
    if (!enabled) return

    const onActivity = () => touchActivity()
    const events: Array<keyof WindowEventMap> = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'focus',
    ]
    for (const ev of events) {
      window.addEventListener(ev, onActivity, { passive: true })
    }

    const onVisibility = () => {
      touchActivity()
      if (document.visibilityState === 'visible' && autoAusenteRef.current) {
        setRestorePromptOpen(true)
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    return () => {
      for (const ev of events) {
        window.removeEventListener(ev, onActivity)
      }
      document.removeEventListener('visibilitychange', onVisibility)
    }
  }, [enabled, touchActivity, setRestorePromptOpen])

  useEffect(() => {
    if (!enabled || idleTimeoutMs <= 0) return

    const timer = window.setInterval(() => {
      const idleMs = Date.now() - lastActivityAtRef.current
      if (idleMs >= idleTimeoutMs && presenceRef.current.operationalStatus === 'online') {
        autoAusenteRef.current = true
        setOperationalStatus('ausente', 'auto')
      }
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [enabled, idleTimeoutMs, setOperationalStatus])

  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()
    const ensureConnectedPresence = () => {
      const p = presenceRef.current
      if (p.operationalStatus !== 'offline' || p.statusSource === 'manual') return
      const target = p.lastManualStatus === 'offline' ? 'offline' : 'online'
      if (target === 'offline') return
      setPresenceLocal({
        operationalStatus: target,
        statusSource: 'auto',
        statusLabel: statusLabelFor(target),
        online: true,
        availableForQueue: target === 'online',
      })
    }
    const ping = () => {
      if (!socket.connected) return
      ensureConnectedPresence()
      const p = presenceRef.current
      const payload: {
        route: string
        viewingConversationId: string | null
        operationalStatus?: AgentOperationalStatus
        statusSource?: AgentStatusSource
      } = { route, viewingConversationId }
      const skipDefaultOffline =
        !presenceHydratedRef.current &&
        p.operationalStatus === 'offline' &&
        p.statusSource === 'auto'
      if (!skipDefaultOffline) {
        payload.operationalStatus = p.operationalStatus
        payload.statusSource = p.statusSource
      }
      socket.emit('agent:heartbeat', payload)
    }

    ping()
    const timer = window.setInterval(ping, heartbeatIntervalMs)
    socket.on('connect', ping)

    return () => {
      window.clearInterval(timer)
      socket.off('connect', ping)
    }
  }, [enabled, route, viewingConversationId, heartbeatIntervalMs, setPresenceLocal])
}
