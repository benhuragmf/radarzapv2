import { useState, useEffect, useMemo } from 'react'
import { RotateCcw, Save } from 'lucide-react'
import type { CompanyRole } from '../../lib/auth'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'

export interface PermissionGroup {
  id: string
  label: string
  description: string
  capabilities: string[]
}

export interface RolePreset {
  role: CompanyRole
  label: string
  description: string
  inviteable: boolean
  capabilities: string[]
  customized?: boolean
}

const CAP_LABELS: Record<string, string> = {
  'dashboard:view': 'Visão geral',
  'platform:reports:view': 'Página de relatórios',
  'platform:audit:view': 'Página de auditoria',
  'account:settings': 'Configurações da empresa',
  'billing:view': 'Plano e faturamento',
  'company:members:manage': 'Convidar e gerenciar equipe',
  'send:test': 'Enviar / campanhas / histórico',
  'send:templates:manage': 'Modelos de mensagem',
  'send:schedule:manage': 'Agendamentos',
  'send:rules:manage': 'Regras automáticas / gatilhos',
  'consent:view': 'Listas e relatório de consentimento',
  'consent:request-renewal': 'Solicitar novo aceite',
  'consent:approve-renewal': 'Aprovar solicitações de aceite',
  'consent:clear-refusal': 'Limpar recusa de contato',
  'consent:manual-block': 'Bloquear contato manualmente',
  'company:members:remove': 'Remover funcionário da equipe',
  'send:destination:manage': 'Segmentos, grupos e importar',
  'send:destination:view': 'Ver destinos',
  'whatsapp:session:view': 'Sessões e QR Code',
  'whatsapp:session:manage': 'Gerenciar conexões WA',
  'inbox:view': 'Inbox',
  'inbox:reply': 'Responder',
  'inbox:transfer': 'Transferir',
  'inbox:department:manage': 'Setores / bot',
  'inbox:reports:view': 'Relatórios de atendimento',
  'inbox:supervise': 'Supervisor',
  'queue:view': 'Fila (relatórios)',
  'queue:retry': 'Reprocessar fila',
  'logs:view': 'Logs operacionais',
  'api:key:create': 'Chaves e webhooks API',
  'api:key:revoke': 'Revogar chaves',
  'api:logs:view': 'Documentação API',
  'discord:server:view': 'Ver servidor',
  'discord:server:manage': 'Gerenciar servidor',
  'discord:channels:manage': 'Canais monitorados',
  'discord:webhooks:manage': 'Webhooks',
  'discord:members:manage': 'Membros',
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
      } ${on ? 'bg-brand-500' : 'bg-gray-700'}`}
    >
      <span
        className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
          on ? 'translate-x-4' : 'translate-x-0.5'
        }`}
      />
    </button>
  )
}

interface MatrixProps {
  selected: string[]
  onChange: (caps: string[]) => void
  permissionGroups: PermissionGroup[]
  disabled?: boolean
}

export function RolePermissionsMatrix({
  selected,
  onChange,
  permissionGroups,
  disabled,
}: MatrixProps) {
  const [activeGroupId, setActiveGroupId] = useState(permissionGroups[0]?.id ?? '')
  const selectedSet = useMemo(() => new Set(selected), [selected])

  useEffect(() => {
    if (!permissionGroups.some(g => g.id === activeGroupId)) {
      setActiveGroupId(permissionGroups[0]?.id ?? '')
    }
  }, [permissionGroups, activeGroupId])

  const activeGroup = permissionGroups.find(g => g.id === activeGroupId)

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

  if (!permissionGroups.length) {
    return <p className="text-sm text-gray-500 py-6 text-center">Nenhuma permissão disponível.</p>
  }

  return (
    <div className="flex flex-col min-h-0">
      <div className="flex gap-0.5 p-1 border-b border-gray-800 bg-gray-950/60 overflow-x-auto">
        {permissionGroups.map(group => {
          const active = group.capabilities.filter(c => selectedSet.has(c)).length
          const total = group.capabilities.length
          const allOn = active === total && total > 0
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveGroupId(group.id)}
              className={`shrink-0 px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                activeGroupId === group.id
                  ? 'bg-gray-800 text-white'
                  : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {group.label}
              <span
                className={`ml-1.5 tabular-nums ${
                  allOn ? 'text-brand-400' : active > 0 ? 'text-amber-500/80' : 'text-gray-600'
                }`}
              >
                {active}/{total}
              </span>
            </button>
          )
        })}
      </div>

      {activeGroup && (
        <div className="p-3">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="text-[11px] text-gray-500">{activeGroup.description}</p>
            {!disabled && (
              <button
                type="button"
                onClick={() => {
                  const allOn = activeGroup.capabilities.every(c => selectedSet.has(c))
                  toggleGroup(activeGroup, !allOn)
                }}
                className="text-[11px] text-brand-400 hover:underline shrink-0"
              >
                {activeGroup.capabilities.every(c => selectedSet.has(c)) ? 'Desligar tudo' : 'Ligar tudo'}
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-0.5">
            {activeGroup.capabilities.map(cap => {
              const on = selectedSet.has(cap)
              return (
                <div
                  key={cap}
                  className={`flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg transition-colors ${
                    on ? 'bg-brand-500/5' : 'hover:bg-gray-800/40'
                  }`}
                >
                  <span className={`text-xs truncate ${on ? 'text-gray-200' : 'text-gray-500'}`}>
                    {CAP_LABELS[cap] ?? cap}
                  </span>
                  <Toggle on={on} disabled={disabled} onClick={() => toggleCap(cap)} />
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}

interface MemberRoleModalProps {
  member: {
    _id: string
    displayEmail?: string
    companyRole: CompanyRole
  }
  presets: RolePreset[]
  isOwner: boolean
  onClose: () => void
  onSave: (role: CompanyRole) => Promise<void>
}

export function TeamMemberRoleModal({
  member,
  presets,
  isOwner,
  onClose,
  onSave,
}: MemberRoleModalProps) {
  const [role, setRole] = useState<CompanyRole>(member.companyRole)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const preset = presets.find(p => p.role === role)

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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60">
      <div className="w-full max-w-md bg-gray-900 border border-gray-700 rounded-2xl shadow-xl">
        <div className="p-5 border-b border-gray-800">
          <h3 className="text-base font-semibold text-white">Alterar papel</h3>
          <p className="text-sm text-gray-400 mt-1">{member.displayEmail}</p>
        </div>
        <div className="p-5 space-y-3">
          <div>
            <label className="text-xs text-gray-500 mb-1 block">Papel</label>
            <select
              value={role}
              onChange={e => setRole(e.target.value as CompanyRole)}
              className="w-full bg-gray-800 border border-gray-700 rounded-lg px-3 py-2 text-sm text-gray-200"
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
            {preset && <p className="text-xs text-gray-500 mt-1.5">{preset.description}</p>}
          </div>
          {error && (
            <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>
        <div className="p-5 border-t border-gray-800 flex gap-2 justify-end">
          <Button type="button" variant="secondary" onClick={onClose} disabled={saving}>
            Cancelar
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving}>
            {saving ? <Spinner size={14} /> : null}
            Salvar
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
  selectedRole: CompanyRole
  onSelectRole: (role: CompanyRole) => void
  onSave: (role: CompanyRole, capabilities: string[]) => Promise<void>
  onReset: (role: CompanyRole) => Promise<void>
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
}: RolesPanelProps) {
  const preset = presets.find(p => p.role === selectedRole) ?? presets[0]
  const [caps, setCaps] = useState<string[]>(preset?.capabilities ?? [])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (preset) setCaps(preset.capabilities)
  }, [preset?.role, preset?.capabilities])

  const dirty = useMemo(() => {
    if (!preset) return false
    const a = new Set(caps)
    const b = new Set(preset.capabilities)
    if (a.size !== b.size) return true
    for (const c of a) if (!b.has(c)) return true
    return false
  }, [caps, preset])

  const allAssignable = useMemo(
    () => [...new Set(permissionGroups.flatMap(g => g.capabilities))],
    [permissionGroups],
  )

  const totalActive = caps.length
  const totalAvailable = allAssignable.length

  const handleSave = async () => {
    if (!preset) return
    setSaving(true)
    setError(null)
    try {
      await onSave(preset.role, caps)
    } catch (e) {
      setError((e as Error).message)
    } finally {
      setSaving(false)
    }
  }

  const handleReset = async () => {
    if (!preset?.inviteable) return
    if (!window.confirm(`Restaurar "${preset.label}" para o padrão?`)) return
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
    <div className="rounded-xl border border-gray-800 bg-gray-900/40 overflow-hidden">
      <div className="flex flex-col sm:flex-row min-h-[380px]">
        <aside className="sm:w-40 shrink-0 border-b sm:border-b-0 sm:border-r border-gray-800 bg-gray-950/50">
          <nav className="flex sm:flex-col gap-0.5 p-1.5 overflow-x-auto sm:overflow-visible">
            {presets.map(p => {
              const active = p.capabilities.length
              const isSelected = p.role === selectedRole
              return (
                <button
                  key={p.role}
                  type="button"
                  onClick={() => onSelectRole(p.role)}
                  className={`shrink-0 sm:w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg text-left text-xs transition-colors ${
                    isSelected
                      ? 'bg-gray-800 text-white'
                      : 'text-gray-500 hover:text-gray-300 hover:bg-gray-800/50'
                  }`}
                >
                  <span className="truncate font-medium">{p.label}</span>
                  <span className="flex items-center gap-1 shrink-0">
                    {p.customized && <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />}
                    <span className="tabular-nums text-[10px] text-gray-600">{active}</span>
                  </span>
                </button>
              )
            })}
          </nav>
        </aside>

        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-gray-800/80">
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-semibold text-white truncate">{preset.label}</h3>
                {preset.customized && (
                  <span className="text-[10px] uppercase tracking-wide text-amber-500/90 shrink-0">
                    custom
                  </span>
                )}
                {!preset.inviteable && (
                  <span className="text-[10px] uppercase text-gray-600 shrink-0">fixo</span>
                )}
              </div>
              <p className="text-[11px] text-gray-500 mt-0.5 truncate">{preset.description}</p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              {canEdit && preset.inviteable && (
                <div className="flex gap-1">
                  <button
                    type="button"
                    onClick={() => setCaps(allAssignable)}
                    className="text-[10px] px-2 py-1 rounded border border-brand-500/40 text-brand-400 hover:bg-brand-500/10"
                  >
                    Liberar tudo
                  </button>
                  <button
                    type="button"
                    onClick={() => setCaps(['dashboard:view'])}
                    className="text-[10px] px-2 py-1 rounded border border-gray-700 text-gray-500 hover:bg-gray-800"
                  >
                    Bloquear tudo
                  </button>
                </div>
              )}
              <div className="text-right">
                <p className="text-lg font-semibold text-brand-400 tabular-nums leading-none">
                  {totalActive}
                </p>
                <p className="text-[10px] text-gray-600">de {totalAvailable}</p>
              </div>
            </div>
          </div>

          {!preset.inviteable ? (
            <p className="text-sm text-gray-500 p-4">Acesso total — não editável.</p>
          ) : (
            <>
              <RolePermissionsMatrix
                selected={caps}
                onChange={setCaps}
                permissionGroups={permissionGroups}
                disabled={!canEdit}
              />
              {hasDiscordIntegration && canEdit && (
                <p className="px-4 pb-2 text-[10px] text-gray-600">
                  Discord: membro precisa vincular conta em Configurações → Conta.
                </p>
              )}
            </>
          )}

          {error && (
            <div className="mx-4 mb-2 text-xs text-red-400 bg-red-900/30 border border-red-800 rounded-lg px-3 py-2">
              {error}
            </div>
          )}

          {preset.inviteable && (
            <div className="mt-auto flex items-center justify-between gap-2 px-4 py-3 border-t border-gray-800 bg-gray-950/30">
              {!canEdit ? (
                <p className="text-[11px] text-gray-500">Apenas o dono edita papéis.</p>
              ) : (
                <>
                  <div className="flex gap-2">
                    {preset.customized && (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={handleReset}
                        disabled={saving}
                        className="!px-2.5 !py-1.5 !text-xs"
                      >
                        <RotateCcw size={12} />
                        Padrão
                      </Button>
                    )}
                  </div>
                  <Button
                    type="button"
                    onClick={handleSave}
                    disabled={saving || !dirty}
                    className="!px-3 !py-1.5 !text-xs"
                  >
                    {saving ? <Spinner size={12} /> : <Save size={12} />}
                    Salvar
                  </Button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
