import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type MutableRefObject,
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

export type AgentPresenceActions = {
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
  actionsRef: MutableRefObject<AgentPresenceActions>
  statusPending: boolean
  setStatusPending: (pending: boolean) => void
}

const defaultPresence: AgentPresenceState = {
  operationalStatus: 'offline',
  statusSource: 'auto',
  statusLabel: 'Offline',
  lastManualStatus: 'online',
  online: false,
  availableForQueue: false,
}

export const noopAgentPresenceActions: AgentPresenceActions = {
  setOperationalStatus: () => {},
  restoreFromAutoAusente: () => {},
  statusPending: false,
}

const AgentPresenceContext = createContext<AgentPresenceContextValue | null>(null)

function statusesEqual(a: AgentOperationalStatus[], b: AgentOperationalStatus[]): boolean {
  return a.length === b.length && a.every((s, i) => s === b[i])
}

function presencePatchEqual(
  prev: AgentPresenceState,
  patch: Partial<AgentPresenceState>,
): boolean {
  return (Object.keys(patch) as (keyof AgentPresenceState)[]).every(k => prev[k] === patch[k])
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
  const [statusPending, setStatusPendingState] = useState(false)
  const actionsRef = useRef<AgentPresenceActions>(noopAgentPresenceActions)

  const touchActivity = useCallback(() => {
    setLastActivityAt(Date.now())
  }, [])

  const setPresenceLocal = useCallback((patch: Partial<AgentPresenceState>) => {
    setPresence(prev => {
      if (presencePatchEqual(prev, patch)) return prev
      return { ...prev, ...patch }
    })
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

  const setStatusPending = useCallback((pending: boolean) => {
    setStatusPendingState(prev => (prev === pending ? prev : pending))
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
      actionsRef,
      statusPending,
      setStatusPending,
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
      statusPending,
      setStatusPending,
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
