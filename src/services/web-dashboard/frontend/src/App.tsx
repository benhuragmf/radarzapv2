/*
 * RadarZap / RadarGamer
 * Copyright (c) 2026 Benhur Augusto Gomes Monteiro Faria
 * Todos os direitos reservados.
 * Uso, cópia, distribuição ou modificação sem autorização é proibido.
 */

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
import SendAutoSchedules from './pages/SendAutoSchedules'
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
import AdminAiBlueprint from './pages/admin/AdminAiBlueprint'
import PlatformTemplates from './pages/platform/PlatformTemplates'
import PlatformReports from './pages/platform/PlatformReports'
import PlatformContacts from './pages/platform/PlatformContacts'
import PlatformAutomations from './pages/platform/PlatformAutomations'
import EmBreveRedirect from './pages/menu/EmBreveRedirect'
import PlatformAudit from './pages/menu/PlatformAudit'
import PlatformCampaigns from './pages/menu/PlatformCampaigns'
import ContactSegments from './pages/menu/ContactSegments'
import PlatformTriggers from './pages/menu/PlatformTriggers'
import WaLogs from './pages/menu/WaLogs'
import WaStatus from './pages/menu/WaStatus'
import WaStatusPosts from './pages/menu/WaStatusPosts'
import Inbox from './pages/menu/Inbox'
import InboxSectors from './pages/menu/InboxSectors'
import InboxBotSettings from './pages/menu/InboxBotSettings'
import AiAtendimento from './pages/menu/AiAtendimento'
import InboxReports from './pages/menu/InboxReports'
import InboxQuickReplies from './pages/menu/InboxQuickReplies'
import InboxTickets from './pages/menu/InboxTickets'
import InboxTicketDetail from './pages/menu/InboxTicketDetail'
import InboxSupervisor from './pages/menu/InboxSupervisor'
import AdminMonitoring from './pages/menu/AdminMonitoring'
import AdminErrors from './pages/menu/AdminErrors'
import AdminServers from './pages/menu/AdminServers'
import AdminAuditPage from './pages/menu/AdminAuditPage'
import AdminModeration from './pages/menu/AdminModeration'
import AdminSettingsPage from './pages/menu/AdminSettingsPage'
import AdminApiPage from './pages/menu/AdminApiPage'
import AdminPaymentsPage from './pages/menu/AdminPaymentsPage'
import AdminPermissionsPage from './pages/menu/AdminPermissionsPage'
import AdminSecurityPage from './pages/menu/AdminSecurityPage'
import AdminBackupPage from './pages/menu/AdminBackupPage'
import DiscordHome from './pages/discord/DiscordHome'
import PermissionsPage from './pages/menu/PermissionsPage'
import SecuritySettings from './pages/menu/SecuritySettings'
import BackupExport from './pages/menu/BackupExport'
import { ApiPlayground } from './components/integrations/ApiPlayground'
import Login from './pages/Login'
import ChooseCompany from './pages/ChooseCompany'
import { getMe, type AuthUser } from './lib/auth'
import { AuthContext } from './lib/authContext'
import { Spinner } from './components/ui/Spinner'

function Guard({ user, path, children }: { user: AuthUser; path: string; children: React.ReactNode }) {
  return <ProtectedRoute user={user} path={path}>{children}</ProtectedRoute>
}

/** Links antigos /test-send e /send#agendados */
function LegacySendRedirect() {
  const { hash } = useLocation()
  if (hash === '#agendados') return <Navigate to="/send/agendamentos" replace />
  return <Navigate to="/send" replace />
}

function ApiPlaygroundPage() {
  return (
    <div className="max-w-2xl space-y-4">
      <h1 className="text-lg font-semibold text-white">Playground</h1>
      <p className="text-sm text-gray-500">Teste envios e respostas da API sem sair do painel.</p>
      <ApiPlayground />
    </div>
  )
}

function SendPage() {
  const { hash } = useLocation()
  if (hash === '#agendados') return <Navigate to="/send/agendamentos" replace />
  if (hash === '#playground') return <Navigate to="/integrations/playground" replace />
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

  if (user.needsOrganizationChoice) {
    return (
      <ChooseCompany
        user={user}
        onSelected={u => setUser(u)}
      />
    )
  }

  AuthContext.user = user
  const home = '/dashboard'

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={() => setUser(null)} onUserUpdate={setUser} />}>
          <Route index element={<Navigate to={home} replace />} />

          {/* Cliente */}
          <Route path="dashboard" element={<Guard user={user} path="/dashboard"><Dashboard /></Guard>} />
          <Route path="platform/templates" element={<Guard user={user} path="/platform/templates"><PlatformTemplates /></Guard>} />
          <Route path="platform/reports" element={<Guard user={user} path="/platform/reports"><PlatformReports /></Guard>} />
          <Route path="platform/contacts" element={<Guard user={user} path="/platform/contacts"><PlatformContacts /></Guard>} />
          <Route path="platform" element={<Navigate to="/dashboard" replace />} />
          <Route path="sessions" element={<Guard user={user} path="/sessions"><Sessions /></Guard>} />
          <Route path="contact" element={<Guard user={user} path="/contact"><Destinations /></Guard>} />
          <Route path="destinations" element={<Navigate to="/contact" replace />} />
          <Route path="grupos" element={<Guard user={user} path="/grupos"><WhatsAppGroups /></Guard>} />

          {/* Discord — automação */}
          <Route path="discord" element={<Guard user={user} path="/discord"><DiscordHome /></Guard>} />
          <Route path="discord/channels" element={<Guard user={user} path="/discord/channels"><Channels /></Guard>} />
          <Route path="discord/rules" element={<Guard user={user} path="/discord/rules"><Rules /></Guard>} />
          <Route path="discord/templates" element={<Guard user={user} path="/discord/templates"><Templates /></Guard>} />
          <Route path="discord/grupos" element={<Guard user={user} path="/discord/grupos"><WhatsAppGroups /></Guard>} />
          <Route path="discord/contact/historico" element={<Guard user={user} path="/discord/contact/historico"><DestinationsHistory /></Guard>} />
          <Route path="discord/contact" element={<Guard user={user} path="/discord/contact"><Destinations /></Guard>} />
          <Route path="discord/destinations/historico" element={<Navigate to="/discord/contact/historico" replace />} />
          <Route path="discord/destinations" element={<Navigate to="/discord/contact" replace />} />
          <Route path="discord/destinations/novo" element={<Navigate to="/discord/contact" replace />} />
          <Route path="discord/destinations/contatos" element={<Navigate to="/discord/contact" replace />} />
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
          <Route path="send/autoagendamentos" element={<Guard user={user} path="/send/autoagendamentos"><SendAutoSchedules /></Guard>} />
          <Route path="platform/automacoes" element={<Guard user={user} path="/platform/automacoes"><PlatformAutomations /></Guard>} />
          <Route path="platform/audit" element={<Guard user={user} path="/platform/audit"><PlatformAudit /></Guard>} />
          <Route path="platform/campanhas" element={<Guard user={user} path="/platform/campanhas"><PlatformCampaigns /></Guard>} />
          <Route path="platform/segmentos" element={<Guard user={user} path="/platform/segmentos"><ContactSegments /></Guard>} />
          <Route path="platform/gatilhos" element={<Guard user={user} path="/platform/gatilhos"><PlatformTriggers /></Guard>} />
          <Route path="platform/wa-logs" element={<Guard user={user} path="/platform/wa-logs"><WaLogs /></Guard>} />
          <Route path="platform/wa-stories" element={<Guard user={user} path="/platform/wa-stories"><WaStatusPosts /></Guard>} />
          <Route path="platform/inbox" element={<Guard user={user} path="/platform/inbox"><Inbox /></Guard>} />
          <Route path="platform/inbox/setores" element={<Guard user={user} path="/platform/inbox/setores"><InboxSectors /></Guard>} />
          <Route path="platform/inbox/bot" element={<Guard user={user} path="/platform/inbox/bot"><InboxBotSettings /></Guard>} />
          <Route path="platform/inbox/ia" element={<Guard user={user} path="/platform/inbox/ia"><AiAtendimento /></Guard>} />
          <Route path="platform/inbox/supervisor" element={<Guard user={user} path="/platform/inbox/supervisor"><InboxSupervisor /></Guard>} />
          <Route path="platform/inbox/relatorios" element={<Guard user={user} path="/platform/inbox/relatorios"><InboxReports /></Guard>} />
          <Route path="platform/inbox/respostas" element={<Guard user={user} path="/platform/inbox/respostas"><InboxQuickReplies /></Guard>} />
          <Route path="platform/inbox/tickets" element={<Guard user={user} path="/platform/inbox/tickets"><InboxTickets /></Guard>} />
          <Route path="platform/inbox/tickets/:ref" element={<Guard user={user} path="/platform/inbox/tickets"><InboxTicketDetail /></Guard>} />
          <Route path="platform/wa-status" element={<Guard user={user} path="/platform/wa-status"><WaStatus /></Guard>} />
          <Route path="platform/fila" element={<Guard user={user} path="/platform/fila"><Queue scope="tenant" /></Guard>} />
          <Route path="send/aniversarios" element={<Navigate to="/platform/automacoes" replace />} />
          <Route path="send/historico" element={<Guard user={user} path="/send/historico"><SendHistory /></Guard>} />
          <Route path="send" element={<Guard user={user} path="/send"><SendPage /></Guard>} />
          <Route path="test-send" element={<LegacySendRedirect />} />
          <Route path="plans" element={<Guard user={user} path="/plans"><Plans user={user} /></Guard>} />
          <Route path="integrations/playground" element={<Guard user={user} path="/integrations/playground"><ApiPlaygroundPage /></Guard>} />
          <Route path="settings/team" element={<Guard user={user} path="/settings/team"><TeamMembers /></Guard>} />
          <Route path="settings/permissions" element={<Guard user={user} path="/settings/permissions"><PermissionsPage /></Guard>} />
          <Route path="settings/security" element={<Guard user={user} path="/settings/security"><SecuritySettings /></Guard>} />
          <Route path="settings/backup" element={<Guard user={user} path="/settings/backup"><BackupExport /></Guard>} />
          <Route path="settings/equipe" element={<Navigate to="/settings/team" replace />} />
          <Route path="settings" element={<Guard user={user} path="/settings"><Settings user={user} onUserUpdate={setUser} /></Guard>} />
          <Route path="em-breve/:slug" element={<Guard user={user} path="/em-breve"><EmBreveRedirect /></Guard>} />

          {/* Admin interno */}
          <Route path="admin/dashboard" element={<Guard user={user} path="/admin/dashboard"><AdminDashboard /></Guard>} />
          <Route path="admin/clients" element={<Guard user={user} path="/admin/clients"><AdminClients /></Guard>} />
          <Route path="admin/servers" element={<Guard user={user} path="/admin/servers"><AdminServers /></Guard>} />
          <Route path="admin/sessions" element={<Guard user={user} path="/admin/sessions"><Sessions /></Guard>} />
          <Route path="admin/queue" element={<Guard user={user} path="/admin/queue"><Queue /></Guard>} />
          <Route path="admin/logs" element={<Guard user={user} path="/admin/logs"><Logs /></Guard>} />
          <Route path="admin/monitoring" element={<Guard user={user} path="/admin/monitoring"><AdminMonitoring /></Guard>} />
          <Route path="admin/errors" element={<Guard user={user} path="/admin/errors"><AdminErrors /></Guard>} />
          <Route path="admin/plans" element={<Guard user={user} path="/admin/plans"><Plans user={user} admin /></Guard>} />
          <Route path="admin/payments" element={<Guard user={user} path="/admin/payments"><AdminPaymentsPage /></Guard>} />
          <Route path="admin/moderation" element={<Guard user={user} path="/admin/moderation"><AdminModeration /></Guard>} />
          <Route path="admin/audit" element={<Guard user={user} path="/admin/audit"><AdminAuditPage /></Guard>} />
          <Route path="admin/api" element={<Guard user={user} path="/admin/api"><AdminApiPage /></Guard>} />
          <Route path="admin/settings" element={<Guard user={user} path="/admin/settings"><AdminSettingsPage /></Guard>} />
          <Route path="admin/ai-blueprint" element={<Guard user={user} path="/admin/ai-blueprint"><AdminAiBlueprint /></Guard>} />
          <Route path="admin/permissions" element={<Guard user={user} path="/admin/permissions"><AdminPermissionsPage /></Guard>} />
          <Route path="admin/security" element={<Guard user={user} path="/admin/security"><AdminSecurityPage /></Guard>} />
          <Route path="admin/backup" element={<Guard user={user} path="/admin/backup"><AdminBackupPage /></Guard>} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
