import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getSelectedGuild, setSelectedGuild, type Guild } from '../../lib/guild'
import { ChevronDown, Server, ExternalLink } from 'lucide-react'
import { Spinner } from '../ui/Spinner'

interface Props {
  onGuildChange: (guild: Guild | null) => void
}

export default function GuildBar({ onGuildChange }: Props) {
  const [open, setOpen] = useState(false)
  const [selected, setSelected] = useState<Guild | null>(getSelectedGuild)
  const ref = useRef<HTMLDivElement>(null)

  const { data: guilds = [], isLoading } = useQuery<Guild[]>({
    queryKey: ['discord-guilds'],
    queryFn: () => api.get('/discord/guilds'),
  })

  // Auto-select first guild if none selected
  useEffect(() => {
    if (!selected && guilds.length > 0) {
      const first = guilds[0]
      setSelected(first)
      setSelectedGuild(first)
      onGuildChange(first)
    }
  }, [guilds])

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const select = (g: Guild) => {
    setSelected(g)
    setSelectedGuild(g)
    onGuildChange(g)
    setOpen(false)
  }

  return (
    <div className="bg-gray-900 border-b border-gray-800 px-6 py-2 flex items-center gap-4">
      <span className="text-xs text-gray-500 uppercase tracking-wide font-medium shrink-0">Servidor</span>

      {/* Guild selector */}
      <div className="relative" ref={ref}>
        <button
          onClick={() => setOpen(v => !v)}
          className="flex items-center gap-2 bg-gray-800 hover:bg-gray-700 border border-gray-700 rounded-lg px-3 py-1.5 text-sm transition-colors"
        >
          {selected ? (
            <>
              {selected.icon
                ? <img src={selected.icon} alt="" className="w-5 h-5 rounded-full" />
                : <Server size={14} className="text-gray-400" />
              }
              <span className="font-medium max-w-[180px] truncate">{selected.name}</span>
              <span className="text-gray-500 text-xs font-mono hidden sm:block">· {selected.id}</span>
            </>
          ) : (
            <>
              <Server size={14} className="text-gray-400" />
              <span className="text-gray-400">Selecionar servidor</span>
            </>
          )}
          <ChevronDown size={13} className={`text-gray-500 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-72 bg-gray-800 border border-gray-700 rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="p-2 border-b border-gray-700">
              <p className="text-xs text-gray-500 px-2">Servidores disponíveis</p>
            </div>
            <div className="max-h-64 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-4"><Spinner size={20} /></div>
              )}
              {guilds.map(g => (
                <button
                  key={g.id}
                  onClick={() => select(g)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-gray-700 transition-colors text-left ${
                    selected?.id === g.id ? 'bg-brand-600/20 border-l-2 border-brand-500' : ''
                  }`}
                >
                  {g.icon
                    ? <img src={g.icon} alt={g.name} className="w-8 h-8 rounded-full shrink-0" />
                    : <div className="w-8 h-8 rounded-full bg-gray-700 flex items-center justify-center text-sm font-bold text-gray-400 shrink-0">
                        {g.name[0]}
                      </div>
                  }
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <p className="text-xs text-gray-500 font-mono">{g.id}</p>
                  </div>
                  {selected?.id === g.id && (
                    <div className="w-2 h-2 rounded-full bg-brand-500 shrink-0" />
                  )}
                </button>
              ))}
            </div>
            <div className="p-2 border-t border-gray-700">
              <a
                href={`https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || ''}&permissions=8&scope=bot`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-3 py-2 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <ExternalLink size={12} />
                Convidar bot para outro servidor
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Selected guild ID badge */}
      {selected && (
        <span className="text-xs text-gray-600 font-mono hidden md:block">
          ID: {selected.id}
        </span>
      )}
    </div>
  )
}
