import mongoose from 'mongoose';
import { randomUUID } from 'crypto';
import { InboxSettings } from '@/models/InboxSettings';
import { InboxTicket } from '@/models/InboxTicket';
import { WebChatConversation } from '@/models/WebChatConversation';
import { User } from '@/models/User';
import {
  DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG,
  WHATSAPP_BRIDGE_COMMAND_CATALOG,
  WHATSAPP_BRIDGE_SYSTEM_COMMANDS,
  type WhatsappBridgeCommandCatalogItem,
  type WhatsappBridgeCommandListItem,
  type WhatsappBridgeCommandsConfig,
  type WhatsappBridgeCustomCommand,
  type WhatsappBridgeSystemCommandId,
  type WhatsappBridgeSystemCommandOverride,
} from '@/types/whatsapp-bridge-commands';
import {
  normalizeCommandTicketRef,
  parseCommandTicketArg,
  type WhatsappAgentCommandName,
} from '@/utils/whatsapp-agent-command.util';

const CUSTOM_COMMAND_RE = /^!([a-z0-9_]{2,24})(?:\s+([\s\S]+))?$/i;
const RESERVED_COMMANDS = new Set(
  WHATSAPP_BRIDGE_SYSTEM_COMMANDS.flatMap(c => [c.command, ...c.aliases]).map(s => s.toLowerCase()),
);

function normalizeCustomCommandName(raw: string): string {
  return raw.trim().toLowerCase().replace(/^!+/, '');
}

function validateCustomCommandName(command: string): string | null {
  const name = normalizeCustomCommandName(command);
  if (!/^[a-z0-9_]{2,24}$/.test(name)) {
    return 'Comando deve ter 2–24 caracteres (letras minúsculas, números ou _).';
  }
  if (RESERVED_COMMANDS.has(name)) {
    return `!${name} já é um comando do sistema.`;
  }
  return null;
}

function defaultSystemOverride(id: WhatsappBridgeSystemCommandId): WhatsappBridgeSystemCommandOverride {
  return { commandId: id, enabled: true, paused: false };
}

export async function loadWhatsappBridgeCommandsConfig(
  clientId: string,
): Promise<WhatsappBridgeCommandsConfig> {
  const settings = await InboxSettings.getOrCreate(clientId);
  const raw = settings.whatsappBridgeCommandsConfig;
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG };
  }
  return {
    enabled: raw.enabled !== false,
    systemOverrides: Array.isArray(raw.systemOverrides) ? raw.systemOverrides : [],
    customCommands: Array.isArray(raw.customCommands) ? raw.customCommands : [],
  };
}

function resolveSystemOverride(
  config: WhatsappBridgeCommandsConfig,
  id: WhatsappBridgeSystemCommandId,
): WhatsappBridgeSystemCommandOverride {
  return (
    config.systemOverrides.find(o => o.commandId === id) ?? defaultSystemOverride(id)
  );
}

export function isSystemCommandAvailable(
  config: WhatsappBridgeCommandsConfig,
  id: WhatsappBridgeSystemCommandId,
): boolean {
  if (!config.enabled) return false;
  const o = resolveSystemOverride(config, id);
  return o.enabled && !o.paused;
}

export function resolveSystemCommandIdByName(name: string): WhatsappBridgeSystemCommandId | null {
  const lower = name.toLowerCase();
  for (const def of WHATSAPP_BRIDGE_SYSTEM_COMMANDS) {
    if (def.command === lower || def.aliases.some(a => a === lower)) {
      return def.id;
    }
  }
  return null;
}

export function mapSystemCommandNameToHandler(name: WhatsappAgentCommandName): WhatsappBridgeSystemCommandId | null {
  return resolveSystemCommandIdByName(name);
}

export function listWhatsappBridgeCommandsForTenant(
  config: WhatsappBridgeCommandsConfig,
): WhatsappBridgeCommandListItem[] {
  const systemItems: WhatsappBridgeCommandListItem[] = WHATSAPP_BRIDGE_SYSTEM_COMMANDS.map(def => {
    const o = resolveSystemOverride(config, def.id);
    const available = config.enabled && o.enabled && !o.paused;
    return {
      id: def.id,
      command: def.command,
      displayCommand: `!${def.command}`,
      label: def.label,
      description: o.customDescription?.trim() || def.description,
      syntax: def.syntax,
      category: def.category,
      kind: 'system',
      core: def.core,
      enabled: o.enabled,
      paused: o.paused,
      available,
      requiresTicketRef: def.requiresTicketRef,
    };
  });

  const customItems: WhatsappBridgeCommandListItem[] = config.customCommands.map(c => ({
    id: c.id,
    command: c.command,
    displayCommand: `!${c.command}`,
    label: c.label,
    description: c.description,
    syntax: c.syntax || `!${c.command}${c.requiresTicketRef ? ' TK-…' : ''}`,
    category: 'custom',
    kind: 'custom',
    core: false,
    enabled: c.enabled,
    paused: c.paused,
    available: config.enabled && c.enabled && !c.paused,
    requiresTicketRef: c.requiresTicketRef,
    actionPreset: c.actionPreset,
  }));

  return [...systemItems, ...customItems];
}

export function listWhatsappBridgeCommandsForAgent(
  config: WhatsappBridgeCommandsConfig,
): WhatsappBridgeCommandListItem[] {
  return listWhatsappBridgeCommandsForTenant(config).filter(c => c.available);
}

export function buildDynamicWhatsappAgentHelp(config: WhatsappBridgeCommandsConfig): string {
  const available = listWhatsappBridgeCommandsForAgent(config);
  const byCategory: Record<string, WhatsappBridgeCommandListItem[]> = {
    attendance: [],
    query: [],
    close: [],
    help: [],
    custom: [],
  };

  for (const item of available) {
    const key = item.category in byCategory ? item.category : 'custom';
    byCategory[key].push(item);
  }

  const section = (title: string, items: WhatsappBridgeCommandListItem[]) => {
    if (items.length === 0) return [];
    return [title, ...items.map(i => `${i.displayCommand} — ${i.description}`), ''];
  };

  const lines = [
    '📋 Radar Chat — Comandos WhatsApp (Equipe)',
    '',
    ...section('▸ Atendimento — chat do site', [
      ...byCategory.attendance,
      ...byCategory.custom.filter(c => c.actionPreset && c.actionPreset !== 'static'),
    ]),
    ...section('▸ Consulta', byCategory.query),
    ...section('▸ Encerrar', byCategory.close),
    ...section('▸ Ajuda', byCategory.help),
    ...section('▸ Comandos personalizados', byCategory.custom.filter(c => !c.actionPreset || c.actionPreset === 'static')),
    'Com bridge ativo: responda direto (usa !foco) ou TK-XXXX / !trocar N com vários chamados.',
  ];

  return lines.filter((line, idx, arr) => line !== '' || (idx > 0 && arr[idx - 1] !== '')).join('\n').trim();
}

export function parseCustomWhatsappCommand(
  text: string,
  customCommands: WhatsappBridgeCustomCommand[],
): { command: WhatsappBridgeCustomCommand; arg?: string } | null {
  const trimmed = text.trim();
  const match = trimmed.match(CUSTOM_COMMAND_RE);
  if (!match) return null;
  const name = match[1].toLowerCase();
  const cmd = customCommands.find(c => c.command === name);
  if (!cmd) return null;
  const arg = match[2]?.trim();
  if (cmd.requiresTicketRef && !arg) {
    return null;
  }
  return { command: cmd, arg };
}

export interface CommandTemplateContext {
  ticketRef?: string;
  clientName?: string;
  clientPhone?: string;
  agentName?: string;
  message?: string;
  paymentLink?: string;
}

export function renderCommandTemplate(template: string, ctx: CommandTemplateContext): string {
  const map: Record<string, string> = {
    ticketRef: ctx.ticketRef ?? '—',
    clientName: ctx.clientName ?? 'Cliente',
    clientPhone: ctx.clientPhone ?? '—',
    agentName: ctx.agentName ?? 'Atendente',
    message: ctx.message ?? '',
    paymentLink: ctx.paymentLink ?? '(configure link no template ou contato)',
  };
  return template.replace(/\{\{(\w+)\}\}/g, (_m, key: string) => map[key] ?? '');
}

async function resolveTemplateContext(
  clientId: string,
  ticketRef: string | undefined,
  agentName: string,
  message?: string,
  actionUrl?: string,
): Promise<CommandTemplateContext> {
  const ctx: CommandTemplateContext = {
    ticketRef: ticketRef?.trim().toUpperCase(),
    agentName,
    message,
    paymentLink: actionUrl?.trim() || undefined,
  };

  if (!ticketRef) return ctx;

  const clientOid = new mongoose.Types.ObjectId(clientId);
  const ref = normalizeCommandTicketRef(ticketRef);

  const ticket = await InboxTicket.findOne({ clientId: clientOid, ticketRef: ref })
    .select('contactName contactIdentifier webChatConversationId')
    .lean();
  if (ticket) {
    ctx.clientName = ticket.contactName?.trim() || ctx.clientName;
    ctx.clientPhone = ticket.contactIdentifier?.trim() || ctx.clientPhone;
  }

  const webChat = await WebChatConversation.findOne({
    clientId: clientOid,
    ticketRef: ref,
    status: 'open',
  })
    .select('visitorName visitorPhone')
    .lean();
  if (webChat) {
    ctx.clientName = webChat.visitorName?.trim() || ctx.clientName;
    ctx.clientPhone = webChat.visitorPhone?.trim() || ctx.clientPhone;
  }

  return ctx;
}

export async function executeCustomWhatsappCommand(input: {
  clientId: string;
  userId: string;
  agentName: string;
  command: WhatsappBridgeCustomCommand;
  arg?: string;
}): Promise<string> {
  const { ticketRef, message } = input.arg
    ? parseCommandTicketArg(input.arg)
    : { ticketRef: undefined as string | undefined, message: undefined as string | undefined };

  if (input.command.requiresTicketRef && !ticketRef) {
    return `Use: !${input.command.command} TK-…${message ? ' texto' : ''}`;
  }

  const ctx = await resolveTemplateContext(
    input.clientId,
    ticketRef,
    input.agentName,
    message,
    input.command.actionUrl,
  );

  const response = renderCommandTemplate(input.command.responseTemplate, ctx);

  if (input.command.sendToVisitor && input.command.visitorMessageTemplate && ticketRef) {
    const visitorText = renderCommandTemplate(input.command.visitorMessageTemplate, ctx);
    const webChat = await WebChatConversation.findOne({
      clientId: new mongoose.Types.ObjectId(input.clientId),
      ticketRef,
      status: 'open',
      whatsappBridgeActive: true,
    });
    if (webChat) {
      const { WebChatService } = await import('@/services/webchat/WebChatService');
      const user = await User.findById(input.userId).select('displayName email').lean();
      const displayName =
        user?.displayName?.trim() || user?.email?.split('@')[0] || input.agentName;
      await WebChatService.getInstance().sendAgentMessage(
        input.clientId,
        input.userId,
        String(webChat._id),
        visitorText,
        displayName,
        { humanDelay: 'bridge' },
      );
      return `${response}\n\n(Mensagem enviada ao visitante no chat do site.)`;
    }
    return `${response}\n\n(Bridge inativo — mensagem ao visitante não enviada.)`;
  }

  return response;
}

export function catalogItemToCustomCommand(
  item: WhatsappBridgeCommandCatalogItem,
  actionUrl?: string,
): WhatsappBridgeCustomCommand {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    command: item.command,
    label: item.label,
    description: item.description,
    syntax: item.syntax,
    enabled: true,
    paused: false,
    requiresTicketRef: item.requiresTicketRef,
    responseTemplate: item.responseTemplate,
    sendToVisitor: Boolean(item.visitorMessageTemplate),
    visitorMessageTemplate: item.visitorMessageTemplate,
    actionPreset: item.actionPreset,
    actionUrl: actionUrl?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
}

export async function getWhatsappBridgeCommandsPayload(clientId: string) {
  const config = await loadWhatsappBridgeCommandsConfig(clientId);
  return {
    config,
    commands: listWhatsappBridgeCommandsForTenant(config),
    agentCommands: listWhatsappBridgeCommandsForAgent(config),
    helpText: buildDynamicWhatsappAgentHelp(config),
    catalog: WHATSAPP_BRIDGE_COMMAND_CATALOG,
  };
}

export async function patchWhatsappBridgeCommandsConfig(
  clientId: string,
  patch: Partial<WhatsappBridgeCommandsConfig> & {
    upsertCustom?: WhatsappBridgeCustomCommand;
    deleteCustomId?: string;
    addFromCatalogId?: string;
    catalogActionUrl?: string;
  },
): Promise<ReturnType<typeof getWhatsappBridgeCommandsPayload>> {
  const settings = await InboxSettings.getOrCreate(clientId);
  const current = await loadWhatsappBridgeCommandsConfig(clientId);

  const next: WhatsappBridgeCommandsConfig = {
    enabled: patch.enabled !== undefined ? Boolean(patch.enabled) : current.enabled,
    systemOverrides: patch.systemOverrides ?? current.systemOverrides,
    customCommands: [...(patch.customCommands ?? current.customCommands)],
  };

  if (patch.upsertCustom) {
    const err = validateCustomCommandName(patch.upsertCustom.command);
    if (err) throw new Error(err);
    const normalized = normalizeCustomCommandName(patch.upsertCustom.command);
    const duplicate = next.customCommands.some(
      c => c.command === normalized && c.id !== patch.upsertCustom!.id,
    );
    if (duplicate) throw new Error(`Comando !${normalized} já existe.`);

    const now = new Date().toISOString();
    const existingIdx = next.customCommands.findIndex(c => c.id === patch.upsertCustom!.id);
    const item: WhatsappBridgeCustomCommand = {
      ...patch.upsertCustom,
      id: patch.upsertCustom.id || randomUUID(),
      command: normalized,
      syntax: patch.upsertCustom.syntax?.trim() || `!${normalized}${patch.upsertCustom.requiresTicketRef ? ' TK-…' : ''}`,
      updatedAt: now,
      createdAt: patch.upsertCustom.createdAt ?? now,
    };
    if (existingIdx >= 0) {
      next.customCommands[existingIdx] = { ...next.customCommands[existingIdx], ...item };
    } else {
      next.customCommands.push(item);
    }
  }

  if (patch.deleteCustomId) {
    next.customCommands = next.customCommands.filter(c => c.id !== patch.deleteCustomId);
  }

  if (patch.addFromCatalogId) {
    const catalogItem = WHATSAPP_BRIDGE_COMMAND_CATALOG.find(c => c.id === patch.addFromCatalogId);
    if (!catalogItem) throw new Error('Item do catálogo não encontrado.');
    if (next.customCommands.some(c => c.command === catalogItem.command)) {
      throw new Error(`Comando !${catalogItem.command} já está ativo.`);
    }
    next.customCommands.push(
      catalogItemToCustomCommand(catalogItem, patch.catalogActionUrl),
    );
  }

  if (patch.systemOverrides) {
    for (const o of patch.systemOverrides) {
      const def = WHATSAPP_BRIDGE_SYSTEM_COMMANDS.find(d => d.id === o.commandId);
      if (!def) continue;
      if (def.core && o.enabled === false) {
        throw new Error(`Comando !${def.command} é essencial e não pode ser desativado.`);
      }
    }
  }

  settings.whatsappBridgeCommandsConfig = next;
  await settings.save();
  return getWhatsappBridgeCommandsPayload(clientId);
}

export { validateCustomCommandName, normalizeCustomCommandName };
