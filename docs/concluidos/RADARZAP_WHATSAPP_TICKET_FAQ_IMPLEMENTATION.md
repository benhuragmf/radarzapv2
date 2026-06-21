# RadarZap — Implementação: consulta de ticket + FAQ + fallback WA

**Versão:** `2.10.75` · **Data:** 2026-06-19

## O que foi implementado

### Fase A (2.10.70)

- Token público de consulta por chamado (hash no banco, formato `XXXX-XXXX`).
- Geração automática ao criar chamado (WhatsApp + chat do site + IA).
- API pública de lookup e retomada de conversa WebChat.
- Fluxo **Consultar chamado** no widget embed.
- Testes unitários + rate limit anti-força bruta.

### Fase B (2.10.71)

- Painel: Inbox → IA Atendimento → Base de conhecimento — keywords, links, sugestão rápida.
- Widget: chips + respostas com botões `https`.
- Match por título/palavras-chave; sem inventar resposta fora da base.

### Fase C (2.10.72)

- Config em **Triagem e Bot** → *Chat do site — fallback WhatsApp*.
- Presença com heartbeat (`agent:heartbeat` a cada 45s no painel).
- Escalação WebChat sem atendente online: mensagem ao visitante + alerta WhatsApp interno.
- Cooldown de 15 min entre alertas por conversa.

### Fase D (2.10.73)

- Comandos via WhatsApp: `!assumir`, `!ticket`, `!encerrar`, `!ajuda`.
- Whitelist: `CompanyMember.whatsappPhone` + permissão `inbox:reply`.
- Parser intercepta mensagens `!` antes do fluxo de consentimento/inbox.

### Fase E (2.10.74)

- Bridge bidirecional após `!assumir` em chamado do **chat do site**.
- Visitante → encaminhado ao WhatsApp do atendente; resposta WA → widget.
- Vários chamados: prefixo `TK-XXXX sua mensagem`.
- Comandos `!` nunca vão ao visitante.

### Fase F (2.10.75)

- Badge **Bridge WA** no Inbox (lista + cabeçalho) quando bridge ativo.
- Campo `whatsappBridgeActive` exposto na API unificada do Inbox.
- Checklist de QA atualizado em `RADARZAP_WHATSAPP_TICKET_FAQ_AUDIT.md` §10.

## Configurar fallback WhatsApp

1. **Triagem e Bot** → ativar fallback + números/grupo + mensagem ao visitante.
2. Sessão WhatsApp conectada em **Sessões**.
3. Ajustar timeout de presença (30–300s, padrão 90s).

## Testar consulta de ticket

1. Abrir conversa Site → 🎫 Converter em chamado.
2. Copiar `TK-…` e token da mensagem de sistema no widget.
3. Encerrar ou abrir widget em aba anônima → **Consultar chamado**.
4. Informar número + token → ver status e mensagens.
5. **Continuar atendimento** (se conversa ainda aberta).
6. Token errado → mesma mensagem genérica (sem vazar existência).

## Testar fallback WhatsApp offline

1. Configurar números de alerta e ativar fallback.
2. Fechar painel de todos os atendentes (ou aguardar timeout de presença).
3. No widget, escalar conversa para fila.
4. Visitante vê mensagem configurada; números recebem alerta com `TK-…`.
5. Responder `!assumir TK-…` do WhatsApp cadastrado em Equipe.

## Testar comandos WhatsApp

1. Cadastrar WhatsApp do atendente em **Equipe** → editar membro.
2. Receber alerta de fallback (Fase C) ou conhecer o `TK-…` do chamado.
3. Enviar `!assumir TK-XXXX` do número cadastrado → confirmação + link painel.
4. `!ticket TK-XXXX` → resumo; `!encerrar TK-XXXX` → encerra chamado.
5. Número não cadastrado → mensagem de não autorizado.

## Testar bridge site ↔ WhatsApp

1. Fluxo fallback + `!assumir TK-…` (Fases C+D).
2. Visitante envia mensagem no widget → atendente recebe no WhatsApp (`[Site · TK-…]`).
3. Atendente responde no WhatsApp → visitante vê no chat do site.
4. `!encerrar TK-…` → bridge desativado + conversa encerrada.

## Limitações

- Chamados **anteriores a 2.10.70** não têm token até novo chamado ser criado.
- Retomada pelo chat só para `channel: webchat_site` com conversa aberta.
- Chamados WhatsApp: consulta funciona; continuar pelo widget não.
- Bridge: texto no WhatsApp; anexos do visitante viram aviso (`📎 Imagem/PDF`) no WA do atendente.
- Mídia do atendente via WhatsApp no bridge: não implementado (usar painel).

## Próximos passos

- QA manual completo (checklist em `RADARZAP_WHATSAPP_TICKET_FAQ_AUDIT.md` §10 e **`../QA-WEBCHAT-WA-FALLBACK-BRIDGE.md`**).
