import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Smartphone, Hash, Users, BookOpen,
  FileText, ListOrdered, ScrollText, Send, Zap, Crown,
} from 'lucide-react'

const nav = [
  { to: '/dashboard',    icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/sessions',     icon: Smartphone,      label: 'Sessões' },
  { to: '/channels',     icon: Hash,            label: 'Canais Discord' },
  { to: '/destinations', icon: Users,           label: 'Destinos' },
  { to: '/rules',        icon: BookOpen,        label: 'Regras' },
  { to: '/templates',    icon: FileText,        label: 'Templates' },
  { to: '/queue',        icon: ListOrdered,     label: 'Fila' },
  { to: '/logs',         icon: ScrollText,      label: 'Logs' },
  { to: '/test-send',    icon: Send,            label: 'Teste de Envio' },
  { to: '/plans',        icon: Crown,           label: 'Planos' },
]

export default function Sidebar() {
  return (
    <aside className="w-56 bg-gray-900 border-r border-gray-800 flex flex-col">
      {/* Logo */}
      <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-800">
        <Zap className="text-brand-500" size={22} />
        <span className="font-bold text-lg tracking-tight">RadarZap</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
        {nav.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-brand-600 text-white font-medium'
                  : 'text-gray-400 hover:text-white hover:bg-gray-800'
              }`
            }
          >
            <Icon size={16} />
            {label}
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 border-t border-gray-800 text-xs text-gray-600">
        v1.0 · RadarZap
      </div>
    </aside>
  )
}
