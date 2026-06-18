import { Router, type Request } from 'express';
import { WebChatService } from './WebChatService';

function visitorTokenFromReq(req: Request): string | undefined {
  const header = req.headers['x-webchat-visitor'];
  if (typeof header === 'string' && header.trim()) return header.trim();
  const queryToken = req.query.v;
  if (typeof queryToken === 'string' && queryToken.trim()) return queryToken.trim();
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return undefined;
}

export function createWebChatPublicRouter(): Router {
  const r = Router();
  const svc = WebChatService.getInstance();

  r.get('/widgets/:publicKey/config', async (req, res) => {
    try {
      const widget = await svc.getActiveWidgetByPublicKey(req.params.publicKey);
      if (!widget) return res.status(404).json({ error: 'Widget não encontrado' });
      svc.assertOrigin(widget, req.headers.origin, req.headers.referer);
      res.json(await svc.getPublicConfig(widget));
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });

  r.post('/widgets/:publicKey/sessions', async (req, res) => {
    try {
      const body = req.body as {
        visitorToken?: string;
        visitorName?: string;
        visitorEmail?: string;
        pageUrl?: string;
      };
      const result = await svc.createOrResumeSession(req.params.publicKey, {
        ...body,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.includes('não encontrado') ? 404 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/widgets/:publicKey/proactive-greeting', async (req, res) => {
    try {
      const body = req.body as { visitorToken?: string; pageUrl?: string };
      const result = await svc.triggerProactiveGreeting(req.params.publicKey, {
        ...body,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.includes('não encontrado') ? 404 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/messages', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const { body } = req.body as { body?: string };
      const result = await svc.sendVisitorMessage(
        token,
        body ?? '',
        req.headers.origin,
        req.headers.referer,
      );
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/messages/attachment', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const { dataBase64, mimeType, fileName, caption } = req.body as {
        dataBase64?: string;
        mimeType?: string;
        fileName?: string;
        caption?: string;
      };
      const result = await svc.sendVisitorAttachment(
        token,
        { dataBase64: dataBase64 ?? '', mimeType, fileName, caption },
        req.headers.origin,
        req.headers.referer,
      );
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.get('/media/:filename', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const { filePath, mime } = await svc.resolveVisitorMediaFile(
        token,
        req.params.filename,
        req.headers.origin,
        req.headers.referer,
      );
      res.setHeader('Content-Type', mime);
      res.setHeader('Cache-Control', 'private, max-age=3600');
      res.sendFile(filePath);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 404;
      res.status(status).json({ error: msg });
    }
  });

  r.get('/sessions/messages', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const result = await svc.listVisitorMessages(token, req.headers.origin, req.headers.referer);
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  return r;
}
