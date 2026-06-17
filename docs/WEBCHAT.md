# Chat do site (WebChat)

Widget embedável para sites externos, com atendimento em tempo real no painel RadarZap.

## Visão geral

| Camada | Onde |
|--------|------|
| Widget JS | `/webchat/widget.js` — script vanilla para colar no HTML do site |
| API pública | `/api/webchat/public/*` — CORS aberto; sem cookie de sessão |
| API painel | `/api/webchat/*` — autenticada; caps `webchat:view`, `webchat:reply`, `webchat:manage` |
| Socket.io | Visitante: `auth.webchatVisitorToken`; agente: room `tenant:{clientId}` |
| Modelos | `WebChatWidget`, `WebChatConversation`, `WebChatMessage` |
| UI | `/platform/webchat` |

## Embed no site

1. Painel → **Atendimento → Chat do site** → aba **Widgets** → criar widget.
2. Copiar o snippet ou abrir **Testar** no painel → `/webchat/demo.html?key=wck_...`

```html
<script src="https://SEU-PAINEL/webchat/widget.js" data-widget-key="wck_..." async></script>
```

Em dev (`npm run dev` + `dashboard:frontend`), o Vite faz proxy de `/webchat` para a API (`:3001`).

### Páginas de teste (dev)

| URL | Uso |
|-----|-----|
| `http://localhost:5174/webchat/widget.html` | Página fixa com chave de dev embutida (editável via `?key=`) |
| `http://localhost:5174/webchat/demo.html?key=wck_...` | Demo genérica — exige `key` na URL |

Snippet equivalente ao `widget.html`:

```html
<script src="http://localhost:5174/webchat/widget.js" data-widget-key="wck_..." async></script>
```

3. Opcional: `data-base-url="https://SEU-PAINEL"` se o script for servido de outro host.

## Segurança

- **Domínios permitidos** no widget (vazio = qualquer origem).
- Token de visitante (`wcv_...`) armazenado com hash no Mongo; enviado em `X-WebChat-Visitor`.
- Socket do visitante exige token válido de conversa aberta.

## Fluxo

1. Widget carrega config (`GET .../widgets/:key/config`).
2. Visitante inicia sessão (`POST .../widgets/:key/sessions`) → recebe token + histórico.
3. Mensagens via REST + eventos `webchat:message` / `webchat:conversation`.
4. Agente responde no painel; visitante recebe em tempo real.

## Painel (2.9.2+)

- Abas **Abertas** / **Encerradas** na lista de conversas.
- Contador de não lidas (`GET /webchat/stats`).
- Som discreto ao receber mensagem do visitante (socket).
- **Reabrir** conversa encerrada (`POST /webchat/conversations/:id/reopen`).
- Indicador âmbar no menu **Chat do site** quando há não lidas (2.9.3).
- Notificação do navegador fora da página WebChat (2.9.3).
- Atribuição automática do agente na primeira resposta (2.9.3).

## Widget visitante

- Ao encerrar, exibe **Nova conversa** (limpa sessão e abre novo atendimento).
- Mensagens de atendente/bot exibem **nome do remetente** (2.9.4).

## Resposta automática (2.9.4)

Por widget, em **Widgets → Resposta automática**:

- Enviada **uma vez** após a primeira mensagem do visitante.
- Desativada assim que um atendente humano responde.
- Configurável: ativar/desativar, nome e texto.
- **Modo IA** (2.9.5): usa `AiSettingsService` + prompt da empresa; fallback para mensagem fixa.

`GET /webchat/ai-status` — disponibilidade da IA para o widget.

## Fila e setores (2.9.6)

Estado da conversa (`queueStatus`):

| Valor | Significado |
|-------|-------------|
| `bot` | Bot/IA ou aguardando primeira interação humana |
| `waiting_human` | Na fila para atendente |
| `with_agent` | Atendente assumiu (primeira resposta humana) |

- **Setor padrão** no widget (`defaultDepartmentId`) — usado na escalação manual ou automática.
- **Escalação manual:** `POST /webchat/conversations/:id/escalate` — body opcional `{ departmentId, reason }`.
- **Escalação IA:** quando a auto-resposta com IA retorna `shouldEscalate`, a conversa vai para `waiting_human` após a mensagem.
- **Stats:** `GET /webchat/stats` inclui `waitingQueueCount`.
- **Painel:** aba **Na fila**, botão **Encaminhar para fila**, badges de setor.

## Horário comercial (2.9.7)

- Por padrão o widget **herda o horário do Inbox** (`useInboxBusinessHours: true`).
- Opção de horário **próprio** no editor do widget (dias, fuso, mensagem fora do horário).
- API pública: `GET .../config` retorna `isOnline`, `businessHoursEnabled`, `outsideHoursMessage`, `scheduleSummary`.
- Fora do horário: visitante pode enviar mensagem; recebe aviso automático (sem auto-resposta/IA).
- Widget exibe faixa **Fora do horário** no painel do visitante.

## Status da fila no widget (2.9.8)

- Sessão pública retorna `queueStatus` e `departmentName` (`POST …/sessions`, `GET …/sessions/messages`).
- Widget exibe faixas: **Aguardando atendente** (`waiting_human`) e **Atendente conectado** (`with_agent`).
- Atualização em tempo real via socket `webchat:conversation` / `webchat:message`.

## Webhooks (2.9.8)

| Evento | Quando |
|--------|--------|
| `webchat.message.received` | Visitante envia mensagem |
| `webchat.conversation.escalated` | Conversa vai para fila humana |
| `webchat.conversation.closed` | Atendente encerra conversa |

Configurável em **Configurações → Webhooks** — ver `WEBHOOKS.md`.

## Ponte com o Inbox (2.9.9)

- **Inbox** exibe banner e métrica **Chat do site** quando há conversas na fila (filtradas pelos setores do atendente).
- Menu **Atendimento** inclui atalho **Chat do site** ao lado do Inbox.
- Escalação dispara evento de painel `webchat:escalated` (som + sino de notificações) com link direto.
- `GET /webchat/stats` retorna `myWaitingQueueCount` (fila visível ao usuário logado).
- Deep link: `/platform/webchat?filter=queue&conv={id}`.

## Lista unificada no Inbox (2.10.0)

- `GET /inbox/conversations?channel=whatsapp|webchat|all` — mescla WhatsApp + chat do site.
- IDs WebChat no Inbox: prefixo `wc:` (ex.: `wc:64f…`).
- Detalhe, resposta e finalizar via rotas do Inbox (`/inbox/conversations/wc:…/reply|resolve`).
- Filtros de canal **Todos / WhatsApp / Site** na lista do Inbox.
- Status mapeados: `bot_triage`, `waiting_queue`, `in_progress`, `closed`.

## Round-robin na fila (2.10.1)

- Ao escalar para humano, se `InboxSettings.roundRobinEnabled`, sugere atendente online do setor (`suggestedUserId`, `suggestedAt`).
- Mesmas regras do Inbox WhatsApp: **Aceitar** (prioridade), **Puxar** (timeout/ocupado/offline), **Assumir** (fila aberta).
- `POST /inbox/conversations/wc:{id}/assign` — aceitar/puxar/assumir conversa do site.
- Resposta do agente exige conversa assumida (`waiting_human` bloqueia envio direto).
- Evento de painel `inbox:priority` com link para o Inbox unificado.

## Anexos no widget (2.10.2)

- Visitante envia **imagens** (JPEG, PNG, WebP — máx. 5 MB) pelo botão 📎 no widget.
- `POST /api/webchat/public/messages/attachment` — corpo JSON `{ dataBase64, mimeType?, fileName? }`.
- `GET /api/webchat/public/media/:filename?v={visitorToken}` — exibição no widget.
- Painel: `GET /api/webchat/media/:clientId/:filename` (auth `webchat:view`).
- Mensagens guardam `mediaType`, `mediaUrl`, `mediaMime`, `mediaFileName` em `WebChatMessage`.
- Armazenamento em `data/webchat-media/{clientId}/`.

## Anexos do atendente (2.10.3)

- Atendente envia **imagens** pelo botão 📎 no painel (página WebChat e Inbox unificado).
- `POST /webchat/conversations/:id/messages/attachment` — auth `webchat:reply`.
- `POST /inbox/conversations/wc:{id}/reply/attachment` — mesmo payload JSON do visitante.
- Visitante vê a imagem no widget em tempo real (socket + `mediaType: image`).

## PDF e legenda (2.10.4)

- **PDF** aceito no widget visitante e no painel (máx. 5 MB, validação `%PDF-`).
- `mediaType: document` em mensagens com link para download/visualização.
- Campo opcional **`caption`** no payload de anexo — texto da mensagem (máx. 500 caracteres).
- No painel: texto do composer vira legenda ao clicar em 📎 (WebChat e Inbox).

## Próximos passos (roadmap)

- Áudio e outros formatos no widget.
- Arrastar-e-soltar arquivos no widget.
