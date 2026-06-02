# WhatsApp Service

Serviço responsável por gerenciar sessões WhatsApp, enviar mensagens e validar destinos dentro do pipeline do RadarZap.

Utiliza a biblioteca [@whiskeysockets/baileys](https://github.com/WhiskeySockets/Baileys) para integração com WhatsApp Web em modo headless.

---

## Arquivos

| Arquivo | Descrição |
|---------|-----------|
| `WhatsAppService.ts` | Serviço principal — sessões, envio, validação, rate limit |
| `WhatsAppServiceIntegration.ts` | Camada de integração com a fila BullMQ |
| `MessageFormatter.ts` | Formatação de mensagens antes do envio |
| `validation.ts` | Validações de entrada |

---

## Funcionalidades

### Sessões
- Criação de sessão com QR code enviado automaticamente ao Discord
- Persistência de sessão em arquivos + MongoDB
- Reconexão automática com backoff exponencial
- Health check a cada 30 segundos
- Circuit breaker (threshold: 3 falhas)

### Envio de Mensagens
- Envio individual com validação de consentimento
- Envio em bulk com delay de 3s entre mensagens
- Rate limiting: 1 mensagem por 3 segundos por usuário
- Retry automático: até 3 tentativas com backoff exponencial
- Suporte a grupos e contatos individuais

### Destinos
- Validação em tempo real se o contato/grupo existe no WhatsApp
- Limpeza automática de destinos inválidos (a cada 24h)
- Gerenciamento de consentimento (LGPD/GDPR)
- Metadados de grupos (nome, participantes, admin)

---

## Filas BullMQ

| Fila | Jobs |
|------|------|
| `whatsapp-connection` | `connect-whatsapp`, `disconnect-whatsapp` |
| `whatsapp-sending` | `send-message`, `send-test-message`, `send-bulk-messages` |
| `whatsapp-destination-management` | `add-destination`, `cleanup-destinations` |

---

## Uso básico

```typescript
import { WhatsAppService } from '@/services/whatsapp';

const service = new WhatsAppService();
await service.start();
```

### Com integração de fila

```typescript
import { WhatsAppServiceIntegration } from '@/services/whatsapp';

const integration = new WhatsAppServiceIntegration();
await integration.initialize();
await integration.scheduleHealthChecks();
await integration.scheduleDestinationCleanup();
```

---

## Variáveis de ambiente

```env
WHATSAPP_SESSION_TIMEOUT=3600000     # timeout de inatividade (ms) — padrão 1h
WHATSAPP_RECONNECT_ATTEMPTS=3        # tentativas de reconexão
WHATSAPP_HEADLESS=true               # modo headless (sempre true em produção)
WHATSAPP_RATE_LIMIT=20               # mensagens por minuto por sessão
```

---

## Limites e proteções

| Proteção | Valor padrão |
|----------|-------------|
| Delay entre mensagens | 3 segundos |
| Máximo por minuto | 20 mensagens |
| Tentativas de retry | 3 |
| Timeout de sessão | 1 hora |
| Health check | 30 segundos |
| Limpeza de destinos | 24 horas |
| Circuit breaker threshold | 3 falhas |

---

## Documentação completa

Ver `docs/RADARZAP-01-VISAO-GERAL.md` para visão geral do sistema.
Ver `docs/RADARZAP-04-PAINEL-DEPLOY-PROXIMOS-PASSOS.md` para roadmap.
