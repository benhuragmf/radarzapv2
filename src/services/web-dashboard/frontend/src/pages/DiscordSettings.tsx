import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../lib/api'
import { DiscordPage } from '../components/discord/DiscordPage'
import { Card } from '../components/ui/Card'
import { Badge } from '../components/ui/Badge'
import { Button } from '../components/ui/Button'
import { Spinner } from '../components/ui/Spinner'
import type { AuthUser } from '../lib/auth'
import { useGuild } from '../lib/guildContext'
import { Hash, BookOpen, ExternalLink, FlaskConical, Layers, Webhook } from 'lucide-react'
import { Link } from 'react-router-dom'
import { mutationError } from '../lib/notify'

interface Props {
  user: AuthUser
}
interface ChannelRow {
  _id: string
  channelName: string
  isActive: boolean
}

export default function DiscordSettings({ user }: Props) {
  const qc = useQueryClient()
  const { guildId, guildName } = useGuild()
  const membership = user?.guilds.find(g => g.id === guildId)

  const { data: channels = [] } = useQuery<ChannelRow[]>({
    queryKey: ['channels', guildId],
    queryFn: () => api.get(`/channels?guildId=${guildId}`),
    enabled: !!guildId,
  })

  const { data: settings, isLoading: loadingSettings } = useQuery<{
    dryRun: boolean
    multiRulePerMessage: boolean
    inboundEnabled: boolean
  }>({
    queryKey: ['discord-settings'],
    queryFn: () => api.get('/discord/settings'),
  })

  const saveSettings = useMutation({
    mutationFn: (patch: {
      dryRun?: boolean
      multiRulePerMessage?: boolean
      inboundEnabled?: boolean
    }) => api.patch('/discord/settings', patch),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['discord-settings'] })
      qc.invalidateQueries({ queryKey: ['discord-audit'] })
    },
    onError: mutationError,
  })

  return (
    <DiscordPage description="Configurações e permissões do servidor selecionado na barra lateral.">
      <Card className="space-y-4 border-amber-700/30">
        <div className="flex items-start gap-3">
          <FlaskConical size={20} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">Modo simulação (dry-run)</p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                Captura mensagens e eventos, avalia regras e grava histórico — <strong>sem enviar</strong> ao WhatsApp.
                Útil para testar gatilhos e filtros em produção com segurança.
              </p>
            </div>
            {loadingSettings ? (
              <Spinner size={14} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  label={settings?.dryRun ? 'Simulação ativa' : 'Envio real'}
                  variant={settings?.dryRun ? 'yellow' : 'green'}
                />
                <Button
                  size="sm"
                  variant={settings?.dryRun ? 'secondary' : 'primary'}
                  disabled={saveSettings.isPending}
                  onClick={() => saveSettings.mutate({ dryRun: !settings?.dryRun })}
                >
                  {saveSettings.isPending ? (
                    <Spinner size={12} />
                  ) : settings?.dryRun ? (
                    'Desativar simulação'
                  ) : (
                    'Ativar simulação'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border-brand-700/30">
        <div className="flex items-start gap-3">
          <Layers size={20} className="text-brand-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">Multi-regra por mensagem</p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                Quando várias regras batem na mesma captura, aplica até <strong>5 regras</strong> (ordenadas por
                prioridade). Desligado: só a regra de maior prioridade (comportamento padrão).
              </p>
            </div>
            {loadingSettings ? (
              <Spinner size={14} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  label={settings?.multiRulePerMessage ? 'Multi-regra ativo' : 'Uma regra por captura'}
                  variant={settings?.multiRulePerMessage ? 'green' : 'gray'}
                />
                <Button
                  size="sm"
                  variant={settings?.multiRulePerMessage ? 'secondary' : 'primary'}
                  disabled={saveSettings.isPending}
                  onClick={() =>
                    saveSettings.mutate({ multiRulePerMessage: !settings?.multiRulePerMessage })
                  }
                >
                  {saveSettings.isPending ? (
                    <Spinner size={12} />
                  ) : settings?.multiRulePerMessage ? (
                    'Desativar multi-regra'
                  ) : (
                    'Ativar multi-regra'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4 border-violet-700/30">
        <div className="flex items-start gap-3">
          <Webhook size={20} className="text-violet-400 shrink-0 mt-0.5" />
          <div className="flex-1 space-y-3">
            <div>
              <p className="text-sm font-medium text-[var(--rz-text-primary)]">Webhook inbound (sem gateway)</p>
              <p className="text-xs text-[var(--rz-text-muted)] mt-1">
                Permite que sistemas externos enviem capturas via{' '}
                <code className="text-[10px]">POST /api/integrations/discord/inbound/messages</code> com header{' '}
                <code className="text-[10px]">X-API-Key</code> e <code className="text-[10px]">Idempotency-Key</code>.
                Útil quando o bot Radar não está no servidor Discord.
              </p>
            </div>
            {loadingSettings ? (
              <Spinner size={14} />
            ) : (
              <div className="flex flex-wrap items-center gap-3">
                <Badge
                  label={settings?.inboundEnabled ? 'Inbound ativo' : 'Inbound desativado'}
                  variant={settings?.inboundEnabled ? 'green' : 'gray'}
                />
                <Button
                  size="sm"
                  variant={settings?.inboundEnabled ? 'secondary' : 'primary'}
                  disabled={saveSettings.isPending}
                  onClick={() =>
                    saveSettings.mutate({ inboundEnabled: !settings?.inboundEnabled })
                  }
                >
                  {saveSettings.isPending ? (
                    <Spinner size={12} />
                  ) : settings?.inboundEnabled ? (
                    'Desativar inbound'
                  ) : (
                    'Ativar inbound'
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      </Card>

      <Card className="space-y-4">
        <div className="flex items-start gap-3">
          <Hash size={20} className="text-brand-500 shrink-0 mt-0.5" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-[var(--rz-text-muted)]">Servidor Discord</p>
            <p className="text-lg font-semibold text-[var(--rz-text-primary)] truncate">{guildName}</p>
            <p className="text-xs text-[var(--rz-text-muted)] font-mono mt-0.5">{guildId}</p>
          </div>
        </div>

        {membership && (
          <>
            <div>
              <p className="text-xs text-[var(--rz-text-muted)]">Seu papel neste servidor</p>
              <p className="text-sm font-medium mt-0.5 text-[var(--rz-text-primary)]">{membership.role}</p>
              <Badge
                label={membership.apiAccessEnabled ? 'API habilitada' : 'API desabilitada'}
                variant={membership.apiAccessEnabled ? 'green' : 'gray'}
              />
            </div>
            <div>
              <p className="text-xs text-[var(--rz-text-muted)]">Papel efetivo no Radar Chat</p>
              <p className="text-sm text-[var(--rz-text-secondary)]">{membership.effectiveRole.replace('_', ' ')}</p>
            </div>
          </>
        )}

        {!membership && user?.isInternalStaff && (
          <p className="text-xs text-amber-400/90">Acesso administrativo — sem vínculo de membro neste servidor.</p>
        )}

        <div>
          <p className="text-xs text-[var(--rz-text-muted)]">Automação</p>
          <p className="text-sm mt-0.5 text-[var(--rz-text-secondary)]">
            {channels.length} canal(is) monitorado(s)
            {channels.filter(c => c.isActive).length !== channels.length &&
              ` · ${channels.filter(c => c.isActive).length} ativo(s)`}
          </p>
        </div>

        <div className="flex flex-wrap gap-2 pt-2 border-t border-[var(--rz-border)]">
          <Link to="/discord/channels" className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1">
            <Hash size={12} /> Canais
          </Link>
          <Link to="/discord/rules" className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1">
            <BookOpen size={12} /> Regras
          </Link>
          <a
            href={`https://discord.com/channels/${guildId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-[var(--rz-primary)] hover:underline flex items-center gap-1"
          >
            <ExternalLink size={12} /> Abrir no Discord
          </a>
        </div>
      </Card>

      <Card className="space-y-2">
        <p className="text-sm font-medium text-[var(--rz-text-primary)]">Conta Radar Chat</p>
        <p className="text-xs text-[var(--rz-text-muted)]">
          Plano, chaves de API e dados da conta Discord ficam em{' '}
          <Link to="/settings" className="text-[var(--rz-primary)] hover:underline">
            Plataforma → Configurações
          </Link>
          .
        </p>
      </Card>
    </DiscordPage>
  )
}
