# QA manual — Modelos de Chat Box (WebChat)

> **Versão alvo:** `2.10.96` · **Escopo:** coleção Chat Box (painel + widget runtime)  
> **Tempo estimado:** 25–35 min

**Pré-requisitos:** `npm run dev` + `npm run dashboard:frontend`; widget ativo; artigos na Base de conhecimento com sugestões rápidas.

---

## 0. Painel — aplicar modelos

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| P1 | **WebChat → Visual → Modelos visuais** | Abas **Chat Box** e **Landings de teste** (não tudo na mesma tela) | [ ] |
| P2 | Aplicar **Blue Compact** (Free) | Badge **Aplicado**; previewTemplateId `chatbox-blue-compact` | [ ] |
| P3 | Aplicar modelo **Premium** sem plano Starter/Pro/Enterprise | Botão **Aplicar** bloqueado / Upgrade | [ ] |
| P4 | Cards: **Abrir**, **Ver detalhes**, **Aplicar** | Modal com preview ampliado e detalhes | [ ] |
| P5 | Pré-visualização ao vivo (coluna lateral) | Com Chat Box aplicado, iframe usa `widget.html` e nome do modelo | [ ] |

---

## 1. Runtime — dimensões e layout

| # | Modelo | Verificar | OK? |
|---|--------|-----------|-----|
| R1 | Blue Compact | Header degradê azul; largura ~360px | [ ] |
| R2 | Small Chat | Widget menor (~320px); header mini | [ ] |
| R3 | Floating Mini | Bolha 64px com ⚡; glass ao abrir | [ ] |
| R4 | Pocket Chat | Nav inferior Início / Chat / Ajuda | [ ] |
| R5 | Workplace Mini | Grid 2×2 de tiles clicáveis | [ ] |
| R6 | Smart Mini | Layout Copilot + card de sugestões | [ ] |

---

## 2. Interações (chips, FAQ, ticket)

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| I1 | Clean Support → item FAQ | Artigo KB no chat (`faq-pick`) | [ ] |
| I2 | Support Lite → **Base de conhecimento** | Abre catálogo FAQ | [ ] |
| I3 | Support Lite → busca “senha” | Lista artigos filtrados; clique abre artigo | [ ] |
| I4 | **Abrir chamado** / **Ver status** | Fluxo consulta TK | [ ] |
| I5 | Pocket → Ajuda → quick reply | Artigo FAQ no chat | [ ] |
| I6 | Workplace tile “TI e acessos” | Mensagem enviada no chat | [ ] |

---

## 3. Regressão

| # | Passo | Esperado | OK? |
|---|-------|----------|-----|
| G1 | Modelos landing (Clássico, Luxe, Copilot) | Continuam aplicáveis | [ ] |
| G2 | `npm run build --prefix src/services/web-dashboard/frontend` | Verde | [ ] |
| G3 | `npm test -- --testPathPattern=webchat` | Verde | [ ] |

---

## Resultado

| Gate | Status |
|------|--------|
| Painel Chat Box | [ ] OK / [ ] Falhou |
| Widget runtime | [ ] OK / [ ] Falhou |
| FAQ + ticket | [ ] OK / [ ] Falhou |

**Observações:** _______________________________________________
