/** Comandos operacionais WhatsApp bridge — configuração por tenant. */

export type WhatsappBridgeSystemCommandId =
  | 'assumir'
  | 'abrir'
  | 'token'
  | 'nota'
  | 'ticket'
  | 'abertos'
  | 'meus'
  | 'encerrarchat'
  | 'encerrar'
  | 'ajuda';

export type WhatsappBridgeCustomActionPreset =
  | 'static'
  | 'payment_link'
  | 'invoice_2via'
  | 'catalog_link'
  | 'contract_link'
  | 'webhook';

export interface WhatsappBridgeSystemCommandDef {
  id: WhatsappBridgeSystemCommandId;
  /** Nome principal (!assumir) */
  command: string;
  aliases: string[];
  label: string;
  description: string;
  syntax: string;
  category: 'attendance' | 'query' | 'close' | 'help';
  /** Comando core — não pode ser removido, só pausar */
  core: boolean;
  requiresTicketRef: boolean;
}

export interface WhatsappBridgeSystemCommandOverride {
  commandId: WhatsappBridgeSystemCommandId;
  enabled: boolean;
  paused: boolean;
  customDescription?: string;
}

export interface WhatsappBridgeCustomCommand {
  id: string;
  command: string;
  label: string;
  description: string;
  syntax: string;
  enabled: boolean;
  paused: boolean;
  requiresTicketRef: boolean;
  responseTemplate: string;
  sendToVisitor: boolean;
  visitorMessageTemplate?: string;
  actionPreset: WhatsappBridgeCustomActionPreset;
  /** URL fixa ou webhook quando actionPreset != static */
  actionUrl?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface WhatsappBridgeCommandsConfig {
  enabled: boolean;
  systemOverrides: WhatsappBridgeSystemCommandOverride[];
  customCommands: WhatsappBridgeCustomCommand[];
}

export interface WhatsappBridgeCommandListItem {
  id: string;
  command: string;
  displayCommand: string;
  label: string;
  description: string;
  syntax: string;
  category: string;
  kind: 'system' | 'custom' | 'catalog';
  core: boolean;
  enabled: boolean;
  paused: boolean;
  available: boolean;
  requiresTicketRef: boolean;
  actionPreset?: WhatsappBridgeCustomActionPreset;
}

export interface WhatsappBridgeCommandCatalogItem {
  id: string;
  command: string;
  label: string;
  description: string;
  syntax: string;
  responseTemplate: string;
  visitorMessageTemplate?: string;
  actionPreset: WhatsappBridgeCustomActionPreset;
  requiresTicketRef: boolean;
  integrationNote: string;
  category: 'finance' | 'sales' | 'support' | 'operations';
}

export const DEFAULT_WHATSAPP_BRIDGE_COMMANDS_CONFIG: WhatsappBridgeCommandsConfig = {
  enabled: true,
  systemOverrides: [],
  customCommands: [],
};

export const WHATSAPP_BRIDGE_SYSTEM_COMMANDS: WhatsappBridgeSystemCommandDef[] = [
  {
    id: 'assumir',
    command: 'assumir',
    aliases: [],
    label: 'Assumir conversa',
    description: 'Assume conversa do site e ativa bridge WhatsApp (não abre chamado formal).',
    syntax: '!assumir TK-…',
    category: 'attendance',
    core: true,
    requiresTicketRef: true,
  },
  {
    id: 'abrir',
    command: 'abrir',
    aliases: ['abrirchamado'],
    label: 'Abrir chamado',
    description: 'Abre chamado formal e envia token ao visitante. Texto após TK vira nota interna.',
    syntax: '!abrir TK-… [motivo]',
    category: 'attendance',
    core: true,
    requiresTicketRef: true,
  },
  {
    id: 'token',
    command: 'token',
    aliases: [],
    label: 'Reenviar token',
    description: 'Reenvia token de consulta ao visitante no chat do site.',
    syntax: '!token TK-…',
    category: 'attendance',
    core: false,
    requiresTicketRef: true,
  },
  {
    id: 'nota',
    command: 'nota',
    aliases: [],
    label: 'Nota interna',
    description: 'Registra nota interna no chamado (não vai ao cliente).',
    syntax: '!nota TK-… texto',
    category: 'attendance',
    core: false,
    requiresTicketRef: true,
  },
  {
    id: 'ticket',
    command: 'ticket',
    aliases: [],
    label: 'Resumo do chamado',
    description: 'Exibe status, canal, responsável e última mensagem.',
    syntax: '!ticket TK-…',
    category: 'query',
    core: false,
    requiresTicketRef: true,
  },
  {
    id: 'abertos',
    command: 'abertos',
    aliases: ['chamados'],
    label: 'Chamados abertos',
    description: 'Lista chamados abertos e conversas do site aguardando abertura.',
    syntax: '!abertos',
    category: 'query',
    core: false,
    requiresTicketRef: false,
  },
  {
    id: 'meus',
    command: 'meus',
    aliases: [],
    label: 'Meus atendimentos',
    description: 'Lista chamados e conversas atribuídos a você.',
    syntax: '!meus',
    category: 'query',
    core: false,
    requiresTicketRef: false,
  },
  {
    id: 'encerrarchat',
    command: 'encerrarchat',
    aliases: ['sairchat', 'fecharchat'],
    label: 'Encerrar chat do site',
    description: 'Encerra chat do visitante e desativa bridge. Chamado permanece no painel.',
    syntax: '!encerrarchat TK-…',
    category: 'close',
    core: false,
    requiresTicketRef: true,
  },
  {
    id: 'encerrar',
    command: 'encerrar',
    aliases: [],
    label: 'Arquivar chamado',
    description: 'Finaliza chamado, conversa e desativa bridge.',
    syntax: '!encerrar TK-…',
    category: 'close',
    core: true,
    requiresTicketRef: true,
  },
  {
    id: 'ajuda',
    command: 'ajuda',
    aliases: ['help'],
    label: 'Ajuda',
    description: 'Lista comandos disponíveis para sua empresa.',
    syntax: '!ajuda',
    category: 'help',
    core: true,
    requiresTicketRef: false,
  },
];

/** Catálogo sugerido — dono ativa e personaliza no painel. */
export const WHATSAPP_BRIDGE_COMMAND_CATALOG: WhatsappBridgeCommandCatalogItem[] = [
  {
    id: 'catalog-2via',
    command: '2via',
    label: 'Segunda via de boleto',
    description: 'Envia link ou instruções de 2ª via conforme o cliente/chamado.',
    syntax: '!2via TK-…',
    responseTemplate:
      '2ª via — {{ticketRef}}\nCliente: {{clientName}}\nLink: {{paymentLink}}\n(Confira no financeiro se o link estiver vazio.)',
    visitorMessageTemplate:
      'Olá {{clientName}}! Segue o link para 2ª via: {{paymentLink}}\nChamado: {{ticketRef}}',
    actionPreset: 'invoice_2via',
    requiresTicketRef: true,
    integrationNote: 'Use {{paymentLink}} no template. Futuro: integração billing/ERP.',
    category: 'finance',
  },
  {
    id: 'catalog-pix',
    command: 'pix',
    label: 'Link PIX / pagamento',
    description: 'Retorna link ou chave PIX configurada para o atendente reenviar.',
    syntax: '!pix TK-…',
    responseTemplate: 'PIX — {{ticketRef}}\nCliente: {{clientName}}\nPagamento: {{paymentLink}}',
    visitorMessageTemplate: 'Para pagamento via PIX: {{paymentLink}}\nRef.: {{ticketRef}}',
    actionPreset: 'payment_link',
    requiresTicketRef: true,
    integrationNote: 'Cadastre URL fixa em actionUrl ou use placeholder {{paymentLink}}.',
    category: 'finance',
  },
  {
    id: 'catalog-status',
    command: 'status',
    label: 'Status do pedido/contrato',
    description: 'Resumo rápido do status vinculado ao contato (template editável).',
    syntax: '!status TK-…',
    responseTemplate:
      'Status — {{ticketRef}}\nCliente: {{clientName}}\nConsulte o ERP e atualize o visitante se necessário.',
    actionPreset: 'static',
    requiresTicketRef: true,
    integrationNote: 'Template estático; integração ERP pode preencher campos no futuro.',
    category: 'operations',
  },
  {
    id: 'catalog-catalogo',
    command: 'catalogo',
    label: 'Link do catálogo',
    description: 'Envia link de catálogo/produtos ao atendente ou visitante.',
    syntax: '!catalogo TK-…',
    responseTemplate: 'Catálogo: {{paymentLink}}\nChamado: {{ticketRef}}',
    visitorMessageTemplate: 'Confira nosso catálogo: {{paymentLink}}',
    actionPreset: 'catalog_link',
    requiresTicketRef: false,
    integrationNote: 'Defina actionUrl com URL do catálogo da empresa.',
    category: 'sales',
  },
  {
    id: 'catalog-transferir',
    command: 'transferir',
    label: 'Solicitar transferência',
    description: 'Nota interna automática pedindo transferência de setor.',
    syntax: '!transferir TK-… @setor motivo',
    responseTemplate:
      'Transferência solicitada em {{ticketRef}} por {{agentName}}.\nMotivo: {{message}}\nAcione supervisor no painel.',
    actionPreset: 'static',
    requiresTicketRef: true,
    integrationNote: 'Complementa !nota; útil para equipes com muitos setores.',
    category: 'support',
  },
];
