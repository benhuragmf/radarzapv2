# Runbook — Reconectar WhatsApp após deploy

**Versão:** 2.17.32 · **Escopo:** OPS-02 auditoria horizontal

Após deploy na VPS (restart do container monolith), sessões Baileys **não** sobrevivem ao processo. O atendimento WhatsApp fica parado até reconectar cada número.

---

## Sintomas

- Painel `/sessions` mostra instâncias **desconectadas** ou aguardando QR
- Inbox não recebe mensagens WA
- Alertas críticos de configuração (se fallback WebChat depende de WA)

---

## Passo a passo (operador)

1. Acesse o painel como **Admin** ou usuário com `whatsapp:session:manage`
2. Abra **Menu → Sessões WhatsApp** (`/sessions`)
3. Para cada instância da empresa:
   - Se status **QR / desconectado**: clique **Conectar** e escaneie o QR no celular (WhatsApp → Aparelhos conectados)
   - Se **erro 401 / logout**: use **Nova sessão** conforme runbook de bloqueio (ver logs da instância)
4. Confirme **conectado** (indicador verde) antes de encerrar
5. Envie mensagem de teste para um número interno e valide no Inbox

---

## Pós-deploy automatizado (opcional)

Não há reconexão automática por design (segurança Meta/Baileys). Após cada deploy em `main`:

- [ ] Verificar `/sessions` em até 5 minutos
- [ ] Reconectar números de produção
- [ ] Registrar em canal interno se houve downtime WA

---

## Referências

- `docs/WEBCHAT.md` § Fallback — depende de WA conectado para alertas
- `docs/INBOX-ATENDIMENTO.md` — fila e atribuição
- Workflow deploy: `.github/workflows/deploy.yml`
