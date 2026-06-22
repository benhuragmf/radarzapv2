import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { notifyError, notifySuccess } from '../../lib/notify'
import type { AuthUser } from '../../lib/auth'
import { inputCls } from '@/design-system'

interface MemberProfile {
  email: string | null
  emailMasked?: string
  displayName: string | null
  companyRole: string
  whatsappPhone?: string
  whatsappPhoneMasked?: string
  whatsappPhoneVerified: boolean
  emailVerified: boolean
  emailAutoVerifiedByGoogle: boolean
  allowSelfEdit: boolean
  canEditProfile: boolean
  profileComplete: boolean
  pendingConfirmations: Array<'email' | 'whatsapp'>
}

const ROLE_LABEL: Record<string, string> = {
  OWNER: 'Dono',
  ADMIN: 'Administrador',
  MANAGER: 'Gestor',
  ATTENDANT: 'Atendente',
  INTEGRATION: 'Integração',
  CUSTOM: 'Papel customizado',
}

export function MyProfilePanel({ user }: { user: AuthUser }) {
  const qc = useQueryClient()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [emailCode, setEmailCode] = useState('')
  const [waCode, setWaCode] = useState('')
  const [emailStep, setEmailStep] = useState<'idle' | 'code'>('idle')
  const [waStep, setWaStep] = useState<'idle' | 'code'>('idle')

  const { data: profile, isLoading } = useQuery({
    queryKey: ['member-profile'],
    queryFn: () => api.get<MemberProfile>('/auth/me/member-profile'),
  })

  useEffect(() => {
    if (!profile) return
    setDisplayName(profile.displayName ?? user.username ?? '')
    setEmail(profile.email ?? user.email ?? '')
    if (!profile.canEditProfile && profile.whatsappPhone) {
      setPhone(profile.whatsappPhone)
    }
  }, [profile, user.username, user.email])

  const invalidate = () => void qc.invalidateQueries({ queryKey: ['member-profile'] })

  const saveDisplayName = useMutation({
    mutationFn: () => api.patch<MemberProfile>('/auth/me/member-profile', { displayName }),
    onSuccess: () => {
      notifySuccess('Nome atualizado.')
      invalidate()
    },
    onError: (e: Error) => notifyError(e.message),
  })

  const requestEmailCode = useMutation({
    mutationFn: () =>
      api.post<{ maskedEmail: string }>('/auth/me/email/request-code', {
        email: profile?.canEditProfile ? email : undefined,
      }),
    onSuccess: () => {
      setEmailStep('code')
      notifySuccess('Código enviado por e-mail.')
    },
    onError: (e: Error) => notifyError(e.message),
  })

  const confirmEmailCode = useMutation({
    mutationFn: () =>
      api.post<MemberProfile>('/auth/me/email/confirm', { email, code: emailCode }),
    onSuccess: () => {
      setEmailStep('idle')
      setEmailCode('')
      notifySuccess('E-mail confirmado.')
      invalidate()
    },
    onError: (e: Error) => notifyError(e.message),
  })

  const requestWaCode = useMutation({
    mutationFn: () =>
      api.post<{ maskedPhone: string }>('/auth/me/whatsapp/request-code', { phone }),
    onSuccess: () => {
      setWaStep('code')
      notifySuccess('Código enviado no WhatsApp.')
    },
    onError: (e: Error) => notifyError(e.message),
  })

  const confirmWaCode = useMutation({
    mutationFn: () =>
      api.post<MemberProfile>('/auth/me/whatsapp/confirm', { phone, code: waCode }),
    onSuccess: () => {
      setWaStep('idle')
      setWaCode('')
      notifySuccess('WhatsApp verificado.')
      invalidate()
    },
    onError: (e: Error) => notifyError(e.message),
  })

  if (isLoading) {
    return <p className="text-sm text-[var(--rz-text-muted)]">Carregando perfil…</p>
  }

  const p = profile
  const roleLabel = ROLE_LABEL[p?.companyRole ?? user.companyRole ?? ''] ?? p?.companyRole ?? '—'
  const canEdit = p?.canEditProfile ?? false
  const needsEmail = p?.pendingConfirmations.includes('email')
  const needsWa = p?.pendingConfirmations.includes('whatsapp')

  return (
    <div className="space-y-5">
      {!p?.profileComplete && (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          <p className="font-medium">Confirme seus dados para usar o atendimento</p>
          <p className="text-xs mt-1 text-amber-200/90">
            {needsEmail && needsWa && 'Confirme e-mail e WhatsApp abaixo.'}
            {needsEmail && !needsWa && 'Confirme seu e-mail abaixo.'}
            {!needsEmail && needsWa && 'Confirme seu WhatsApp abaixo.'}
            {!canEdit && ' Sua empresa cadastrou os dados — você só precisa confirmar com o código.'}
          </p>
        </div>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <p className="text-xs text-[var(--rz-text-muted)] mb-1">Papel na empresa</p>
          <p className="text-sm text-[var(--rz-text-primary)]">{roleLabel}</p>
        </div>
        <div>
          <p className="text-xs text-[var(--rz-text-muted)] mb-1">Edição pelo atendente</p>
          <p className="text-sm text-[var(--rz-text-primary)]">
            {canEdit ? 'Permitida pela empresa' : 'Bloqueada — só confirmação'}
          </p>
        </div>
      </div>

      <div className="border-t border-[var(--rz-border)] pt-4 space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">Nome</p>
        {canEdit ? (
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className={`flex-1 ${inputCls}`}
              maxLength={120}
            />
            <Button
              size="sm"
              onClick={() => saveDisplayName.mutate()}
              disabled={saveDisplayName.isPending}
            >
              Salvar nome
            </Button>
          </div>
        ) : (
          <p className="text-sm text-[var(--rz-text-primary)]">{p?.displayName ?? user.username}</p>
        )}
      </div>

      <div className="border-t border-[var(--rz-border)] pt-4 space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">E-mail</p>
        {p?.emailAutoVerifiedByGoogle ? (
          <p className="text-sm text-green-400">
            Confirmado pelo login Google · {p.emailMasked ?? p.email}
          </p>
        ) : p?.emailVerified ? (
          <p className="text-sm text-green-400">Verificado · {p.emailMasked ?? p.email}</p>
        ) : (
          <p className="text-sm text-amber-400">Pendente confirmação</p>
        )}

        {!p?.emailAutoVerifiedByGoogle && (
          <>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Enviamos um código de segurança para o e-mail cadastrado.{' '}
              {canEdit ? 'Você pode alterar o e-mail antes de confirmar.' : 'Confirme o e-mail definido pela empresa.'}
            </p>
            {emailStep === 'idle' ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  readOnly={!canEdit}
                  className={`flex-1 ${inputCls} ${!canEdit ? 'opacity-80' : ''}`}
                />
                <Button
                  size="sm"
                  onClick={() => requestEmailCode.mutate()}
                  disabled={!email.trim() || requestEmailCode.isPending}
                >
                  {requestEmailCode.isPending ? 'Enviando…' : 'Enviar código'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={emailCode}
                  onChange={e => setEmailCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código de 6 dígitos"
                  className={`flex-1 ${inputCls}`}
                />
                <Button
                  size="sm"
                  onClick={() => confirmEmailCode.mutate()}
                  disabled={emailCode.length < 6 || confirmEmailCode.isPending}
                >
                  Confirmar e-mail
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setEmailStep('idle')}>
                  Voltar
                </Button>
              </div>
            )}
          </>
        )}
      </div>

      <div className="border-t border-[var(--rz-border)] pt-4 space-y-3">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">WhatsApp pessoal</p>
        {p?.whatsappPhoneVerified ? (
          <p className="text-sm text-green-400">
            Verificado · {p.whatsappPhoneMasked ?? p.whatsappPhone}
          </p>
        ) : p?.whatsappPhone ? (
          <p className="text-sm text-amber-400">
            Cadastrado · {p.whatsappPhoneMasked ?? '***'} — confirme abaixo
          </p>
        ) : (
          <p className="text-sm text-[var(--rz-text-muted)]">
            {canEdit ? 'Não cadastrado' : 'Aguardando cadastro pela empresa'}
          </p>
        )}

        {(canEdit || p?.whatsappPhone) && !p?.whatsappPhoneVerified && (
          <>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Código enviado no WhatsApp do número informado (
              <code className="text-[var(--rz-text-secondary)]">!assumir</code>, bridge, alertas).
            </p>
            {waStep === 'idle' ? (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  readOnly={!canEdit && Boolean(p?.whatsappPhone)}
                  placeholder="5511999999999"
                  className={`flex-1 ${inputCls} ${!canEdit && p?.whatsappPhone ? 'opacity-80' : ''}`}
                />
                <Button
                  size="sm"
                  onClick={() => requestWaCode.mutate()}
                  disabled={!phone.trim() || requestWaCode.isPending}
                >
                  {requestWaCode.isPending ? 'Enviando…' : 'Enviar código'}
                </Button>
              </div>
            ) : (
              <div className="flex flex-col sm:flex-row gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={waCode}
                  onChange={e => setWaCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código de 6 dígitos"
                  className={`flex-1 ${inputCls}`}
                />
                <Button
                  size="sm"
                  onClick={() => confirmWaCode.mutate()}
                  disabled={waCode.length < 6 || confirmWaCode.isPending}
                >
                  Confirmar WhatsApp
                </Button>
                <Button size="sm" variant="secondary" onClick={() => setWaStep('idle')}>
                  Voltar
                </Button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
