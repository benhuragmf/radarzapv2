import { useState, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { getSelectedGuild, setSelectedGuild, type Guild } from '../../lib/guild'
import { can, type AuthUser } from '../../lib/auth'
import { ChevronDown, Server, ExternalLink } from 'lucide-react'
import { Spinner } from '../ui/Spinner'

interface Props {
  user: AuthUser
  selected: Guild | null
  onChange: (guild: Guild | null) => void
}

function userHasDiscordMode(user: AuthUser): boolean {
  if (user.isInternalStaff) return true
  return user.guilds.some(g => g.role === 'OWNER' || g.role === 'ADMIN')
}

export default function DiscordGuildPicker({ user, selected, onChange }: Props) {
  const show = can(user, 'discord:server:view') || userHasDiscordMode(user)
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  const { data: guilds = [], isLoading } = useQuery<Guild[]>({
    queryKey: ['discord-guilds'],
    queryFn: () => api.get('/discord/guilds'),
    enabled: show,
  })

  useEffect(() => {
    if (!show || isLoading) return
    const stored = getSelectedGuild()
    if (!stored) return
    const fresh = guilds.find(g => g.id === stored.id)
    if (fresh) {
      onChange(fresh)
      setSelectedGuild(fresh)
    } else {
      setSelectedGuild(null)
      onChange(null)
    }
  }, [guilds, isLoading, show, onChange])

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  if (!show) return null

  const select = (g: Guild) => {
    setSelectedGuild(g)
    onChange(g)
    setOpen(false)
  }

  const clear = () => {
    setSelectedGuild(null)
    onChange(null)
    setOpen(false)
  }

  return (
    <div className="px-3 pb-2" ref={ref}>
      <p className="text-[10px] text-[var(--rz-text-muted)] uppercase tracking-wider font-semibold mb-1.5 px-0.5">
        Servidor
      </p>
      <div className="relative">
        <button
          type="button"
          onClick={() => setOpen(v => !v)}
          className="w-full flex items-center gap-2 bg-[var(--rz-surface-muted)] hover:bg-[var(--rz-surface-muted)]/80 border border-[var(--rz-border)] rounded-lg px-3 py-2 text-sm transition-colors"
        >
          {selected ? (
            <>
              {selected.icon ? (
                <img src={selected.icon} alt="" className="w-5 h-5 rounded-full shrink-0" />
              ) : (
                <Server size={14} className="text-[var(--rz-text-muted)] shrink-0" />
              )}
              <span className="font-medium truncate flex-1 text-left">{selected.name}</span>
            </>
          ) : (
            <>
              <Server size={14} className="text-[var(--rz-text-muted)] shrink-0" />
              <span className="text-[var(--rz-text-muted)] flex-1 text-left">Selecionar servidor</span>
            </>
          )}
          <ChevronDown
            size={13}
            className={`text-[var(--rz-text-muted)] shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
          />
        </button>

        {open && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--rz-surface-muted)] border border-[var(--rz-border)] rounded-xl shadow-xl z-50 overflow-hidden">
            <div className="max-h-56 overflow-y-auto">
              {isLoading && (
                <div className="flex justify-center py-4">
                  <Spinner size={20} />
                </div>
              )}
              {!isLoading && guilds.length === 0 && (
                <p className="text-xs text-[var(--rz-text-muted)] px-3 py-4 text-center">
                  Nenhum servidor com o bot. Convide o Radar Chat ao Discord.
                </p>
              )}
              {guilds.map(g => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => select(g)}
                  className={`w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-[var(--rz-surface-muted)]/80 transition-colors text-left ${
                    selected?.id === g.id ? 'bg-brand-600/20 border-l-2 border-brand-500' : ''
                  }`}
                >
                  {g.icon ? (
                    <img src={g.icon} alt={g.name} className="w-7 h-7 rounded-full shrink-0" />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-[var(--rz-surface-muted)] flex items-center justify-center text-xs font-bold text-[var(--rz-text-muted)] shrink-0">
                      {g.name[0]}
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{g.name}</p>
                    <p className="text-[10px] text-[var(--rz-text-muted)] font-mono truncate">{g.id}</p>
                  </div>
                </button>
              ))}
            </div>
            {selected && (
              <div className="p-2 border-t border-[var(--rz-border)]">
                <button
                  type="button"
                  onClick={clear}
                  className="w-full text-xs text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)] py-1.5"
                >
                  Limpar seleção
                </button>
              </div>
            )}
            <div className="p-2 border-t border-[var(--rz-border)]">
              <a
                href={`https://discord.com/oauth2/authorize?client_id=${import.meta.env.VITE_DISCORD_CLIENT_ID || ''}&permissions=8&scope=bot`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 px-2 py-1.5 text-xs text-brand-400 hover:text-brand-300 transition-colors"
              >
                <ExternalLink size={12} />
                Convidar bot
              </a>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
