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
    schemas: {
      ContactKind: {
        type: 'string',
        enum: ['lead', 'client', 'prospect', 'partner', 'internal', 'blocked'],
      },
      ContactOrigin: {
        type: 'string',
        enum: ['whatsapp', 'webchat', 'form', 'manual', 'csv', 'wa_group', 'api', 'campaign'],
      },
      SendPermission: {
        type: 'string',
        enum: ['opt_in_accepted', 'pending', 'no_consent', 'opt_out', 'blocked'],
      },
      CommercialStatus: {
        type: 'string',
        enum: [
          'new',
          'in_service',
          'waiting_client',
          'waiting_agent',
          'qualified',
          'opportunity',
          'converted',
          'after_sale',
          'inactive',
          'lost',
        ],
      },
      ContactTemperature: {
        type: 'string',
        enum: ['cold', 'warm', 'hot', 'vip', 'risk'],
      },
      ContactClassification: {
        type: 'object',
        description: 'Classificação inferida + campos persistidos do contato',
        properties: {
          kind: { $ref: '#/components/schemas/ContactKind' },
          origin: { $ref: '#/components/schemas/ContactOrigin' },
          permission: { $ref: '#/components/schemas/SendPermission' },
          commercialStatus: { $ref: '#/components/schemas/CommercialStatus' },
          temperature: { $ref: '#/components/schemas/ContactTemperature' },
          phoneQuality: { type: 'string' },
          sendBlockReason: { type: 'string', nullable: true },
          campaignSelectable: { type: 'boolean' },
        },
      },
      SmartSegmentPreset: {
        type: 'object',
        properties: {
          id: {
            type: 'string',
            enum: [
              'opt_in_leads',
              'active_clients',
              'hot_leads',
              'pending_consent',
              'blocked_send',
            ],
          },
          label: { type: 'string' },
          description: { type: 'string' },
          count: { type: 'integer' },
        },
      },
      DestinationWithClassification: {
        type: 'object',
        description: 'Contato ou grupo com classification em GET /destinations',
        properties: {
          _id: { type: 'string' },
          type: { type: 'string', enum: ['contact', 'group'] },
          name: { type: 'string' },
          identifier: { type: 'string' },
          contactKind: { $ref: '#/components/schemas/ContactKind' },
          contactOrigin: { $ref: '#/components/schemas/ContactOrigin' },
          commercialStatus: { $ref: '#/components/schemas/CommercialStatus' },
          temperature: { $ref: '#/components/schemas/ContactTemperature' },
          classification: { $ref: '#/components/schemas/ContactClassification' },
        },
      },
      AutomationClassificationFilter: {
        type: 'object',
        description: 'Filtros opcionais em POST/PATCH /platform/automations',
        properties: {
          destinationSmartSegmentId: {
            type: 'string',
            enum: [
              'opt_in_leads',
              'active_clients',
              'hot_leads',
              'pending_consent',
              'blocked_send',
            ],
          },
          destinationFilterKinds: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContactKind' },
          },
          destinationFilterPermissions: {
            type: 'array',
            items: { $ref: '#/components/schemas/SendPermission' },
          },
          destinationFilterTemperatures: {
            type: 'array',
            items: { $ref: '#/components/schemas/ContactTemperature' },
          },
          destinationCampaignSelectableOnly: { type: 'boolean' },
        },
      },
      LeadClassificationStats: {
        type: 'object',
        properties: {
          totalLeads: { type: 'integer' },
          linkedLeads: { type: 'integer' },
          unlinkedLeads: { type: 'integer' },
          withOptIn: { type: 'integer' },
          pendingConsent: { type: 'integer' },
          blockedCampaign: { type: 'integer' },
          hotWarm: { type: 'integer' },
          byKind: { type: 'object', additionalProperties: { type: 'integer' } },
        },
      },
      LeadCaptureWithClassification: {
        type: 'object',
        description: 'Lead com classificação do contato CRM vinculado (quando destinationId existe)',
        properties: {
          id: { type: 'string' },
          classification: { $ref: '#/components/schemas/ContactClassification' },
        },
      },
      DestinationClassificationStats: {
        type: 'object',
        properties: {
          totalContacts: { type: 'integer' },
          campaignSelectable: { type: 'integer' },
          campaignBlocked: { type: 'integer' },
          backfillPending: { type: 'integer' },
          smartSegments: {
            type: 'array',
            items: { $ref: '#/components/schemas/SmartSegmentPreset' },
          },
          byKind: { type: 'object', additionalProperties: { type: 'integer' } },
          byPermission: { type: 'object', additionalProperties: { type: 'integer' } },
          byOrigin: { type: 'object', additionalProperties: { type: 'integer' } },
          byTemperature: { type: 'object', additionalProperties: { type: 'integer' } },
          byCommercialStatus: { type: 'object', additionalProperties: { type: 'integer' } },
          byPhoneQuality: { type: 'object', additionalProperties: { type: 'integer' } },
        },
      },
      AdminOpsSummary: {
        type: 'object',
        description:
          'Agregador ops global. Campos omitidos: Stripe keys, sessionData, QR, tokens, meta bruto, e-mail owner, job.data.',
        properties: {
          generatedAt: { type: 'string', format: 'date-time' },
          system: { type: 'object' },
          services: { type: 'object' },
          tenants: { type: 'object' },
          operations: { type: 'object' },
          ai: { type: 'object' },
          billing: {
            type: 'object',
            properties: {
              stripeMode: { type: 'string', enum: ['off', 'test', 'live', 'unknown'] },
            },
          },
          security: { type: 'object' },
          alerts: { type: 'array', items: { type: 'object' } },
          links: { type: 'object' },
        },
      },
      AdminOpsOrganizationRow: {
        type: 'object',
        description: 'Row pública — sem owner, e-mail, stripeSubscriptionId, sessionData.',
        properties: {
          id: { type: 'string' },
          name: { type: 'string' },
          plan: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
          billingStatus: { type: 'string' },
          planExpiresAt: { type: 'string', format: 'date-time', nullable: true },
          createdAt: { type: 'string', format: 'date-time' },
          stripeModeHint: { type: 'string', enum: ['none', 'test', 'live'] },
          waConnected: { type: 'boolean' },
          membersCount: { type: 'integer' },
        },
      },
      AdminOpsOrganizationsPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/AdminOpsOrganizationRow' } },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          generatedAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminOpsSecurityEventRow: {
        type: 'object',
        description: 'Evento sanitizado — sem meta, payload, details ou tokens.',
        properties: {
          id: { type: 'string' },
          source: { type: 'string' },
          level: { type: 'string', enum: ['info', 'warning', 'critical', 'error'] },
          kind: { type: 'string' },
          title: { type: 'string' },
          message: { type: 'string' },
          organizationId: { type: 'string' },
          organizationName: { type: 'string' },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      AdminOpsSecurityEventsPage: {
        type: 'object',
        properties: {
          items: { type: 'array', items: { $ref: '#/components/schemas/AdminOpsSecurityEventRow' } },
          page: { type: 'integer' },
          limit: { type: 'integer' },
          total: { type: 'integer' },
          totalPages: { type: 'integer' },
          truncated: { type: 'boolean' },
          generatedAt: { type: 'string', format: 'date-time' },
          window: {
            type: 'object',
            properties: {
              from: { type: 'string', format: 'date-time' },
              to: { type: 'string', format: 'date-time' },
            },
          },
        },
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
      get: {
        summary: 'Listar contatos e grupos WA',
        description:
          'Cada contato inclui `classification`. Query opcional `class` (opt_in, pending, hot, blocked, lead, client, prospect) filtra contatos no servidor.',
        tags: ['Contatos'],
        parameters: [
          {
            name: 'class',
            in: 'query',
            schema: {
              type: 'string',
              enum: [
                'opt_in',
                'pending',
                'hot',
                'blocked',
                'lead',
                'client',
                'prospect',
                'partner',
                'internal',
                'blocked',
              ],
            },
          },
        ],
        responses: {
          '200': {
            description: 'Lista de destinos',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/DestinationWithClassification' },
                },
              },
            },
          },
        },
      },
      post: {
        summary: 'Criar destino',
        description: 'Aceita contactKind, contactOrigin, commercialStatus, temperature opcionais.',
        tags: ['Contatos'],
      },
    },
    '/destinations/{id}': {
      patch: {
        summary: 'Atualizar contato (incl. classificação)',
        tags: ['Contatos'],
      },
    },
    '/destinations/smart-segments': {
      get: {
        summary: 'Segmentos dinâmicos por classificação',
        tags: ['Contatos'],
        responses: {
          '200': {
            description: 'Presets com contagem',
            content: {
              'application/json': {
                schema: {
                  type: 'array',
                  items: { $ref: '#/components/schemas/SmartSegmentPreset' },
                },
              },
            },
          },
        },
      },
    },
    '/destinations/smart-segments/{presetId}/members': {
      get: {
        summary: 'Membros de um segmento dinâmico',
        tags: ['Contatos'],
      },
    },
    '/destinations/classification-stats': {
      get: {
        summary: 'Estatísticas agregadas de classificação CRM',
        description: 'Totais por dimensão, segmentos dinâmicos e pendências de backfill.',
        tags: ['Contatos'],
        responses: {
          '200': {
            description: 'Relatório agregado',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/DestinationClassificationStats' },
              },
            },
          },
        },
      },
    },
    '/destinations/classification-stats/export-csv': {
      get: { summary: 'Exportar resumo de classificação em CSV', tags: ['Contatos'] },
    },
    '/destinations/classification-export-csv': {
      get: {
        summary: 'Exportar contatos com colunas de classificação',
        description: 'Query opcional `class` para exportar subconjunto.',
        tags: ['Contatos'],
        parameters: [{ name: 'class', in: 'query', schema: { type: 'string' } }],
      },
    },
    '/destinations/classification-backfill-status': {
      get: {
        summary: 'Contatos pendentes de backfill de classificação',
        tags: ['Contatos'],
      },
    },
    '/destinations/backfill-classification': {
      post: {
        summary: 'Persistir classificação inferida em contatos antigos',
        tags: ['Contatos'],
      },
    },
    '/contact-groups': {
      get: { summary: 'Listar grupos de contato', tags: ['Contatos'] },
      post: { summary: 'Criar grupo de contato', tags: ['Contatos'] },
    },
    '/leads/classification-stats': {
      get: {
        summary: 'Estatísticas de classificação CRM nos leads',
        description:
          'Contagens de opt-in, pendências, quentes/mornos, bloqueio de campanha e leads sem contato CRM.',
        tags: ['Leads'],
        responses: {
          '200': {
            description: 'Totais agregados',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/LeadClassificationStats' },
              },
            },
          },
        },
      },
    },
    '/leads/captures': {
      get: {
        summary: 'Listar capturas de lead',
        description:
          'Cada item pode incluir `classification` do contato vinculado. Filtros: classificationKind, classificationOptInOnly, classificationPendingOnly, classificationHotOnly, classificationBlockedOnly, unlinkedOnly.',
        tags: ['Leads'],
        parameters: [
          { name: 'classificationKind', in: 'query', schema: { $ref: '#/components/schemas/ContactKind' } },
          { name: 'classificationOptInOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'classificationPendingOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'classificationHotOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'classificationBlockedOnly', in: 'query', schema: { type: 'boolean' } },
          { name: 'unlinkedOnly', in: 'query', schema: { type: 'boolean' } },
        ],
        responses: {
          '200': {
            description: 'Lista paginada',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    total: { type: 'integer' },
                    items: {
                      type: 'array',
                      items: { $ref: '#/components/schemas/LeadCaptureWithClassification' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    '/platform/automations': {
      get: { summary: 'Listar automações', tags: ['Automações'] },
      post: {
        summary: 'Criar automação',
        description:
          'Suporta filtros por listas (contactGroupIds), segmento dinâmico (destinationSmartSegmentId) e classificação (destinationFilterKinds, destinationFilterPermissions, destinationCampaignSelectableOnly).',
        tags: ['Automações'],
      },
    },
    '/platform/automations/{id}': {
      patch: {
        summary: 'Atualizar automação (incl. filtros de classificação)',
        tags: ['Automações'],
      },
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
    '/inbox/alerts': {
      get: {
        summary: 'Preferências de alerta do Inbox (som + notificações do sistema)',
        description: 'Capability: inbox:reply. Retorna alertSoundEnabled, alertOnNewChat, alertOnNewMessage, alertBrowserNotify.',
        tags: ['Inbox'],
      },
    },
    '/inbox/settings': {
      get: { summary: 'Configurações do Inbox (incl. CSAT)', tags: ['Inbox'] },
      patch: { summary: 'Atualizar configurações (csatEnabled, csatPrompt, csatThankYou)', tags: ['Inbox'] },
    },
    '/admin/organizations': {
      get: { summary: 'Listar organizações (admin legado)', tags: ['Admin'] },
    },
    '/admin/organizations/{id}/plan': {
      patch: {
        summary: 'Alterar plano de uma organização (legado — deprecado)',
        description:
          'Deprecado: use PATCH /admin/ops/organizations/{id}/plan com motivo (AuditLog). Delega ao serviço Ops.',
        tags: ['Admin'],
      },
    },
    '/admin/ops/summary': {
      get: {
        summary: 'Agregador operacional global (staff) — métricas cross-tenant sanitizadas',
        description:
          'Capability: dashboard:global. Query opcional refresh=1 ignora cache Redis (30s). Não expõe secrets, sessionData, QR ou meta bruto.',
        tags: ['Admin Ops'],
        parameters: [
          { name: 'refresh', in: 'query', schema: { type: 'string', enum: ['1'] }, required: false },
        ],
        responses: {
          '200': { description: 'AdminOpsSummary', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOpsSummary' } } } },
          '403': { description: 'Sem dashboard:global' },
        },
      },
    },
    '/admin/ops/organizations': {
      get: {
        summary: 'Listagem paginada de organizações (staff)',
        description: 'Capability: dashboard:global. Filtros: page, limit (max 100), plan, status, search, sort.',
        tags: ['Admin Ops'],
        responses: {
          '200': { description: 'AdminOpsOrganizationsPage', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOpsOrganizationsPage' } } } },
        },
      },
    },
    '/admin/ops/organizations/{id}/plan': {
      patch: {
        summary: 'Alterar plano manual (staff)',
        description: 'Capability: system:plans:manage. Body: plan, expiresAt?, reason (5–300 chars). Audit admin.plan.changed.',
        tags: ['Admin Ops'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['plan', 'reason'],
                properties: {
                  plan: { type: 'string', enum: ['free', 'starter', 'pro', 'enterprise'] },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                  reason: { type: 'string', minLength: 5, maxLength: 300 },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Organização atualizada' }, '403': { description: 'Sem system:plans:manage' } },
      },
    },
    '/admin/ops/organizations/{id}/trial/extend': {
      post: {
        summary: 'Estender trial manual',
        description: 'Capability: system:plans:manage. Body: days (1–90), reason, plan?. Audit admin.trial.extended.',
        tags: ['Admin Ops'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['days', 'reason'],
                properties: {
                  days: { type: 'integer', minimum: 1, maximum: 90 },
                  reason: { type: 'string', minLength: 5, maxLength: 300 },
                  plan: { type: 'string', enum: ['starter', 'pro', 'enterprise'] },
                },
              },
            },
          },
        },
        responses: { '200': { description: 'Trial estendido' } },
      },
    },
    '/admin/ops/organizations/{id}/trial/cancel': {
      post: {
        summary: 'Cancelar trial / downgrade free',
        description: 'Capability: system:plans:manage. Body: reason. Audit admin.trial.cancelled.',
        tags: ['Admin Ops'],
        parameters: [{ name: 'id', in: 'path', required: true, schema: { type: 'string' } }],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['reason'],
                properties: { reason: { type: 'string', minLength: 5, maxLength: 300 } },
              },
            },
          },
        },
        responses: { '200': { description: 'Trial cancelado' } },
      },
    },
    '/admin/ops/security-events': {
      get: {
        summary: 'Feed global de eventos críticos sanitizados',
        description:
          'Capability: dashboard:global. Fontes: AttendanceEvent, SystemLog (warn/error), AuditLog. Query: page, limit (max 100), kind, level, source, from, to (ISO). Sem meta/payload/tokens.',
        tags: ['Admin Ops'],
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1, minimum: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 25, maximum: 100 } },
          { name: 'kind', in: 'query', schema: { type: 'string' } },
          { name: 'level', in: 'query', schema: { type: 'string', enum: ['info', 'warning', 'critical', 'error'] } },
          { name: 'source', in: 'query', schema: { type: 'string' } },
          { name: 'from', in: 'query', schema: { type: 'string', format: 'date-time' } },
          { name: 'to', in: 'query', schema: { type: 'string', format: 'date-time' } },
        ],
        responses: {
          '200': { description: 'AdminOpsSecurityEventsPage', content: { 'application/json': { schema: { $ref: '#/components/schemas/AdminOpsSecurityEventsPage' } } } },
        },
      },
    },
    '/admin/integrations-overview': {
      get: { summary: 'Métricas globais de integrações e billing', tags: ['Admin'] },
    },
    '/integrations/whatsapp/cloud/webhook': {
      get: { summary: 'Verificação webhook Meta (hub.verify_token)', tags: ['WhatsApp'] },
      post: { summary: 'Inbound mensagens/status Cloud API (Meta)', tags: ['WhatsApp'] },
    },
    '/discord/health': {
      get: { summary: 'Status do bot Discord (token, guilds, online)', tags: ['Discord'] },
    },
    '/discord/stats': {
      get: {
        summary: 'Métricas de eventos Discord (7–30 dias)',
        tags: ['Discord'],
        parameters: [
          { name: 'guildId', in: 'query', schema: { type: 'string' } },
          { name: 'days', in: 'query', schema: { type: 'integer', minimum: 1, maximum: 30 } },
        ],
      },
    },
    '/discord/audit': {
      get: {
        summary: 'Auditoria de mudanças em regras e monitores Discord',
        tags: ['Discord'],
        parameters: [{ name: 'limit', in: 'query', schema: { type: 'integer', maximum: 100 } }],
      },
    },
    '/discord/settings': {
      get: { summary: 'Configurações Discord do tenant (dry-run, multi-regra)', tags: ['Discord'] },
      patch: {
        summary: 'Atualiza configurações Discord globais do tenant',
        tags: ['Discord'],
        requestBody: {
          content: {
            'application/json': {
              schema: {
                type: 'object',
                properties: {
                  dryRun: { type: 'boolean' },
                  multiRulePerMessage: { type: 'boolean' },
                },
              },
            },
          },
        },
      },
    },
    '/integrations/discord/inbound/messages': {
      post: {
        summary: 'Inbound mensagem Discord (sem bot gateway)',
        tags: ['Discord', 'Integrations'],
        description: 'Headers: X-API-Key, Idempotency-Key. Requer inboundEnabled no tenant.',
      },
    },
    '/integrations/discord/inbound/events': {
      post: {
        summary: 'Inbound evento Discord (voz/membros/edição/reação)',
        tags: ['Discord', 'Integrations'],
      },
    },
    '/discord/bot-invite-url': {
      get: { summary: 'URL OAuth para convidar o bot ao servidor', tags: ['Discord'] },
    },
    '/discord/guilds': {
      get: { summary: 'Servidores Discord onde o bot está presente', tags: ['Discord'] },
    },
    '/discord/guilds/{guildId}/channels': {
      get: {
        summary: 'Canais do servidor (filtro texto/voz)',
        tags: ['Discord'],
        parameters: [
          { name: 'guildId', in: 'path', required: true, schema: { type: 'string' } },
          { name: 'type', in: 'query', schema: { type: 'string', enum: ['text', 'voice'] } },
        ],
      },
    },
    '/discord/guilds/{guildId}/roles': {
      get: {
        summary: 'Cargos do servidor (filtro de regras)',
        tags: ['Discord'],
        parameters: [{ name: 'guildId', in: 'path', required: true, schema: { type: 'string' } }],
      },
    },
    '/channels': {
      get: { summary: 'Monitores Discord configurados', tags: ['Discord'] },
      post: { summary: 'Adicionar monitor (texto, voz ou eventos)', tags: ['Discord'] },
    },
    '/channels/{id}/filters': {
      patch: { summary: 'Atualizar filtros do monitor', tags: ['Discord'] },
    },
    '/channels/{id}/history': {
      get: { summary: 'Histórico de capturas do monitor (90 dias)', tags: ['Discord'] },
    },
    '/rules': {
      get: { summary: 'Listar regras Discord → WhatsApp', tags: ['Discord'] },
      post: { summary: 'Criar regra (multi-gatilho, cargos, filtros)', tags: ['Discord'] },
    },
    '/rules/preview': {
      post: { summary: 'Prévia de regra sem enviar ao WhatsApp', tags: ['Discord'] },
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
