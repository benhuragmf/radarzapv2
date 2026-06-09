/**
 * Contrato REST do painel RadarZap — base para integrações externas.
 * Autenticação: cookie de sessão (painel) ou header X-API-Key (integrações).
 */
export const DASHBOARD_API_BASE = '/api';

export const OPENAPI_DASHBOARD = {
  openapi: '3.0.3',
  info: {
    title: 'RadarZap Dashboard API',
    version: '1.0.0',
    description:
      'API REST consumida pelo painel e por integrações. Use X-API-Key para chamadas server-to-server.',
  },
  servers: [{ url: DASHBOARD_API_BASE }],
  security: [{ ApiKeyAuth: [] }, { SessionCookie: [] }],
  components: {
    securitySchemes: {
      ApiKeyAuth: {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key',
      },
      SessionCookie: {
        type: 'apiKey',
        in: 'cookie',
        name: 'connect.sid',
      },
    },
  },
  paths: {
    '/campaigns': {
      get: { summary: 'Listar campanhas/envios', tags: ['Mensagens'] },
      post: { summary: 'Criar campanha (envio ou agendamento)', tags: ['Mensagens'] },
    },
    '/campaigns/validate-destinations': {
      post: { summary: 'Validar destinos antes do envio', tags: ['Mensagens'] },
    },
    '/destinations': {
      get: { summary: 'Listar contatos e grupos WA', tags: ['Contatos'] },
      post: { summary: 'Criar destino', tags: ['Contatos'] },
    },
    '/contact-groups': {
      get: { summary: 'Listar grupos de contato', tags: ['Contatos'] },
      post: { summary: 'Criar grupo de contato', tags: ['Contatos'] },
    },
    '/platform/automations': {
      get: { summary: 'Listar automações', tags: ['Automações'] },
      post: { summary: 'Criar automação', tags: ['Automações'] },
    },
    '/sessions': {
      get: { summary: 'Status das sessões WhatsApp', tags: ['WhatsApp'] },
    },
    '/status-posts': {
      get: { summary: 'Listar status WhatsApp (stories) agendados e histórico', tags: ['WhatsApp'] },
      post: { summary: 'Publicar ou agendar status (texto ou imagem)', tags: ['WhatsApp'] },
    },
    '/status-posts/audience-preview': {
      get: {
        summary: 'Prévia de audiência (modos RadarZap — opcional)',
        tags: ['WhatsApp'],
      },
    },
    '/queue': {
      get: { summary: 'Estatísticas da fila', tags: ['Operação'] },
    },
    '/logs': {
      get: { summary: 'Logs (filtros: level, service, tenant=1)', tags: ['Operação'] },
    },
    '/integrations/api-keys': {
      get: { summary: 'Listar chaves (prefixo apenas)', tags: ['Integrações'] },
      post: { summary: 'Gerar nova chave — retorna valor completo uma vez', tags: ['Integrações'] },
    },
    '/integrations/webhooks': {
      get: { summary: 'Listar webhooks', tags: ['Integrações'] },
      post: { summary: 'Registrar webhook', tags: ['Integrações'] },
    },
    '/integrations/playground': {
      post: { summary: 'Testar envio (destino cadastrado + WA conectado)', tags: ['Integrações'] },
    },
    '/integrations/rate-limit': {
      get: { summary: 'Limites e uso do plano (mensagens/dia, janela API)', tags: ['Integrações'] },
    },
    '/integrations/openapi': {
      get: { summary: 'Este contrato OpenAPI (JSON)', tags: ['Integrações'] },
    },
    '/billing/me': {
      get: { summary: 'Plano, limites e uso (rate limit)', tags: ['Conta'] },
    },
    '/billing/pricing': {
      get: { summary: 'Catálogo de planos e status Stripe', tags: ['Conta'] },
    },
    '/billing/subscription': {
      get: { summary: 'Assinatura da organização (status, expiração, pedidos)', tags: ['Conta'] },
    },
    '/billing/checkout': {
      post: { summary: 'Inicia checkout Stripe (redirect URL)', tags: ['Conta'] },
    },
    '/billing/confirm': {
      post: { summary: 'Confirma sessão após redirect Stripe', tags: ['Conta'] },
    },
    '/billing/admin/orders': {
      get: { summary: 'Lista pedidos Stripe (admin)', tags: ['Admin'] },
    },
    '/tenant-backup/export': {
      get: {
        summary: 'Exportar backup JSON da organização (sem secrets de API/webhook)',
        tags: ['Conta'],
      },
    },
    '/tenant-backup/import': {
      post: {
        summary: 'Importar backup JSON ({ backup, replace? })',
        tags: ['Conta'],
      },
    },
    '/inbox/settings': {
      get: { summary: 'Configurações do Inbox (incl. CSAT)', tags: ['Inbox'] },
      patch: { summary: 'Atualizar configurações (csatEnabled, csatPrompt, csatThankYou)', tags: ['Inbox'] },
    },
    '/admin/organizations': {
      get: { summary: 'Listar organizações (admin)', tags: ['Admin'] },
    },
    '/admin/organizations/{id}/plan': {
      patch: { summary: 'Alterar plano de uma organização (admin)', tags: ['Admin'] },
    },
    '/admin/integrations-overview': {
      get: { summary: 'Métricas globais de integrações e billing', tags: ['Admin'] },
    },
    '/integrations/whatsapp/cloud/webhook': {
      get: { summary: 'Verificação webhook Meta (hub.verify_token)', tags: ['WhatsApp'] },
      post: { summary: 'Inbound mensagens/status Cloud API (Meta)', tags: ['WhatsApp'] },
    },
  },
} as const;

export const WEBHOOK_PAYLOAD_EXAMPLE = {
  event: 'campaign.sent',
  timestamp: '2026-06-04T12:00:00.000Z',
  organizationId: '…',
  data: {
    campaignId: '…',
    title: 'Campanha teste',
    status: 'completed',
    destinationsCount: 3,
  },
};
