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
      post: { summary: 'Testar envio (mesmo contrato de /test-send)', tags: ['Integrações'] },
    },
    '/billing/me': {
      get: { summary: 'Plano, limites e uso (rate limit)', tags: ['Conta'] },
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
