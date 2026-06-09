# Segurança — boas práticas RadarZap

Guia rápido para desenvolvedores.

---

## Princípios

1. **Backend é a autoridade** — nunca confiar no React para bloquear acesso.
2. **Todo recurso tem dono** — query sempre com `clientId` ou `organizationId`.
3. **Secrets nunca no frontend** — só `VITE_*` públicos por design OAuth.
4. **Logs não são seguros** — redigir PII e tokens.
5. **Produção ≠ dev** — flags `ALLOW_DEV_*` proibidas em prod.

---

## Adicionar rota nova na API

```typescript
r.get('/recurso/:id', requireCapability(Cap.ALGUMA), async (req, res) => {
  const auth = (req as DashboardRequest).auth!;
  const doc = await Model.findOne({
    _id: req.params.id,
    clientId: new mongoose.Types.ObjectId(auth.clientId), // obrigatório
  });
  if (!doc) return res.status(404).json({ error: 'Not found' });
  // ...
});
```

Staff global: use capability `Cap.*_GLOBAL` e documente o motivo.

---

## Socket.IO

- Join em `tenant:{clientId}` no connect.
- Emitir eventos sensíveis só para `io.to('tenant:…')`.
- Nunca `io.emit` global para QR, sessão ou PII.

---

## Webhooks

- **Inbound Stripe:** body `raw` antes de `express.json`.
- **Outbound:** HMAC em `X-RadarZap-Signature` — ver `docs/WEBHOOKS.md`.
- Secrets: gerar forte; mostrar uma vez na UI.

---

## Uploads

- Usar `parseAndValidateStatusImage` para imagens.
- CSV/VCF: limite 16MB; validar no serviço, não só no cliente.

---

## Variáveis sensíveis

Ver `.env.example` e `docs/PRODUCTION.md`.  
Boot falha em prod se secrets forem default ou `ALLOW_DEV_BILLING=true`.

---

## Documentos na raiz

| Arquivo | Uso |
|---------|-----|
| `SECURITY.md` | Como reportar vulnerabilidades |
| `SECURITY_AUDIT.md` | Relatório completo |
| `SECURITY_FIX_PLAN.md` | O que corrigir e quando |
| `SECURITY_CHECKLIST.md` | Antes de deploy |
| `SECURITY_RECOMMENDATIONS.md` | Roadmap longo prazo |

---

## Comandos úteis

```bash
npm audit
npm audit --prefix src/services/web-dashboard/frontend
npm test
git check-ignore -v .env sessions/
```

Opcional: `npx gitleaks detect`, `npx osv-scanner -r .`
