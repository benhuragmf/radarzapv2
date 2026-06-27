import { useEffect, useState } from 'react'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useLocation, useNavigate } from 'react-router-dom'
import { CheckCircle2, Mail } from 'lucide-react'
import type { AuthUser } from '../../lib/auth'
import { getMe, linkDiscordAccount, linkGoogleAccount, unlinkGoogleAccount } from '../../lib/auth'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { inputCls } from '@/design-system'

interface Props {
  user: AuthUser
  onUserUpdate?: (user: AuthUser) => void
}

const LINKED_LABEL: Record<string, string> = {
  google: 'Google vinculado com sucesso.',
  discord: 'Discord vinculado com sucesso.',
}

function GoogleMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5" aria-hidden>
      <path
        fill="#EA4335"
        d="M12 10.2v3.6h5.1c-.2 1.2-1.6 3.6-5.1 3.6-3.1 0-5.6-2.5-5.6-5.6S8.9 6.2 12 6.2c1.8 0 3 .8 3.7 1.4l2.5-2.4C16.5 3.7 14.4 2.8 12 2.8 6.9 2.8 2.8 6.9 2.8 12s4.1 9.2 9.2 9.2c5.3 0 8.8-3.7 8.8-9 0-.6-.1-1.1-.2-1.6H12z"
      />
    </svg>
  )
}

function DiscordMark() {
  return (
    <svg viewBox="0 0 24 24" className="w-5 h-5 text-[var(--rz-oauth-discord)]" fill="currentColor" aria-hidden>
      <path d="M20.3 4.4A17.2 17.2 0 0 0 15.5 3a12.1 12.1 0 0 0-.6 1.2 15.9 15.9 0 0 0-4.8 0A11.6 11.6 0 0 0 9.5 3 17.1 17.1 0 0 0 4.7 4.4 17.9 17.9 0 0 0 .7 15.1a17.3 17.3 0 0 0 5.3 2.7 12.8 12.8 0 0 0 1.1-1.8 11.2 11.2 0 0 1-1.7-.8l.4-.3a12.4 12.4 0 0 0 10.6 0l.4.3a11 11 0 0 1-1.7.8c.3.7.7 1.3 1.1 1.8a17.2 17.2 0 0 0 5.3-2.7A17.8 17.8 0 0 0 20.3 4.4ZM8.7 13.1c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Zm6.6 0c-1.1 0-2-.9-2-2s.9-2 2-2 2 .9 2 2-.9 2-2 2Z" />
    </svg>
  )
}

export default function AccountConnectionsPanel({ user, onUserUpdate }: Props) {
  const qc = useQueryClient()
  const navigate = useNavigate()
  const { search } = useLocation()
  const [manualEmail, setManualEmail] = useState('')
  const [banner, setBanner] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)

  const google = user.connections?.google ?? { linked: Boolean(user.email), email: user.email }
  const discord = user.connections?.discord ?? {
    linked: Boolean(user.discordId),
    username: user.discordId ? user.username : null,
  }

  useEffect(() => {
    const params = new URLSearchParams(search)
    const linked = params.get('linked')
    const error = params.get('error')
    if (linked && LINKED_LABEL[linked]) {
      setBanner({ type: 'ok', text: LINKED_LABEL[linked] })
      qc.invalidateQueries({ queryKey: ['auth-me'] })
      navigate('/settings#conta', { replace: true })
    } else if (error) {
      setBanner({ type: 'err', text: decodeURIComponent(error) })
      navigate('/settings#conta', { replace: true })
    }
  }, [search, navigate, qc])

  const saveManualEmail = useMutation({
    mutationFn: () =>
      fetch('/auth/account/email', {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: manualEmail }),
      }).then(async res => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          throw new Error((data as { error?: string }).error ?? 'Falha ao salvar e-mail')
        }
        return res.json() as Promise<{ email: string }>
      }),
    onSuccess: async () => {
      setManualEmail('')
      setBanner({ type: 'ok', text: 'E-mail salvo na sua conta.' })
      await qc.invalidateQueries({ queryKey: ['auth-me'] })
      await qc.invalidateQueries({ queryKey: ['team-members'] })
      const updated = await getMe()
      if (updated && onUserUpdate) onUserUpdate(updated)
    },
    onError: (err: Error) => setBanner({ type: 'err', text: err.message }),
  })

  const unlinkGoogle = useMutation({
    mutationFn: unlinkGoogleAccount,
    onSuccess: async updated => {
      setBanner({
        type: 'ok',
        text: 'Google desvinculado. Você ainda pode entrar com Discord.',
      })
      await qc.invalidateQueries({ queryKey: ['auth-me'] })
      await qc.invalidateQueries({ queryKey: ['member-profile'] })
      if (onUserUpdate) onUserUpdate(updated)
    },
    onError: (err: Error) => setBanner({ type: 'err', text: err.message }),
  })

  const handleUnlinkGoogle = () => {
    if (
      !window.confirm(
        'Remover o vínculo com Google? Você continuará entrando com Discord. O e-mail cadastrado permanece na conta.',
      )
    ) {
      return
    }
    unlinkGoogle.mutate()
  }

  const canUnlinkGoogle = google.linked && discord.linked

  return (
    <div className="space-y-4">
      <p className="text-sm text-[var(--rz-text-secondary)] leading-relaxed">
        Vincule Google e Discord à mesma conta RadarZap. Assim você entra por qualquer um e sua equipe vê seu
        e-mail corretamente.
      </p>

      {banner && (
        <div
          className={`px-4 py-2 rounded-lg text-sm border ${
            banner.type === 'ok'
              ? 'bg-brand-600/10 border-brand-700/40 text-brand-300'
              : 'bg-red-900/30 border-red-800 text-red-400'
          }`}
        >
          {banner.text}
        </div>
      )}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--rz-surface)] flex items-center justify-center shrink-0">
              <GoogleMark />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">Google / Gmail</p>
              {google.linked && google.email ? (
                <p className="text-xs text-brand-400 flex items-center gap-1 truncate">
                  <CheckCircle2 size={12} /> Vinculado · {google.email}
                </p>
              ) : user.email ? (
                <p className="text-xs text-amber-400/90 truncate">
                  E-mail cadastrado · {user.email} — vincule Google para entrar com Gmail
                </p>
              ) : (
                <p className="text-xs text-[var(--rz-text-muted)]">Não vinculado</p>
              )}
            </div>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {!google.linked ? (
              <Button type="button" variant="secondary" onClick={linkGoogleAccount}>
                Vincular Google
              </Button>
            ) : canUnlinkGoogle ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={unlinkGoogle.isPending}
                onClick={handleUnlinkGoogle}
              >
                {unlinkGoogle.isPending ? <Spinner size={12} /> : null}
                Desvincular
              </Button>
            ) : (
              <p className="text-[10px] text-[var(--rz-text-muted)] text-right max-w-[140px] leading-snug">
                Vincule o Discord para poder remover o Google
              </p>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between gap-4 p-4 rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface-muted)]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[var(--rz-surface)] flex items-center justify-center shrink-0">
              <DiscordMark />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">Discord</p>
              {discord.linked && discord.username ? (
                <p className="text-xs text-brand-400 flex items-center gap-1 truncate">
                  <CheckCircle2 size={12} /> Vinculado · {discord.username}
                </p>
              ) : (
                <p className="text-xs text-[var(--rz-text-muted)]">Não vinculado</p>
              )}
            </div>
          </div>
          {!discord.linked && (
            <Button type="button" variant="secondary" onClick={linkDiscordAccount}>
              Vincular Discord
            </Button>
          )}
        </div>
      </div>

      {!google.linked && (
        <div className="pt-2 border-t border-[var(--rz-border)]">
          <p className="text-xs text-[var(--rz-text-muted)] mb-2">
            Ou informe seu e-mail manualmente (recomendado vincular pelo Google acima):
          </p>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="email"
              value={manualEmail}
              onChange={e => setManualEmail(e.target.value)}
              placeholder="seu@gmail.com"
              className={inputCls}
            />
            <Button
              disabled={!manualEmail.trim() || saveManualEmail.isPending}
              onClick={() => saveManualEmail.mutate()}
            >
              {saveManualEmail.isPending ? <Spinner size={12} /> : <Mail size={12} />} Salvar e-mail
            </Button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 pt-2 text-sm">
        <div>
          <p className="text-xs text-[var(--rz-text-muted)]">Papel no painel</p>
          <p className="text-[var(--rz-text-secondary)]">{user.primaryRole}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--rz-text-muted)]">Plano</p>
          <p className="text-[var(--rz-text-secondary)] capitalize">{user.plan}</p>
        </div>
      </div>
    </div>
  )
}
