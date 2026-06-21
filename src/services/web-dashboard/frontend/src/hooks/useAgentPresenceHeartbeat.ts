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
    setActions,
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
  const presenceRef = useRef(presence)
  presenceRef.current = presence

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

  const pendingRef = useRef(false)
  pendingRef.current = statusPending

  useEffect(() => {
    if (!mePresence || pendingRef.current) return
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
        mutateStatus(status)
      }
    },
    [setPresenceLocal, mutateStatus],
  )

  const restoreFromAutoAusente = useCallback(() => {
    const last = presenceRef.current.lastManualStatus
    const target = last === 'ausente' ? 'online' : last
    setOperationalStatus(target, 'manual')
  }, [setOperationalStatus])

  useEffect(() => {
    setActions({
      setOperationalStatus,
      restoreFromAutoAusente,
      statusPending,
    })
  }, [setOperationalStatus, restoreFromAutoAusente, statusPending, setActions])

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
      const idleMs = Date.now() - lastActivityAt
      if (idleMs >= idleTimeoutMs && presenceRef.current.operationalStatus === 'online') {
        autoAusenteRef.current = true
        setOperationalStatus('ausente', 'auto')
      }
    }, 15_000)

    return () => window.clearInterval(timer)
  }, [enabled, idleTimeoutMs, lastActivityAt, setOperationalStatus])

  useEffect(() => {
    if (!enabled) return

    const socket = getSocket()
    const ping = () => {
      if (socket.connected) {
        const p = presenceRef.current
        socket.emit('agent:heartbeat', {
          route,
          viewingConversationId,
          operationalStatus: p.operationalStatus,
          statusSource: p.statusSource,
        })
      }
    }

    ping()
    const timer = window.setInterval(ping, heartbeatIntervalMs)
    socket.on('connect', ping)

    return () => {
      window.clearInterval(timer)
      socket.off('connect', ping)
    }
  }, [enabled, route, viewingConversationId, heartbeatIntervalMs])
}
