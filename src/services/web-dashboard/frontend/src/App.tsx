import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import Layout from './components/layout/Layout'
import ProtectedRoute from './components/ProtectedRoute'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Rules from './pages/Rules'
import Templates from './pages/Templates'
import Queue from './pages/Queue'
import Logs from './pages/Logs'
import SendNow from './pages/SendNow'
import SendSchedules from './pages/SendSchedules'
import SendHistory from './pages/SendHistory'
import Destinations from './pages/Destinations'
import WhatsAppGroups from './pages/WhatsAppGroups'
import DestinationsHistory from './pages/DestinationsHistory'
import DiscordSettings from './pages/DiscordSettings'
import Channels from './pages/Channels'
import Plans from './pages/Plans'
import Settings from './pages/Settings'
import TeamMembers from './pages/TeamMembers'
import AdminDashboard from './pages/admin/AdminDashboard'
import AdminClients from './pages/admin/AdminClients'
import Login from './pages/Login'
import { getMe, type AuthUser } from './lib/auth'
import { Spinner } from './components/ui/Spinner'

export const AuthContext = { user: null as AuthUser | null }

function Guard({ user, path, children }: { user: AuthUser; path: string; children: React.ReactNode }) {
  return <ProtectedRoute user={user} path={path}>{children}</ProtectedRoute>
}

/** Links antigos /test-send e /send#agendados */
function LegacySendRedirect() {
  const { hash } = useLocation()
  if (hash === '#agendados') return <Navigate to="/send/agendamentos" replace />
  return <Navigate to="/send" replace />
}

function SendPage() {
  const { hash } = useLocation()
  if (hash === '#agendados') return <Navigate to="/send/agendamentos" replace />
  return <SendNow />
}

export default function App() {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const urlError = new URLSearchParams(window.location.search).get('error') ?? undefined

  useEffect(() => {
    getMe().then(u => { setUser(u); setLoading(false) })
  }, [])

  useEffect(() => {
    const onFocus = () => getMe().then(u => u && setUser(u))
    window.addEventListener('focus', onFocus)
    return () => window.removeEventListener('focus', onFocus)
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-950">
        <Spinner size={32} />
      </div>
    )
  }

  if (!user) return <Login error={urlError} />

  AuthContext.user = user
  const home = user.isInternalStaff ? '/admin/dashboard' : '/dashboard'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route index element={<Navigate to={home} replace />} />

          {/* Cliente */}
          <Route path="dashboard" element={<Guard user={user} path="/dashboard"><Dashboard /></Guard>} />
          <Route path="sessions" element={<Guard user={user} path="/sessions"><Sessions /></Guard>} />
          <Route path="destinations" element={<Guard user={user} path="/destinations"><Destinations /></Guard>} />
          <Route path="grupos" element={<Guard user={user} path="/grupos"><WhatsAppGroups /></Guard>} />

          {/* Discord — automação */}
          <Route path="discord/channels" element={<Guard user={user} path="/discord/channels"><Channels /></Guard>} />
          <Route path="discord/rules" element={<Guard user={user} path="/discord/rules"><Rules /></Guard>} />
          <Route path="discord/templates" element={<Guard user={user} path="/discord/templates"><Templates /></Guard>} />
          <Route path="discord/grupos" element={<Guard user={user} path="/discord/grupos"><WhatsAppGroups /></Guard>} />
          <Route path="discord/destinations/historico" element={<Guard user={user} path="/discord/destinations/historico"><DestinationsHistory /></Guard>} />
          <Route path="discord/destinations" element={<Guard user={user} path="/discord/destinations"><Destinations /></Guard>} />
          <Route path="discord/destinations/novo" element={<Navigate to="/discord/destinations" replace />} />
          <Route path="discord/destinations/contatos" element={<Navigate to="/discord/destinations" replace />} />
          <Route path="discord/fila" element={<Guard user={user} path="/discord/fila"><Queue scope="discord" /></Guard>} />
          <Route path="discord/logs" element={<Guard user={user} path="/discord/logs"><Logs scope="discord" /></Guard>} />
          <Route path="discord/settings" element={<Guard user={user} path="/discord/settings"><DiscordSettings user={user} /></Guard>} />

          {/* Legado → Discord */}
          <Route path="channels" element={<Navigate to="/discord/channels" replace />} />
          <Route path="rules" element={<Navigate to="/discord/rules" replace />} />
          <Route path="templates" element={<Navigate to="/discord/templates" replace />} />
          <Route path="queue" element={<Navigate to="/discord/fila" replace />} />
          <Route path="logs" element={<Navigate to="/discord/logs" replace />} />
          <Route path="send/agendamentos" element={<Guard user={user} path="/send/agendamentos"><SendSchedules /></Guard>} />
          <Route path="send/historico" element={<Guard user={user} path="/send/historico"><SendHistory /></Guard>} />
          <Route path="send" element={<Guard user={user} path="/send"><SendPage /></Guard>} />
          <Route path="test-send" element={<LegacySendRedirect />} />
          <Route path="plans" element={<Guard user={user} path="/plans"><Plans user={user} /></Guard>} />
          <Route path="settings/team" element={<Guard user={user} path="/settings/team"><TeamMembers /></Guard>} />
          <Route path="settings" element={<Guard user={user} path="/settings"><Settings user={user} /></Guard>} />

          {/* Admin interno */}
          <Route path="admin/dashboard" element={<Guard user={user} path="/admin/dashboard"><AdminDashboard /></Guard>} />
          <Route path="admin/clients" element={<Guard user={user} path="/admin/clients"><AdminClients /></Guard>} />
          <Route path="admin/servers" element={<Guard user={user} path="/admin/servers"><AdminDashboard title="Servidores" /></Guard>} />
          <Route path="admin/sessions" element={<Guard user={user} path="/admin/sessions"><Sessions /></Guard>} />
          <Route path="admin/queue" element={<Guard user={user} path="/admin/queue"><Queue /></Guard>} />
          <Route path="admin/logs" element={<Guard user={user} path="/admin/logs"><Logs /></Guard>} />
          <Route path="admin/plans" element={<Guard user={user} path="/admin/plans"><Plans user={user} admin /></Guard>} />
          <Route path="admin/payments" element={<Guard user={user} path="/admin/payments"><AdminDashboard title="Pagamentos" /></Guard>} />
          <Route path="admin/moderation" element={<Guard user={user} path="/admin/moderation"><AdminDashboard title="Moderação" /></Guard>} />
          <Route path="admin/audit" element={<Guard user={user} path="/admin/audit"><AdminDashboard title="Auditoria" /></Guard>} />
          <Route path="admin/api" element={<Guard user={user} path="/admin/api"><AdminDashboard title="API Global" /></Guard>} />
          <Route path="admin/settings" element={<Guard user={user} path="/admin/settings"><AdminDashboard title="Configurações do Sistema" /></Guard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
