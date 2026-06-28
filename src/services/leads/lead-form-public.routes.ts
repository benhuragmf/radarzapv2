import { Router } from 'express';
import { LeadFormService } from './LeadFormService';

export function createLeadFormPublicRouter(): Router {
  const r = Router();
  const svc = LeadFormService.getInstance();

  r.get('/forms/:publicKey/config', async (req, res) => {
    try {
      const form = await svc.getActiveFormByPublicKey(req.params.publicKey);
      if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });
      svc.assertOrigin(form, req.headers.origin, req.headers.referer);
      res.json(svc.getPublicConfig(form));
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });

  r.post('/forms/:publicKey/submit', async (req, res) => {
    try {
      const result = await svc.submitPublicLead(
        req.params.publicKey,
        req.body as {
          name?: string;
          phone?: string;
          email?: string;
          message?: string;
          sourceUrl?: string;
          pageTitle?: string;
          customFields?: Record<string, string>;
          utm?: Record<string, string>;
          consent?: boolean;
          origin?: string;
          honeypot?: string;
        },
        {
          origin: req.headers.origin,
          referer: req.headers.referer,
          ipAddress: req.ip,
          userAgent: req.headers['user-agent'],
        },
      );
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.includes('não encontrado') || msg.includes('inativo')
        ? 404
        : msg.includes('Origem') || msg.includes('autorizada') || msg.includes('rejeitado')
          ? 403
          : 400;
      res.status(status).json({ error: msg });
    }
  });

  return r;
}
