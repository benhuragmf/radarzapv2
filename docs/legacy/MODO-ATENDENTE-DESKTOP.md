# Modo atendente — desktop sem app nativo

Guia para configurar o posto de atendimento no **Radar Chat** usando o painel web como experiência de “app de área de trabalho” (PWA + notificações + atalhos).

**Versão:** `2.17.2` · **Última revisão:** 2026-06-30

---

## 1. Instalar o painel como app (PWA)

### Chrome ou Edge (Windows / macOS)

1. Acesse o painel em **HTTPS** (produção) ou `http://localhost:5174` em dev.
2. Faça login e abra **Atendimento → Inbox** (`/platform/inbox`).
3. Se aparecer o banner **“Instalar Radar Chat”**, clique em **Instalar app**.
4. Alternativa manual:
   - **Chrome:** ícone de instalação (⊕) na barra de endereço → *Instalar Radar Chat*
   - **Edge:** Menu `…` → *Aplicativos* → *Instalar este site como um aplicativo*
5. O app abre em janela própria, sem barra do navegador, e pode ser fixado na barra de tarefas.

### O que a PWA faz

| Recurso | Benefício |
|---------|-----------|
| `manifest.webmanifest` | Nome, ícone e abertura direta no Inbox |
| Service worker (`/sw.js`) | Cache do shell — segunda abertura mais rápida |
| `display: standalone` | Sensação de aplicativo nativo |

> **Nota:** WhatsApp, filas e API continuam no servidor. A PWA é o invólucro do painel, não um cliente WhatsApp local.

---

## 2. Permitir notificações do sistema

1. No **Inbox**, aceite o banner **“Ative notificações do sistema”** (ou permita quando o navegador pedir).
2. Em **Atendimento → Bot → Alertas operacionais**, confirme:
   - **Sons de alerta ativados**
   - **Novo chat / prioridade na fila**
   - **Notificações do sistema (popup do Windows/macOS)** — ligado
3. Opcional: marque **Cada nova mensagem do cliente** se quiser popup a cada mensagem (mais barulhento).

### Quando o popup aparece

- Nova conversa na fila, transferência, prioridade, escalação WebChat
- Alertas urgentes (WhatsApp desconectado, SLA, etc.)
- **Não** aparece se você já está vendo aquela conversa no Inbox com a aba em foco

API: `GET /api/inbox/alerts` (qualquer atendente com `inbox:reply`).

---

## 3. Sons de alerta

Configuração em **Bot do Inbox → Alertas operacionais** (`/platform/inbox/bot`).

| Toggle | Efeito |
|--------|--------|
| Sons de alerta ativados | Master switch dos bips no painel |
| Novo chat / prioridade | Fila, WebChat escalado, transferência |
| Cada nova mensagem | Bip a cada mensagem inbound |

Os sons tocam via `EventNotificationContext` (Socket.IO `panel:event`).

---

## 4. Atalhos de teclado no Inbox

Pressione **`?`** ou **`Ctrl + /`** no Inbox para ver a lista completa.

| Atalho | Ação |
|--------|------|
| `Alt + ↓` | Próxima conversa |
| `Alt + ↑` | Conversa anterior |
| `Alt + A` | Assumir / aceitar conversa |
| `Alt + R` | Focar campo de resposta |
| `Enter` | Enviar (no composer) |
| `Shift + Enter` | Nova linha |
| `Esc` | Fechar conversa ou painéis |

---

## 5. Presença do atendente

1. No **header**, deixe o status **Disponível** (não *Ausente* / *Offline*).
2. O round-robin e a fila usam presença real — ver `docs/INBOX-ATENDIMENTO.md` § Presença.

---

## 6. Troubleshooting

| Problema | Solução |
|----------|---------|
| Não aparece “Instalar app” | Use HTTPS; limpe cache; confirme `/sw.js` e `/manifest.webmanifest` acessíveis |
| Sem popup de notificação | Permissão do navegador → Permitir; toggle “Notificações do sistema” no Bot |
| Sem som | Verificar volume do SO; toggle “Sons de alerta”; aba não mutada |
| Atalho não funciona | Foco em outro campo — use `Alt+↓` mesmo digitando; ou `Esc` e tente de novo |
| App desatualizado após deploy | Feche e reabra o app instalado (SW atualiza em background) |

---

## Referências

- Inbox: [`INBOX-ATENDIMENTO.md`](../INBOX-ATENDIMENTO.md)
- WebChat alertas: [`WEBCHAT.md`](../WEBCHAT.md)
