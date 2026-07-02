# Recomendações futuras de segurança — Radar Chat

Melhorias além do plano de correção imediato.

---

## Autenticação e sessão

1. **2FA/WebAuthn** para donos de empresa e staff admin.
2. **Rotação de sessão** após login e mudança de permissões.
3. **Lista de sessões ativas** com revogação (settings → segurança).
4. **`sameSite: 'strict'`** em prod se OAuth permitir.

## API e multi-tenant

5. **Testes de contrato** IDOR para cada rota com `:id`.
6. **Middleware global** que injeta `tenantFilter` em todas as queries Mongoose.
7. **API Gateway unificado** ou deprecar `APIGateway` legado para reduzir superfície.
8. **mTLS** entre serviços se voltar a microserviços.

## Dados e LGPD

9. **Criptografia de campo** para `WebhookEndpoint.secret`, `Organization.taxId`.
10. **Backup criptografado** (AES-256-GCM com senha do usuário).
11. **TTL automático** para logs com PII e mídia inbox antiga.
12. **Export LGPD** auditado (quem exportou, quando).

## Anti-cópia e licenciamento (camada comercial)

13. Validação de **plano no backend** em cada capability premium (já parcial — expandir).
14. **Telemetria opcional** de instalação (hash de instância, sem PII).
15. **Contrato de licença** + watermark em builds enterprise.
16. **Rate limit agressivo** em API keys abusadas + revogação automática.

## Observabilidade

17. **SIEM** ou export de logs para Datadog/CloudWatch.
18. Alertas: spike 401/403, falhas webhook, desconexão WA em massa.
19. **Audit log** para: login, mudança de plano, export backup, criação API key.

## Supply chain

20. **Dependabot** + `npm audit` bloqueante em high/critical runtime.
21. **gitleaks** no CI em cada push.
22. **SBOM** (CycloneDX) por release.
23. Pin de imagens Docker por digest.

## Infra

24. **WAF** (Cloudflare) na frente do painel.
25. **Network policies** — app só fala com Mongo/Redis internos.
26. **Secrets manager** (Vault, AWS SM) em vez de `.env` no disco.
27. **Scans de imagem** com Trivy no pipeline de deploy.

## Pentest e processo

28. Pentest anual ou antes de clientes enterprise.
29. **Threat modeling** trimestral (STRIDE) para Inbox + billing.
30. Treinamento do time: OWASP API Top 10, IDOR em SaaS multi-tenant.

---

Priorize itens **5, 9, 10, 17, 20, 24** para o maior retorno em SaaS B2B com WhatsApp.
