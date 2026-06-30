import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import {
  MessageSquare,
  Pause,
  Play,
  Plus,
  Trash2,
  BookOpen,
  Shield,
  Copy,
  Sparkles,
} from 'lucide-react'
import { api } from '../../lib/api'
import { can, getMe, type AuthUser } from '../../lib/auth'
import { PlatformPage } from '../../components/platform/PlatformPage'
import { Card } from '../../components/ui/Card'
import { Button } from '../../components/ui/Button'
import { inputCls, textareaCls, LoadingState } from '@/design-system'
import { notifyConfigSaved, mutationError } from '../../lib/notify'
import { cn } from '@/lib/utils'
import { InboxAtendimentoNav } from '../../components/inbox/InboxAtendimentoNav'

type CommandKind = 'system' | 'custom' | 'catalog'

interface BridgeCommandItem {
  id: string
  command: string
  displayCommand: string
  label: string
  description: string
  syntax: string
  category: string
  kind: CommandKind
  core: boolean
  enabled: boolean
  paused: boolean
  available: boolean
  requiresTicketRef: boolean
  actionPreset?: string
}

interface CatalogItem {
  id: string
  command: string
  label: string
  description: string
  syntax: string
  responseTemplate: string
  visitorMessageTemplate?: string
  actionPreset: string
  requiresTicketRef: boolean
  integrationNote: string
  category: string
}

interface BridgeCommandsPayload {
  config: {
    enabled: boolean
    systemOverrides?: Array<{
      commandId: string
      enabled: boolean
      paused: boolean
      customDescription?: string
    }>
    customCommands?: Array<{
      id: string
      command: string
      label: string
      description: string
      syntax: string
      enabled: boolean
      paused: boolean
      requiresTicketRef: boolean
      responseTemplate: string
      sendToVisitor: boolean
      visitorMessageTemplate?: string
      actionPreset: string
      actionUrl?: string
    }>
  }
  commands: BridgeCommandItem[]
  agentCommands: BridgeCommandItem[]
  helpText: string
  catalog?: CatalogItem[]
  canManage: boolean
}

const CATEGORY_LABEL: Record<string, string> = {
  attendance: 'Atendimento',
  query: 'Consulta',
  close: 'Encerrar',
  help: 'Ajuda',
  custom: 'Personalizado',
  finance: 'Financeiro',
  sales: 'Vendas',
  support: 'Suporte',
  operations: 'Operações',
}

function StatusBadge({ item }: { item: BridgeCommandItem }) {
  if (!item.enabled) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-red-500/15 text-red-400">Desativado</span>
  }
  if (item.paused) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-400">Pausado</span>
  }
  if (item.available) {
    return <span className="text-[10px] px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-400">Ativo</span>
  }
  return <span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--rz-surface-muted)] text-[var(--rz-text-muted)]">Indisponível</span>
}

export default function InboxWhatsappCommandsPage() {
  const qc = useQueryClient()
  const [me, setMe] = useState<AuthUser | null>(null)
  const [showCustomForm, setShowCustomForm] = useState(false)
  const [customDraft, setCustomDraft] = useState({
    id: '',
    command: '',
    label: '',
    description: '',
    responseTemplate: '',
    visitorMessageTemplate: '',
    sendToVisitor: false,
    requiresTicketRef: true,
    actionUrl: '',
  })

  useEffect(() => {
    getMe().then(setMe)
  }, [])

  const canManage = can(me, 'inbox:department:manage')

  const { data, isLoading } = useQuery({
    queryKey: ['inbox', 'whatsapp-bridge-commands'],
    queryFn: () => api.get<BridgeCommandsPayload>('/inbox/whatsapp-bridge-commands'),
  })

  const patchMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) =>
      api.patch<BridgeCommandsPayload>('/inbox/whatsapp-bridge-commands', body),
    onSuccess: () => {
      notifyConfigSaved()
      qc.invalidateQueries({ queryKey: ['inbox', 'whatsapp-bridge-commands'] })
    },
    onError: mutationError,
  })

  const systemCommands = data?.commands.filter(c => c.kind === 'system') ?? []
  const customCommands = data?.commands.filter(c => c.kind === 'custom') ?? []
  const agentList = data?.agentCommands ?? []

  const toggleMaster = () => {
    patchMutation.mutate({ enabled: !data?.config.enabled })
  }

  const patchSystem = (commandId: string, patch: { enabled?: boolean; paused?: boolean; customDescription?: string }) => {
    const overrides = [...(data?.config.systemOverrides ?? [])]
    const idx = overrides.findIndex(o => o.commandId === commandId)
    const base = idx >= 0 ? overrides[idx] : { commandId, enabled: true, paused: false }
    const next = { ...base, ...patch }
    if (idx >= 0) overrides[idx] = next
    else overrides.push(next)
    patchMutation.mutate({ systemOverrides: overrides })
  }

  const toggleSystemPaused = (item: BridgeCommandItem) => {
    patchSystem(item.id, { paused: !item.paused })
  }

  const toggleSystemEnabled = (item: BridgeCommandItem) => {
    if (item.core) return
    patchSystem(item.id, { enabled: !item.enabled })
  }

  const toggleCustomPaused = (id: string, paused: boolean) => {
    const custom = data?.config.customCommands?.find(c => c.id === id)
    if (!custom) return
    patchMutation.mutate({ upsertCustom: { ...custom, paused: !paused } })
  }

  const deleteCustom = (id: string) => {
    if (!window.confirm('Remover este comando personalizado?')) return
    patchMutation.mutate({ deleteCustomId: id })
  }

  const addFromCatalog = (catalogId: string, actionUrl?: string) => {
    patchMutation.mutate({ addFromCatalogId: catalogId, catalogActionUrl: actionUrl })
  }

  const saveCustom = () => {
    patchMutation.mutate({
      upsertCustom: {
        id: customDraft.id || undefined,
        command: customDraft.command,
        label: customDraft.label,
        description: customDraft.description,
        syntax: `!${customDraft.command.trim()}${customDraft.requiresTicketRef ? ' TK-…' : ''}`,
        enabled: true,
        paused: false,
        requiresTicketRef: customDraft.requiresTicketRef,
        responseTemplate: customDraft.responseTemplate,
        sendToVisitor: customDraft.sendToVisitor,
        visitorMessageTemplate: customDraft.visitorMessageTemplate || undefined,
        actionPreset: 'static',
        actionUrl: customDraft.actionUrl || undefined,
      },
    })
    setShowCustomForm(false)
    setCustomDraft({
      id: '',
      command: '',
      label: '',
      description: '',
      responseTemplate: '',
      visitorMessageTemplate: '',
      sendToVisitor: false,
      requiresTicketRef: true,
      actionUrl: '',
    })
  }

  const copyHelp = async () => {
    if (!data?.helpText) return
    await navigator.clipboard.writeText(data.helpText)
    notifyConfigSaved('Texto copiado para a área de transferência')
  }

  if (isLoading || !data) {
    return (
      <PlatformPage title="Comandos WhatsApp Bridge">
        <LoadingState label="Carregando comandos…" />
      </PlatformPage>
    )
  }

  return (
    <PlatformPage
      title="Comandos WhatsApp Bridge"
      description="Comandos operacionais enviados pelo WhatsApp pessoal do atendente (!assumir, !abrir, personalizados)."
    >
      <InboxAtendimentoNav me={me} className="mb-4" />

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-4">
          {canManage && (
            <Card className="p-4 space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="text-sm font-semibold text-[var(--rz-text-primary)] flex items-center gap-2">
                    <Shield size={16} className="text-brand-400" />
                    Módulo de comandos
                  </h2>
                  <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                    Desligue para bloquear todos os comandos ! da equipe nesta empresa.
                  </p>
                </div>
                <Button
                  type="button"
                  variant={data.config.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={toggleMaster}
                  disabled={patchMutation.isPending}
                >
                  {data.config.enabled ? 'Desativar módulo' : 'Ativar módulo'}
                </Button>
              </div>
            </Card>
          )}

          <Card className="p-4 space-y-3">
            <h2 className="text-sm font-semibold flex items-center gap-2">
              <MessageSquare size={16} className="text-brand-400" />
              {canManage ? 'Comandos do sistema' : 'Comandos disponíveis para você'}
            </h2>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Envie do seu WhatsApp pessoal cadastrado em Equipe. Requer número verificado e permissão de Inbox.
            </p>
            <div className="space-y-2">
              {(canManage ? systemCommands : agentList.filter(c => c.kind === 'system')).map(item => (
                <div
                  key={item.id}
                  className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-[var(--rz-border)]/80 bg-[var(--rz-surface-muted)]/40 p-3"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="text-xs font-mono text-brand-300">{item.displayCommand}</code>
                      <StatusBadge item={item} />
                      {item.core && (
                        <span className="text-[10px] text-[var(--rz-text-muted)]">Essencial</span>
                      )}
                    </div>
                    <p className="text-sm font-medium mt-1">{item.label}</p>
                    <p className="text-xs text-[var(--rz-text-muted)] mt-0.5">{item.description}</p>
                    <p className="text-[11px] text-[var(--rz-text-secondary)] mt-1 font-mono">{item.syntax}</p>
                  </div>
                  {canManage && (
                    <div className="flex gap-1 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        title={item.paused ? 'Retomar' : 'Pausar'}
                        onClick={() => toggleSystemPaused(item)}
                        disabled={!item.enabled || patchMutation.isPending}
                      >
                        {item.paused ? <Play size={14} /> : <Pause size={14} />}
                      </Button>
                      {!item.core && (
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          title={item.enabled ? 'Desativar' : 'Ativar'}
                          onClick={() => toggleSystemEnabled(item)}
                          disabled={patchMutation.isPending}
                        >
                          {item.enabled ? 'Off' : 'On'}
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          {customCommands.length > 0 && (
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Sparkles size={16} className="text-amber-400" />
                Comandos personalizados
              </h2>
              <div className="space-y-2">
                {customCommands.map(item => (
                  <div
                    key={item.id}
                    className="flex flex-wrap items-start justify-between gap-2 rounded-lg border border-amber-500/20 bg-amber-500/5 p-3"
                  >
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <code className="text-xs font-mono text-amber-300">{item.displayCommand}</code>
                        <StatusBadge item={item} />
                      </div>
                      <p className="text-sm font-medium mt-1">{item.label}</p>
                      <p className="text-xs text-[var(--rz-text-muted)]">{item.description}</p>
                      <p className="text-[11px] font-mono mt-1">{item.syntax}</p>
                    </div>
                    {canManage && (
                      <div className="flex gap-1">
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => toggleCustomPaused(item.id, item.paused)}
                        >
                          {item.paused ? <Play size={14} /> : <Pause size={14} />}
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="ghost"
                          onClick={() => deleteCustom(item.id)}
                        >
                          <Trash2 size={14} className="text-red-400" />
                        </Button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}

          {canManage && data.catalog && (
            <Card className="p-4 space-y-3">
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <BookOpen size={16} />
                Catálogo sugerido
              </h2>
              <p className="text-xs text-[var(--rz-text-muted)]">
                Comandos prontos para ativar. Ex.: <code className="text-brand-300">!2via</code> para segunda via de boleto.
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {data.catalog.map(item => {
                  const active = customCommands.some(c => c.command === item.command)
                  return (
                    <div
                      key={item.id}
                      className="rounded-lg border border-[var(--rz-border)]/80 p-3 space-y-2"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs font-mono text-brand-300">!{item.command}</code>
                        <span className="text-[10px] text-[var(--rz-text-muted)]">
                          {CATEGORY_LABEL[item.category] ?? item.category}
                        </span>
                      </div>
                      <p className="text-sm font-medium">{item.label}</p>
                      <p className="text-xs text-[var(--rz-text-muted)]">{item.description}</p>
                      <p className="text-[10px] text-[var(--rz-text-secondary)]">{item.integrationNote}</p>
                      <Button
                        type="button"
                        size="sm"
                        variant={active ? 'secondary' : 'primary'}
                        disabled={active || patchMutation.isPending}
                        onClick={() => {
                          const url = item.actionPreset.includes('link')
                            ? window.prompt('URL fixa (opcional):', '') ?? undefined
                            : undefined
                          addFromCatalog(item.id, url || undefined)
                        }}
                      >
                        {active ? 'Ativo' : 'Ativar'}
                      </Button>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}

          {canManage && (
            <Card className="p-4 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold">Novo comando personalizado</h2>
                <Button type="button" size="sm" variant="secondary" onClick={() => setShowCustomForm(v => !v)}>
                  <Plus size={14} className="mr-1" />
                  {showCustomForm ? 'Fechar' : 'Criar'}
                </Button>
              </div>
              {showCustomForm && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="block text-xs">
                    Comando (sem !)
                    <input
                      className={cn(inputCls, 'mt-1 font-mono')}
                      value={customDraft.command}
                      onChange={e => setCustomDraft(d => ({ ...d, command: e.target.value }))}
                      placeholder="2via"
                    />
                  </label>
                  <label className="block text-xs">
                    Título
                    <input
                      className={cn(inputCls, 'mt-1')}
                      value={customDraft.label}
                      onChange={e => setCustomDraft(d => ({ ...d, label: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs sm:col-span-2">
                    Descrição (aparece no !ajuda)
                    <input
                      className={cn(inputCls, 'mt-1')}
                      value={customDraft.description}
                      onChange={e => setCustomDraft(d => ({ ...d, description: e.target.value }))}
                    />
                  </label>
                  <label className="block text-xs sm:col-span-2">
                    Resposta ao atendente (template)
                    <textarea
                      className={cn(textareaCls, 'mt-1 font-mono text-xs min-h-[80px]')}
                      value={customDraft.responseTemplate}
                      onChange={e => setCustomDraft(d => ({ ...d, responseTemplate: e.target.value }))}
                      placeholder="2ª via {{ticketRef}} — {{clientName}} — {{paymentLink}}"
                    />
                  </label>
                  <label className="flex items-center gap-2 text-xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={customDraft.requiresTicketRef}
                      onChange={e => setCustomDraft(d => ({ ...d, requiresTicketRef: e.target.checked }))}
                    />
                    Exige TK-… no comando
                  </label>
                  <label className="flex items-center gap-2 text-xs sm:col-span-2">
                    <input
                      type="checkbox"
                      checked={customDraft.sendToVisitor}
                      onChange={e => setCustomDraft(d => ({ ...d, sendToVisitor: e.target.checked }))}
                    />
                    Enviar também ao visitante (com bridge ativo)
                  </label>
                  {customDraft.sendToVisitor && (
                    <label className="block text-xs sm:col-span-2">
                      Mensagem ao visitante
                      <textarea
                        className={cn(textareaCls, 'mt-1 font-mono text-xs min-h-[60px]')}
                        value={customDraft.visitorMessageTemplate}
                        onChange={e => setCustomDraft(d => ({ ...d, visitorMessageTemplate: e.target.value }))}
                      />
                    </label>
                  )}
                  <div className="sm:col-span-2">
                    <Button type="button" onClick={saveCustom} disabled={patchMutation.isPending}>
                      Salvar comando
                    </Button>
                  </div>
                </div>
              )}
              <p className="text-[10px] text-[var(--rz-text-muted)]">
                Placeholders: {'{{ticketRef}}'}, {'{{clientName}}'}, {'{{clientPhone}}'}, {'{{paymentLink}}'}, {'{{message}}'}
              </p>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <Card className="p-4 space-y-3 sticky top-20">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-semibold">Referência !ajuda</h2>
              <Button type="button" size="sm" variant="ghost" onClick={copyHelp} title="Copiar">
                <Copy size={14} />
              </Button>
            </div>
            <p className="text-xs text-[var(--rz-text-muted)]">
              Texto enviado quando alguém da equipe manda <code className="text-brand-300">!ajuda</code> no WhatsApp.
            </p>
            <pre className="text-[10px] leading-relaxed whitespace-pre-wrap font-mono bg-[var(--rz-surface-muted)]/80 rounded-lg p-3 border border-[var(--rz-border)]/60 max-h-[420px] overflow-y-auto">
              {data.helpText}
            </pre>
            {!canManage && (
              <p className="text-[11px] text-[var(--rz-text-muted)]">
                Mostrando apenas comandos ativos para sua empresa. Configuração: administrador em Atendimento → Comandos WA.
              </p>
            )}
          </Card>

          <Card className="p-4 space-y-2 text-xs text-[var(--rz-text-muted)]">
            <p className="font-medium text-[var(--rz-text-secondary)]">Como usar</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Cadastre seu WhatsApp em Equipe → Perfil</li>
              <li>Confirme o número (OTP)</li>
              <li>Receba alerta de fallback ou use !assumir TK-…</li>
              <li>Com bridge ativo, responda normalmente ou TK-XXXX mensagem</li>
            </ol>
          </Card>
        </div>
      </div>
    </PlatformPage>
  )
}
