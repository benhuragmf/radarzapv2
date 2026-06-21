import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { AgentOperationalStatus, AgentStatusSource } from '@radarzap-types/agent-presence'

export type AgentPresenceState = {
  operationalStatus: AgentOperationalStatus
  statusSource: AgentStatusSource
  statusLabel: string
  lastManualStatus: AgentOperationalStatus
  online: boolean
  availableForQueue: boolean
}

type AgentPresenceActions = {
  setOperationalStatus: (status: AgentOperationalStatus, source?: AgentStatusSource) => void
  restoreFromAutoAusente: () => void
  statusPending: boolean
}

type AgentPresenceContextValue = {
  viewingConversationId: string | null
  setViewingConversationId: (id: string | null) => void
  presence: AgentPresenceState
  setPresenceLocal: (patch: Partial<AgentPresenceState>) => void
  idleTimeoutMs: number
  setIdleTimeoutMs: (ms: number) => void
  heartbeatIntervalMs: number
  setHeartbeatIntervalMs: (ms: number) => void
  lastActivityAt: number
  touchActivity: () => void
  restorePromptOpen: boolean
  setRestorePromptOpen: (open: boolean) => void
  selectableStatuses: AgentOperationalStatus[]
  setSelectableStatuses: (statuses: AgentOperationalStatus[]) => void
  actions: AgentPresenceActions
  setActions: (actions: AgentPresenceActions) => void
}

const defaultPresence: AgentPresenceState = {
  operationalStatus: 'offline',
  statusSource: 'auto',
  statusLabel: 'Offline',
  lastManualStatus: 'online',
  online: false,
  availableForQueue: false,
}

const noopActions: AgentPresenceActions = {
  setOperationalStatus: () => {},
  restoreFromAutoAusente: () => {},
  statusPending: false,
}

const AgentPresenceContext = createContext<AgentPresenceContextValue | null>(null)

function statusesEqual(a: AgentOperationalStatus[], b: AgentOperationalStatus[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

export function AgentPresenceProvider({ children }: { children: ReactNode }) {
  const [viewingConversationId, setViewingConversationId] = useState<string | null>(null)
  const [presence, setPresence] = useState<AgentPresenceState>(defaultPresence)
  const [idleTimeoutMs, setIdleTimeoutMsState] = useState(5 * 60 * 1000)
  const [heartbeatIntervalMs, setHeartbeatIntervalMsState] = useState(30 * 1000)
  const [lastActivityAt, setLastActivityAt] = useState(() => Date.now())
  const [restorePromptOpen, setRestorePromptOpen] = useState(false)
  const [selectableStatuses, setSelectableStatusesState] = useState<AgentOperationalStatus[]>([
    'online',
    'ausente',
    'ocupado',
    'offline',
  ])
  const [actions, setActionsState] = useState<AgentPresenceActions>(noopActions)

  const touchActivity = useCallback(() => {
    setLastActivityAt(Date.now())
  }, [])

  const setPresenceLocal = useCallback((patch: Partial<AgentPresenceState>) => {
    setPresence(prev => ({ ...prev, ...patch }))
  }, [])

  const setIdleTimeoutMs = useCallback((ms: number) => {
    setIdleTimeoutMsState(prev => (prev === ms ? prev : ms))
  }, [])

  const setHeartbeatIntervalMs = useCallback((ms: number) => {
    setHeartbeatIntervalMsState(prev => (prev === ms ? prev : ms))
  }, [])

  const setSelectableStatuses = useCallback((statuses: AgentOperationalStatus[]) => {
    setSelectableStatusesState(prev => (statusesEqual(prev, statuses) ? prev : statuses))
  }, [])

  const setActions = useCallback((next: AgentPresenceActions) => {
    setActionsState(prev => {
      if (
        prev.statusPending === next.statusPending &&
        prev.setOperationalStatus === next.setOperationalStatus &&
        prev.restoreFromAutoAusente === next.restoreFromAutoAusente
      ) {
        return prev
      }
      return next
    })
  }, [])

  const value = useMemo(
    () => ({
      viewingConversationId,
      setViewingConversationId,
      presence,
      setPresenceLocal,
      idleTimeoutMs,
      setIdleTimeoutMs,
      heartbeatIntervalMs,
      setHeartbeatIntervalMs,
      lastActivityAt,
      touchActivity,
      restorePromptOpen,
      setRestorePromptOpen,
      selectableStatuses,
      setSelectableStatuses,
      actions,
      setActions,
    }),
    [
      viewingConversationId,
      presence,
      setPresenceLocal,
      idleTimeoutMs,
      setIdleTimeoutMs,
      heartbeatIntervalMs,
      setHeartbeatIntervalMs,
      lastActivityAt,
      touchActivity,
      restorePromptOpen,
      selectableStatuses,
      setSelectableStatuses,
      actions,
    ],
  )

  return <AgentPresenceContext.Provider value={value}>{children}</AgentPresenceContext.Provider>
}

export function useAgentPresenceContext(): AgentPresenceContextValue {
  const ctx = useContext(AgentPresenceContext)
  if (!ctx) {
    throw new Error('useAgentPresenceContext must be used within AgentPresenceProvider')
  }
  return ctx
}
