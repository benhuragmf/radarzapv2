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

Escolha o modelo em **Chat do site → Widgets** (aplica cores/textos ao widget e abre preview).

| URL | Modelo |
|-----|--------|
| `/webchat/preview-classic.html?key=wck_...` | Clássico — corporativo claro |
| `/webchat/preview-tech.html?key=wck_...` | **Tecnológico** — dark, grid, suporte TI |
| `/webchat/preview-saas.html?key=wck_...` | SaaS — gradiente roxo/rosa |
| `/webchat/preview-minimal.html?key=wck_...` | Minimalista — branco e tipografia serif |
| `/webchat/preview-luxe.html?key=wck_...` | **Luxe** (Premium) — concierge champagne, landing editorial |
| `/webchat/preview-obsidian.html?key=wck_...` | **Obsidian** (Premium) — executivo dark com ouro |
| `/webchat/widget.html` | Atalho dev com links para todos os modelos |
| `/webchat/demo.html?key=wck_...` | Legado (genérico) |

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
2. Visitante preenche **nome/e-mail** (se habilitado no widget) e clica **Iniciar conversa**.
3. Sessão criada (`POST .../widgets/:key/sessions`) → token + histórico.
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
- Botão **×** no cabeçalho e **Fechar janela** após encerramento (2.10.9).
- **Encerrar atendimento** — link no rodapé; ao clicar, confirmação na mesma linha (**Sim** vermelho / **Não**) (2.10.49).
- **Aplicar modelo** (2.10.50): salva aparência automaticamente (`previewTemplateId`, tema, cores, textos); widget recarrega config ao abrir o painel ou voltar à aba do preview.
- **Fix tema × pré-chat** (2.10.51): PATCH parcial — pré-chat e visual salvos separadamente; troca de modo formulário não sobrescreve tema.
- **Tema só via modelo** (2.10.52): removido select duplicado “Tema do chat”; claro/escuro vem de **Aplicar** no modelo (Tecnológico, Obsidian = escuro); indicador somente leitura no editor.
- **Fix tema na API pública** (2.10.53): `syncLegacyAppearanceFlags` + `toPlainAppearance` — subdocumento Mongoose não copiava `theme`/cores no `GET …/config`.
- **Fix balão proativo** (2.10.54): balão volta após o delay em toda visita — não bloqueia mais por conversa encerrada ou mensagem já no histórico (só cooldown 24h ao fechar com ×).
- **Fix pré-chat × layout** (2.10.55): salvar modo/campos do formulário não reseta tema nem modelo (`toPlainAppearance` no `updateWidget`); painel não recarrega o editor inteiro.
- **Preview ao vivo no painel** (2.10.56): iframe embutido (80% escala), sticky ao rolar o formulário; testes do merge `appearance` (pré-chat não apaga tema/cores).
- Campo de mensagem some quando encerrado; visitante não fica com input “travado” (2.10.9).
- Mensagens de atendente/bot exibem **nome do remetente** (2.9.4).
- **Tema claro/escuro** (`appearance.theme`, 2.10.17): aplicado pelos modelos (Tecnológico, Obsidian = escuro). Editor: indicador **Tema do widget** + **Aplicar** nos cards de modelo (2.10.52).
- **Modelos de preview** (2.10.38): cards com miniatura do site + widget, badge claro/escuro, “Ideal para” e páginas HTML aprimoradas (Clássico, Tecnológico, SaaS, Minimalista).
- **Modelos premium** (2.10.39): **Luxe** (concierge champagne/dourado, tema claro) e **Obsidian** (executivo escuro com ouro, tema dark) — landing completa com serviços, depoimentos e métricas.
- **UI coleção premium** (2.10.40): seção destacada no painel — cards grandes com borda dourada, lista de destaques, miniatura da landing completa e botão “Aplicar premium”; modelos essenciais ficam em grid menor abaixo.
- **Coleta de dados visitante** (2.10.41): pré-chat em etapas (nome → WhatsApp → motivo → e-mail opcional); campos `visitorPhone`, `contactReason`, `pageTitle`; contexto na IA; painel “Informações para IA e chatbot”.
- **Campos configuráveis por empresa** (2.10.42): editor de pré-chat com ativar/obrigatório, campos custom (pedido, NF, etc.), ordem e exemplos rápidos; `visitorIntake` + `prechatFields` no widget.
- **Modo formulário** (2.10.43): exibir todos os campos na mesma tela (`prechatMode: form`); tipo `textarea` com `maxLength`; preset **Formulário clássico** (Nome + Telefone + Motivo 150 caracteres).
- **Fix modo formulário** (2.10.44): `prechatMode` persistido no servidor + salvamento automático ao trocar modo no painel; widget recarrega `form` corretamente.
- **Fix IA WebChat** (2.10.45): toggle **Usar IA** de volta na seção de IA (não removido); salvamento automático; contexto da IA usa dados do formulário + campos legados da conversa.
- **Dados do visitante** (2.10.46): intake não vai mais como mensagem no chat do visitante; vincula contato existente pelo telefone e atualiza perfil/notas; painel Inbox exibe motivo e telefone.
- **Intake no Inbox** (2.10.47): mensagem `📋 Dados do visitante` visível só no chat do painel (`/platform/inbox`); oculta no widget do visitante.

## Resposta automática (2.9.4)

Por widget, em **Widgets → Resposta automática**:

- Enviada **uma vez** após a primeira mensagem do visitante.
- Desativada assim que um atendente humano responde.
- Configurável: ativar/desativar, nome e texto.
- **Modo IA** (2.9.5): usa `AiSettingsService` + prompt da empresa; fallback para mensagem fixa.

`GET /webchat/ai-status` — disponibilidade da IA para o widget.

## Visitantes ao vivo no Inbox (2.10.31)

Painel **Visitantes no site agora** em `/platform/inbox`:

| Coluna | Fonte |
|--------|--------|
| Página | `pageUrl` / `document.title` (heartbeat 30s) |
| Origem | `document.referrer` → Google, Facebook, Direto, etc. |
| Cidade | GeoIP pelo IP do visitante (localhost = "Local") |
| Chat | Aberto agora / já clicou (botão ou balão) / não clicou |
| Convite | Clicou no balão / fechou (×, cooldown 24h) / só exibido |
| Ação | **Chamar no chat** / **Abrir chat** (2.10.32) |

- API painel: `GET /api/webchat/live-visitors` (`inbox:view`)
- **Chamar visitante:** `POST /api/webchat/live-visitors/:presenceId/engage` (`webchat:reply`) — body opcional `{ openOnly: true }` para só abrir o widget sem nova mensagem; sem `openOnly` cria/retoma conversa, envia saudação, abre o widget (`webchat:agent-engage`) e redireciona o painel para `wc:{conversationId}`
- API pública: `POST /api/webchat/public/widgets/:key/presence`
- Socket visitante: join `webchat:presence:{presenceId}` via auth `webchatPresenceId` no handshake (token inválido não bloqueia presença)
- **Fallback abrir chat:** comando em Redis + `GET /api/webchat/public/widgets/:key/presence/:presenceId/pending` (poll 3s no widget) além do socket `webchat:agent-engage`
- Socket painel: `webchat:presence` na room do tenant
- Presença expira em **120s** sem heartbeat

## Saudação proativa (2.10.25)

Por widget, em **Widgets → Saudação proativa** (versão inicial):

- **Desligada por padrão** — o empresário ativa no painel.
- Após **30 segundos** (configurável, 5–300 s) com o script do chat carregado na página, o sistema envia uma mensagem curta e amigável ao visitante (ex.: *Olá! Estou por aqui caso precise de ajuda 😊*).
- Mensagem aparece como **resposta do atendimento** (`outbound`); se o chat estiver fechado, exibe um **balão acima do botão** 💬.
- O **balão reaparece a cada visita** à página (após o delay), mesmo com o mesmo visitante — o Local Storage mantém a conversa, mas não esconde o convite.
- Se o visitante **fechar o balão (×)**, ele só volta a aparecer após **24 horas** (cooldown no navegador).
- No servidor, a mensagem é gravada **uma vez por conversa** (evita spam no Inbox); visitas seguintes só reexibem o balão.
- **Não depende de horário comercial** (é um convite amigável, não promessa de atendente online).
- API pública: `POST /api/webchat/public/widgets/:key/proactive-greeting` — body opcional `{ visitorToken, pageUrl }`; resposta inclui `skipReason` quando `sent: false`.

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

## Paridade Inbox WhatsApp (2.10.5)

- **Aceitar / Puxar / Assumir** obrigatórios antes de responder — não há auto-atribuição silenciosa ao enviar.
- Mensagem de sistema *"{nome} entrou no atendimento"* só ao assumir via botão (assign).
- **Respostas rápidas** (`/bd`, `/bt`, `/enc`, etc.) expandidas no envio — mesmas regras do Inbox WhatsApp.
- `/enc` envia o template de encerramento e fecha a conversa.
- **Assumir** disponível durante triagem IA (`bot_triage`) para interromper o bot.
- Painel de **prioridade/timer** na fila também para conversas do site.
- **Transferência** entre setores via Inbox unificado (`POST /inbox/conversations/wc:{id}/transfer`).

## Fila global para atendentes (2.10.6)

- Conversas do **site** na fila aparecem para **todos os atendentes** com `inbox:view` (sem silo por setor).
- **Assumir / Aceitar / Puxar** no Inbox unificado usam as mesmas permissões do WhatsApp (`inbox:reply`).
- Rotas `/inbox/conversations/wc:…` não exigem `webchat:view` separado — basta acesso ao Inbox.
- Notificações de fila apontam para `/platform/inbox?conv=wc:…`.

## Atendimento só no Inbox (2.10.7)

- **`/platform/webchat`** virou **histórico + status + widgets** (somente leitura das mensagens).
- Atendimento ativo (Assumir, responder, `/bd`, anexos) é **somente** em `/platform/inbox` (filtro Site ou Todos).
- Links antigos `?conv=` e `?filter=queue` redirecionam automaticamente para o Inbox.
- Badge de fila do site no menu **Inbox**.

## Próximos passos (roadmap)

- Áudio e outros formatos no widget.
- Arrastar-e-soltar arquivos no widget.
