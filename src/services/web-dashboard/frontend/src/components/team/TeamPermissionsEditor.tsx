import { useState, useEffect, useMemo } from 'react'
import { ChevronDown, RotateCcw, Save, Search, Shield, X } from 'lucide-react'
import type { CompanyRole } from '../../lib/auth'
import { api } from '../../lib/api'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import { inputCls, selectCls, searchFieldIconCls } from '@/design-system'

export interface PermissionGroup {
  id: string
  label: string
  description: string
  capabilities: string[]
}

export interface RolePreset {
  role: string
  label: string
  description: string
  inviteable: boolean
  capabilities: string[]
  customized?: boolean
  isCustom?: boolean
  customRoleId?: string
}

const CAP_LABELS: Record<string, string> = {
  'dashboard:view': 'Visão geral',
  'platform:reports:view': 'Página de relatórios',
  'platform:audit:view': 'Página de auditoria',
  'account:settings': 'Configurações da empresa',
  'billing:view': 'Plano e faturamento',
  'company:members:manage': 'Convidar e gerenciar equipe',
  'company:members:remove': 'Remover funcionário',
  'send:test': 'Enviar / campanhas / histórico',
  'send:templates:manage': 'Modelos de mensagem',
  'send:schedule:manage': 'Agendamentos',
  'send:rules:manage': 'Regras automáticas / gatilhos',
  'consent:view': 'Listas e relatório de consentimento',
  'consent:request-renewal': 'Solicitar novo aceite',
  'consent:approve-renewal': 'Aprovar solicitações de aceite',
  'consent:clear-refusal': 'Limpar recusa de contato',
  'consent:manual-block': 'Bloquear contato manualmente',
  'send:destination:manage': 'Segmentos, grupos e importar',
  'send:destination:view': 'Ver destinos',
  'whatsapp:session:view': 'Sessões e QR Code',
  'whatsapp:session:manage': 'Gerenciar conexões WA',
  'inbox:view': 'Caixa de Entrada',
  'inbox:reply': 'Responder conversas',
  'inbox:transfer': 'Transferir conversas',
  'inbox:department:manage': 'Setores e triagem',
  'inbox:reports:view': 'Métricas de atendimento',
  'inbox:supervise': 'Supervisão',
  'inbox:ai:manage': 'Configurar IA de atendimento',
  'inbox:ai:balance:view': 'Ver saldo IA/LM na barra',
  'queue:view': 'Fila nos relatórios',
  'queue:retry': 'Reprocessar fila',
  'logs:view': 'Logs operacionais',
  'api:key:create': 'Chaves e webhooks API',
  'api:key:revoke': 'Revogar chaves',
  'api:logs:view': 'Documentação API',
  'discord:server:view': 'Ver servidor Discord',
  'discord:server:manage': 'Gerenciar servidor',
  'discord:channels:manage': 'Canais monitorados',
  'discord:webhooks:manage': 'Webhooks',
  'discord:members:manage': 'Membros do servidor',
}

function Toggle({ on, disabled, onClick }: { on: boolean; disabled?: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={onClick}
      className={`relative shrink-0 h-5 w-9 rounded-full transition-colors ${
        disabled ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'
      } ${on ? 'bg-brand-500' : 'bg-[var(--rz-surface-muted)]'}`}
    >
      <span
        className={`pointer-events-none absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform duration-200 ease-in-out ${
          on ? 'translate-x-4' : 'translate-x-0'
        }`}
      />
    </button>
  )
}

function permLabel(cap: string) {
  return CAP_LABELS[cap] ?? cap
}

function matchesSearch(group: PermissionGroup, cap: string, q: string) {
  if (!q) return true
  const term = q.toLowerCase()
  return (
    group.label.toLowerCase().includes(term) ||
    group.description.toLowerCase().includes(term) ||
    permLabel(cap).toLowerCase().includes(term) ||
    cap.toLowerCase().includes(term)
  )
}

function formatPermCount(n: number) {
  return n === 1 ? '1 permissão' : `${n} permissões`
}

function groupStats(group: PermissionGroup, selectedSet: Set<string>) {
  const active = group.capabilities.filter(c => selectedSet.has(c)).length
  const total = group.capabilities.length
  return { active, total, allOn: total > 0 && active === total, none: active === 0 }
}

interface AccordionProps {
  selected: string[]
  onChange: (caps: string[]) => void
  permissionGroups: PermissionGroup[]
  disabled?: boolean
  searchQuery: string
  expandAllToken: number
  collapseAllToken: number
}

function RolePermissionsAccordion({
  selected,
  onChange,
  permissionGroups,
  disabled,
  searchQuery,
  expandAllToken,
  collapseAllToken,
}: AccordionProps) {
  const selectedSet = useMemo(() => new Set(selected), [selected])
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())

  const filteredGroups = useMemo(() => {
    const q = searchQuery.trim()
    if (!q) return permissionGroups
    return permissionGroups
      .map(group => ({
        ...group,
        capabilities: group.capabilities.filter(cap => matchesSearch(group, cap, q)),
      }))
      .filter(g => g.capabilities.length > 0)
  }, [permissionGroups, searchQuery])

  useEffect(() => {
    const sel = new Set(selected)
    const firstPartial = filteredGroups.find(g => {
      const { active, total } = groupStats(g, sel)
      return active > 0 && active < total
    })
    const first = firstPartial ?? filteredGroups[0]
    if (first) setExpanded(new Set([first.id]))
  }, [filteredGroups])

  useEffect(() => {
    if (expandAllToken > 0) {
      setExpanded(new Set(filteredGroups.map(g => g.id)))
    }
  }, [expandAllToken, filteredGroups])

  useEffect(() => {
    if (collapseAllToken > 0) setExpanded(new Set())
  }, [collapseAllToken])

  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) return
    setExpanded(new Set(filteredGroups.map(g => g.id)))
  }, [searchQuery, filteredGroups])

  const toggleCap = (cap: string) => {
    if (disabled) return
    const next = new Set(selectedSet)
    if (next.has(cap)) next.delete(cap)
    else next.add(cap)
    onChange([...next])
  }

  const toggleGroup = (group: PermissionGroup, enable: boolean) => {
    if (disabled) return
    const next = new Set(selectedSet)
    for (const c of group.capabilities) {
      if (enable) next.add(c)
      else next.delete(c)
    }
    onChange([...next])
  }

  const toggleExpand = (id: string) => {
    setExpanded(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  }

  if (!filteredGroups.length) {
    return (
      <p className="text-sm text-[var(--rz-text-secondary)] py-10 text-center">
        Nenhuma permissão encontrada para &quot;{searchQuery.trim()}&quot;.
      </p>
    )
  }

  return (
    <div className="divide-y divide-[var(--rz-border)]/80">
      {filteredGroups.map(group => {
        const { active, total, allOn } = groupStats(group, selectedSet)
        const isOpen = expanded.has(group.id)
        const pct = total > 0 ? Math.round((active / total) * 100) : 0

        return (
          <div key={group.id} className="bg-[var(--rz-surface-muted)]/20">
            <div className="flex items-center gap-3 px-4 py-3">
              <button
                type="button"
                onClick={() => toggleExpand(group.id)}
                className="flex-1 flex items-center gap-3 min-w-0 text-left group"
              >
                <ChevronDown
                  size={16}
                  className={`shrink-0 text-[var(--rz-text-muted)] transition-transform ${isOpen ? '' : '-rotate-90'}`}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-[var(--rz-text-primary)]">{group.label}</span>
                    <span
                      className={`text-[10px] tabular-nums px-1.5 py-0.5 rounded-full ${
                        allOn
                          ? 'bg-brand-500/15 text-brand-400'
                          : active > 0
                            ? 'bg-amber-500/10 text-amber-500/90'
                            : 'bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]'
                      }`}
                    >
                      {active}/{total}
                    </span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-[var(--rz-surface-muted)] overflow-hidden max-w-[200px]">
                    <div
                      className={`h-full rounded-full transition-all ${
                        allOn ? 'bg-brand-500' : active > 0 ? 'bg-amber-500/70' : 'bg-transparent'
                      }`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              </button>
              {!disabled && (
                <Toggle
                  on={allOn}
                  disabled={disabled}
                  onClick={() => toggleGroup(group, !allOn)}
                />
              )}
            </div>

            {isOpen && (
              <div className="px-4 pb-3 pt-0 ml-7 space-y-0.5">
                <p className="text-[11px] text-[var(--rz-text-muted)] mb-2">{group.description}</p>
                {group.capabilities.map(cap => {
                  const on = selectedSet.has(cap)
                  return (
                    <div
                      key={cap}
                      role="button"
                      tabIndex={disabled ? -1 : 0}
                      onClick={() => !disabled && toggleCap(cap)}
                      onKeyDown={e => {
                        if (!disabled && (e.key === 'Enter' || e.key === ' ')) {
                          e.preventDefault()
                          toggleCap(cap)
                        }
                      }}
                      className={`flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg transition-colors ${
                        on ? 'bg-brand-500/[0.07] border border-brand-500/20' : 'hover:bg-[var(--rz-surface-muted)] border border-transparent'
                      } ${disabled ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'}`}
                    >
                      <span className={`text-sm ${on ? 'text-[var(--rz-text-primary)]' : 'text-[var(--rz-text-secondary)]'}`}>
                        {permLabel(cap)}
                      </span>
                      <span onClick={e => e.stopPropagation()}>
                        <Toggle on={on} disabled={disabled} onClick={() => toggleCap(cap)} />
                      </span>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

interface MemberRoleModalProps {
  member: {
    _id: string
    displayEmail?: string
    email?: string
    displayName?: string
    companyRole: CompanyRole
    customRoleId?: string
    whatsappPhone?: string
    whatsappPhoneVerifiedAt?: string
    emailVerifiedAt?: string
  }
  presets: RolePreset[]
  isOwner: boolean
  onClose: () => void
  onSave: (roleKey: string) => Promise<void>
  onProfileUpdated?: () => void
  onWhatsappUpdated?: () => void
}

export function TeamMemberRoleModal({
  member,
  presets,
  isOwner,
  onClose,
  onSave,
  onProfileUpdated,
  onWhatsappUpdated,
}: MemberRoleModalProps) {
  const initialRoleKey = member.customRoleId
    ? `custom:${member.customRoleId}`
    : member.companyRole
  const [role, setRole] = useState(initialRoleKey)
  const [saving, setSaving] = useState(false)
  const [profileSaving, setProfileSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [displayName, setDisplayName] = useState(member.displayName ?? '')
  const [memberEmail, setMemberEmail] = useState(member.email ?? member.displayEmail ?? '')
  const [phone, setPhone] = useState(member.whatsappPhone ?? '')
  const [code, setCode] = useState('')
  const [waStep, setWaStep] = useState<'idle' | 'code'>('idle')
  const [waLoading, setWaLoading] = useState(false)
  const [waInfo, setWaInfo] = useState<string | null>(null)
  const [waVerifiedAt, setWaVerifiedAt] = useState(member.whatsappPhoneVerifiedAt)
  const [emailVerifiedAt, setEmailVerifiedAt] = useState(member.emailVerifiedAt)
  const preset = presets.find(p => p.role === role)
  const waVerified = Boolean(waVerifiedAt)
  const emailVerified = Boolean(emailVerifiedAt)

  useEffect(() => {
    setRole(member.customRoleId ? `custom:${member.customRoleId}` : member.companyRole)
    setDisplayName(member.displayName ?? '')
    setMemberEmail(member.email ?? member.displayEmail ?? '')
    setPhone(member.whatsappPhone ?? '')
    setWaVerifiedAt(member.whatsappPhoneVerifiedAt)
    setEmailVerifiedAt(member.emailVerifiedAt)
    setWaStep('idle')
    setCode('')
    setWaInfo(null)
    setError(null)
  }, [
    member._id,
    member.companyRole,
    member.customRoleId,
    member.displayName,
    member.email,
    member.displayEmail,
    member.whatsappPhone,
    member.whatsappPhoneVerifiedAt,
    member.emailVerifiedAt,
  ])

  const handleSave = async () => {
    setSaving(true)
    setError(null)
    try {
      await onSave(role)
      onClose()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const saveProfile = async () => {
    setProfileSaving(true)
    setError(null)
    try {
      const updated = await api.patch<{
        emailVerifiedAt?: string
        whatsappPhoneVerifiedAt?: string
      }>(`/team/members/${member._id}/profile`, {
        displayName: displayName.trim() || null,
        email: memberEmail.trim() || null,
        whatsappPhone: phone.trim() || null,
      })
      setEmailVerifiedAt(updated.emailVerifiedAt)
      setWaVerifiedAt(updated.whatsappPhoneVerifiedAt)
      setWaInfo('Dados salvos. O membro deve confirmar e-mail e WhatsApp no painel dele.')
      onProfileUpdated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setProfileSaving(false)
    }
  }

  const requestWaCode = async () => {
    setWaLoading(true)
    setWaInfo(null)
    setError(null)
    try {
      await api.post(`/team/members/${member._id}/whatsapp/request-code`, { phone: phone.trim() })
      setWaStep('code')
      setWaInfo(
        'Código enviado ao número informado. O titular deve informar o código aqui. O dono da empresa também recebe aviso de auditoria.',
      )
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWaLoading(false)
    }
  }

  const confirmWaCode = async () => {
    setWaLoading(true)
    setError(null)
    try {
      const updated = await api.post<{
        whatsappPhoneVerifiedAt?: string
      }>(`/team/members/${member._id}/whatsapp/confirm`, {
        phone: phone.trim(),
        code: code.trim(),
      })
      setWaVerifiedAt(updated.whatsappPhoneVerifiedAt)
      setWaStep('idle')
      setCode('')
      setWaInfo('WhatsApp verificado e salvo.')
      onWhatsappUpdated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWaLoading(false)
    }
  }

  const removeWa = async () => {
    if (!window.confirm('Remover WhatsApp verificado deste membro?')) return
    setWaLoading(true)
    setError(null)
    try {
      await api.delete(`/team/members/${member._id}/whatsapp`)
      setPhone('')
      setWaVerifiedAt(undefined)
      setWaInfo('WhatsApp removido.')
      onWhatsappUpdated?.()
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setWaLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md border border-[var(--rz-border)] bg-[var(--rz-surface)] rounded-2xl shadow-xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b border-[var(--rz-border)]">
          <h3 className="text-base font-semibold text-[var(--rz-text-primary)]">Editar membro</h3>
          <p className="text-sm text-[var(--rz-text-secondary)] mt-1">{member.displayEmail}</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="space-y-3 border-b border-[var(--rz-border)] pb-4">
            <p className="text-sm font-medium text-[var(--rz-text-primary)]">Dados do membro</p>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Nome</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className={inputCls}
                maxLength={120}
                disabled={profileSaving}
              />
            </div>
            <div>
              <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">E-mail</label>
              <input
                type="email"
                value={memberEmail}
                onChange={e => setMemberEmail(e.target.value)}
                className={inputCls}
                disabled={profileSaving}
              />
              {emailVerified ? (
                <p className="text-xs text-green-400 mt-1">E-mail confirmado pelo membro</p>
              ) : (
                <p className="text-xs text-amber-400 mt-1">Pendente — membro confirma em Meu perfil</p>
              )}
            </div>
            <Button
              type="button"
              size="sm"
              variant="secondary"
              onClick={saveProfile}
              disabled={profileSaving}
            >
              {profileSaving ? 'Salvando…' : 'Salvar dados'}
            </Button>
          </div>

          <div>
            <label className="text-xs text-[var(--rz-text-muted)] mb-1 block">Papel</label>
            <select
              value={role}
              onChange={e => setRole(e.currentTarget.value)}
              className={selectCls}
            >
              {presets
                .filter(p => p.inviteable)
                .filter(p => isOwner || p.role !== 'ADMIN')
                .map(p => (
                  <option key={p.role} value={p.role}>
                    {p.label}
                  </option>
                ))}
            </select>
            {preset && <p className="text-xs text-[var(--rz-text-muted)] mt-1.5">{preset.description}</p>}
          </div>

          <div className="border-t border-[var(--rz-border)] pt-4 space-y-2">
            <p className="text-sm font-medium text-[var(--rz-text-primary)]">WhatsApp pessoal</p>
            <p className="text-xs text-[var(--rz-text-muted)]">
              O número só é salvo após confirmação com código enviado ao próprio WhatsApp informado.
              O dono recebe aviso quando a empresa inicia o cadastro.
            </p>
            {waVerified ? (
              <p className="text-xs text-green-400">
                Verificado
                {phone.replace(/\D/g, '').length >= 4
                  ? ` · ***${phone.replace(/\D/g, '').slice(-4)}`
                  : ''}
              </p>
            ) : phone.trim() && member.whatsappPhone ? (
              <p className="text-xs text-amber-400">Pendente verificação</p>
            ) : null}

            {waStep === 'idle' ? (
              <div className="flex flex-col gap-2">
                <input
                  type="tel"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  placeholder="5511999999999"
                  className={inputCls}
                  disabled={waLoading}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={requestWaCode}
                    disabled={!phone.trim() || waLoading}
                  >
                    {waLoading ? 'Enviando…' : 'Enviar código'}
                  </Button>
                  {waVerified && (
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={removeWa}
                      disabled={waLoading}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={code}
                  onChange={e => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="Código de 6 dígitos"
                  className={inputCls}
                  disabled={waLoading}
                />
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    size="sm"
                    onClick={confirmWaCode}
                    disabled={code.length < 6 || waLoading}
                  >
                    {waLoading ? 'Confirmando…' : 'Confirmar número'}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant="secondary"
                    onClick={() => setWaStep('idle')}
                    disabled={waLoading}
                  >
                    Voltar
                  </Button>
                </div>
              </div>
            )}
            {waInfo && (
              <p className="text-xs text-[var(--rz-text-muted)] rounded-lg border border-[var(--rz-border)] px-3 py-2">
                {waInfo}
              </p>
            )}
          </div>

          {error && (
            <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-[var(--rz-border)] flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={14} /> : null}
            Salvar papel
          </Button>
        </div>
      </div>
    </div>
  )
}

interface RolesPanelProps {
  presets: RolePreset[]
  permissionGroups: PermissionGroup[]
  hasDiscordIntegration?: boolean
  canEdit: boolean
  selectedRole: string
  onSelectRole: (role: string) => void
  onSave: (role: string, capabilities: string[]) => Promise<void>
  onReset: (role: string) => Promise<void>
  onCreateCustomRole?: () => Promise<void>
}

export function RolesSystemPanel({
  presets,
  permissionGroups,
  hasDiscordIntegration,
  canEdit,
  selectedRole,
  onSelectRole,
  onSave,
  onReset,
  onCreateCustomRole,
}: RolesPanelProps) {
  const preset = presets.find(p => p.role === selectedRole) ?? presets[0]
  const [draftCaps, setDraftCaps] = useState<string[]>(preset?.capabilities ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandAllToken, setExpandAllToken] = useState(0)
  const [collapseAllToken, setCollapseAllToken] = useState(0)

  useEffect(() => {
    if (preset) {
      setDraftCaps(preset.capabilities)
      setSearchQuery('')
    }
  }, [preset?.role, preset?.capabilities])

  const dirty = useMemo(() => {
    if (!preset) return false
    const a = new Set(draftCaps)
    const b = new Set(preset.capabilities)
    if (a.size !== b.size) return true
    for (const c of a) if (!b.has(c)) return true
    return false
  }, [draftCaps, preset])

  const allAssignable = useMemo(
    () => [...new Set(permissionGroups.flatMap(g => g.capabilities))],
    [permissionGroups],
  )

  const totalActive = draftCaps.length
  const totalAvailable = allAssignable.length
  const progressPct = totalAvailable > 0 ? Math.round((totalActive / totalAvailable) * 100) : 0

  const handleSelectRole = (role: string) => {
    if (role === selectedRole) return
    if (dirty && !window.confirm('Descartar alterações não salvas neste papel?')) return
    onSelectRole(role)
  }

  const handleSave = async () => {
    if (!preset) return
    setSaving(true)
    setError(null)
    try {
      await onSave(preset.role, draftCaps)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!preset || (!preset.inviteable && !preset.isCustom)) return
    const msg = preset.isCustom
      ? `Excluir o papel "${preset.label}"? Membros usando este papel precisam ser reatribuídos antes.`
      : `Restaurar "${preset.label}" para o padrão do sistema?`
    if (!window.confirm(msg)) return
    setSaving(true)
    setError(null)
    try {
      await onReset(preset.role)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  if (!preset) return null

  return (
    <div className="rounded-xl border border-[var(--rz-border)] bg-[var(--rz-surface)]/50 overflow-hidden">
      {/* Seletor de papéis */}
      <div className="p-4 border-b border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40">
        <p className="text-[11px] uppercase tracking-wider text-[var(--rz-text-muted)] mb-2">Papel</p>
        <div className="grid grid-cols-[repeat(auto-fill,minmax(9.5rem,1fr))] gap-2">
          {presets.map(p => {
            const selected = p.role === selectedRole
            return (
              <button
                key={p.role}
                type="button"
                onClick={() => handleSelectRole(p.role)}
                className={`relative px-3 py-2.5 rounded-lg border text-left transition-all ${
                  selected
                    ? 'border-brand-500/50 bg-brand-500/10 ring-1 ring-brand-500/30'
                    : 'border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/60 hover:border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]'
                }`}
              >
                <span className={`block text-xs font-medium truncate ${selected ? 'text-[var(--rz-text-primary)]' : 'text-[var(--rz-text-secondary)]'}`} title={p.label}>
                  {p.label}
                </span>
                <span className="block text-[10px] text-[var(--rz-text-muted)] mt-0.5">
                  {formatPermCount(p.capabilities.length)}
                </span>
                {(p.customized || p.isCustom) && (
                  <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-amber-500" />
                )}
                {!p.inviteable && (
                  <Shield size={10} className="absolute top-1.5 right-1.5 text-[var(--rz-text-muted)]" />
                )}
              </button>
            )
          })}
          {canEdit && onCreateCustomRole && (
            <button
              type="button"
              onClick={() => void onCreateCustomRole()}
              className="px-3 py-2.5 rounded-lg border border-dashed border-[var(--rz-border)] text-[var(--rz-text-muted)] hover:border-brand-500/50 hover:text-brand-400 text-xs font-medium"
            >
              + Novo papel
            </button>
          )}
        </div>
      </div>

      {/* Cabeçalho do papel + ações */}
      <div className="px-4 py-4 border-b border-[var(--rz-border)]/80 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-base font-semibold text-[var(--rz-text-primary)]">{preset.label}</h3>
              {(preset.customized || preset.isCustom) && (
                <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-400 border border-amber-500/20">
                  {preset.isCustom ? 'personalizado' : 'ajustado'}
                </span>
              )}
            </div>
            <p className="text-sm text-[var(--rz-text-muted)] mt-1">{preset.description}</p>
          </div>

          {preset.inviteable && canEdit && (
            <div className="flex flex-wrap gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setDraftCaps(allAssignable)}
                className="text-xs px-3 py-1.5 rounded-lg bg-brand-500/10 text-brand-400 border border-brand-500/30 hover:bg-brand-500/20 transition-colors"
              >
                Liberar tudo
              </button>
              <button
                type="button"
                onClick={() => setDraftCaps(['dashboard:view'])}
                className="text-xs px-3 py-1.5 rounded-lg text-[var(--rz-text-muted)] border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)] transition-colors"
              >
                Bloquear tudo
              </button>
              {(preset.customized || preset.isCustom) && canEdit && (
                <button
                  type="button"
                  onClick={handleReset}
                  disabled={saving}
                  className="text-xs px-3 py-1.5 rounded-lg text-[var(--rz-text-muted)] border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)] transition-colors inline-flex items-center gap-1"
                >
                  <RotateCcw size={12} />
                  {preset.isCustom ? 'Excluir' : 'Padrão'}
                </button>
              )}
            </div>
          )}
        </div>

        {preset.inviteable && (
          <div className="flex items-center gap-3">
            <div className="flex-1 h-2 rounded-full bg-[var(--rz-surface-muted)] overflow-hidden">
              <div
                className="h-full rounded-full bg-gradient-to-r from-brand-600 to-brand-400 transition-all duration-300"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <span className="text-sm tabular-nums text-[var(--rz-text-muted)] shrink-0">
              <span className="text-brand-400 font-semibold">{totalActive}</span>
              <span className="text-[var(--rz-text-muted)]"> / {totalAvailable}</span>
            </span>
          </div>
        )}
      </div>

      {/* Busca + expandir */}
      {preset.inviteable && (
        <div className="px-4 py-3 border-b border-[var(--rz-border)]/60 flex flex-col sm:flex-row gap-2 bg-[var(--rz-surface-muted)]/30">
          <div className="relative flex-1">
            <Search size={14} className={searchFieldIconCls} />
            <input
              type="search"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder="Buscar permissão ou seção…"
              className={`${inputCls} pl-9 pr-8`}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--rz-text-muted)] hover:text-[var(--rz-text-secondary)]"
                aria-label="Limpar busca"
              >
                <X size={14} />
              </button>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setExpandAllToken(t => t + 1)}
              className="text-xs px-3 py-2 rounded-lg text-[var(--rz-text-muted)] border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/60 whitespace-nowrap"
            >
              Expandir tudo
            </button>
            <button
              type="button"
              onClick={() => setCollapseAllToken(t => t + 1)}
              className="text-xs px-3 py-2 rounded-lg text-[var(--rz-text-muted)] border border-[var(--rz-border)] hover:bg-[var(--rz-surface-muted)]/60 whitespace-nowrap"
            >
              Recolher tudo
            </button>
          </div>
        </div>
      )}

      {/* Permissões */}
      <div>
      {!preset.inviteable ? (
        <div className="p-8 text-center">
          <Shield size={32} className="mx-auto text-brand-500/40 mb-3" />
          <p className="text-sm text-[var(--rz-text-muted)]">Acesso total à empresa — este papel não pode ser editado.</p>
        </div>
      ) : (
        <>
          <RolePermissionsAccordion
            key={preset.role}
            selected={draftCaps}
            onChange={setDraftCaps}
            permissionGroups={permissionGroups}
            disabled={!canEdit}
            searchQuery={searchQuery}
            expandAllToken={expandAllToken}
            collapseAllToken={collapseAllToken}
          />
          {hasDiscordIntegration && canEdit && (
            <p className="px-4 py-2 text-[11px] text-[var(--rz-text-muted)] border-t border-[var(--rz-border)]/80">
              Discord: o membro precisa vincular a conta em Configurações → Conta.
            </p>
          )}
        </>
      )}
      </div>

      {error && (
        <div className="mx-4 my-2 text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
          {error}
        </div>
      )}

      {preset.inviteable && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 px-4 py-3 border-t border-[var(--rz-border)] bg-[var(--rz-surface-muted)]/40">
          {!canEdit ? (
            <p className="text-xs text-[var(--rz-text-muted)]">Somente o dono pode editar papéis.</p>
          ) : (
            <>
              <p className={`text-xs ${dirty ? 'text-amber-500/90' : 'text-[var(--rz-text-muted)]'}`}>
                {dirty ? '● Alterações não salvas' : 'Nenhuma alteração pendente'}
              </p>
              <Button type="button" onClick={handleSave} disabled={saving || !dirty} className="min-w-[120px]">
                {saving ? <Spinner size={14} /> : <Save size={14} />}
                Salvar papel
              </Button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
