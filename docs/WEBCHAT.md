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

## Próximos passos (roadmap)

- Unificar com Inbox (mesma fila/setores).
- Pré-chat customizável, horário de atendimento, bot/IA.
- Anexos e notificações sonoras no painel.
