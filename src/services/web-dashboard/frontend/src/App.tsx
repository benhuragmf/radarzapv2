import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import Sessions from './pages/Sessions'
import Rules from './pages/Rules'
import Templates from './pages/Templates'
import Queue from './pages/Queue'
import Logs from './pages/Logs'
import TestSend from './pages/TestSend'
import Destinations from './pages/Destinations'
import Channels from './pages/Channels'
import Plans from './pages/Plans'
import Login from './pages/Login'
import { getMe, type AuthUser } from './lib/auth'
import { Spinner } from './components/ui/Spinner'

export const AuthContext = { user: null as AuthUser | null }

export default function App() {
  const [user, setUser]       = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const urlError = new URLSearchParams(window.location.search).get('error') ?? undefined

  useEffect(() => {
    getMe().then(u => { setUser(u); setLoading(false) })
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

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout user={user} onLogout={() => setUser(null)} />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"    element={<Dashboard />} />
          <Route path="sessions"     element={<Sessions />} />
          <Route path="channels"     element={<Channels />} />
          <Route path="destinations" element={<Destinations />} />
          <Route path="rules"        element={<Rules />} />
          <Route path="templates"    element={<Templates />} />
          <Route path="queue"        element={<Queue />} />
          <Route path="logs"         element={<Logs />} />
          <Route path="test-send"    element={<TestSend />} />
          <Route path="plans"        element={<Plans />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
