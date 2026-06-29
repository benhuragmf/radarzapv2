import { Router, type Request } from 'express';
import { WebChatWidget } from '@/models/WebChatWidget';
import { WebChatService } from './WebChatService';
import { WebChatPresenceService } from './WebChatPresenceService';
import { isWebChatMessageReceiptRateLimited } from './webchat-message-receipt-rate-limit';
import { issueWebChatPresenceSocketAuth } from './webchat-presence-auth.util';
import { getOrganizationWebsite } from '@/utils/embed-allowed-domains.util';
import { isEmbedPreviewPanelOrigin } from '@/utils/embed-preview-origin.util';
import { resolveSafeExternalHttpsUrl } from '@/utils/safe-external-url.util';

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
      await svc.assertOrigin(widget, req.headers.origin, req.headers.referer);
      res.json(await svc.getPublicConfig(widget));
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });

  /** Site da empresa para prévia no painel — origem restrita; URL nunca vem da query string. */
  r.get('/widgets/:publicKey/preview-site', async (req, res) => {
    try {
      if (!isEmbedPreviewPanelOrigin(req.headers.origin, req.headers.referer)) {
        return res.status(403).json({ error: 'Origem não autorizada para prévia' });
      }
      const publicKey = req.params.publicKey.trim();
      const widget = await WebChatWidget.findOne({ publicKey }).select('clientId').lean();
      if (!widget) return res.status(404).json({ error: 'Widget não encontrado' });
      const website = await getOrganizationWebsite(String(widget.clientId));
      const site = resolveSafeExternalHttpsUrl(website);
      res.json({ site });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.get('/widgets/:publicKey/faq-catalog', async (req, res) => {
    try {
      const widget = await svc.getActiveWidgetByPublicKey(req.params.publicKey);
      if (!widget) return res.status(404).json({ error: 'Widget não encontrado' });
      await svc.assertOrigin(widget, req.headers.origin, req.headers.referer);
      res.json(await svc.getFaqCatalog(widget));
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
        visitorPhone?: string;
        contactReason?: string;
        visitorIntake?: Record<string, string>;
        pageUrl?: string;
        pageTitle?: string;
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

  r.post('/widgets/:publicKey/presence', async (req, res) => {
    try {
      const body = req.body as {
        presenceId?: string;
        pageUrl?: string;
        pageTitle?: string;
        referrer?: string;
        chatOpened?: boolean;
        chatEverOpened?: boolean;
        proactiveInviteClicked?: boolean;
        notificationDismissed?: boolean;
        visitorToken?: string;
      };
      const widget = await svc.getActiveWidgetByPublicKey(req.params.publicKey);
      if (!widget) return res.status(404).json({ error: 'Widget não encontrado' });
      await svc.assertOrigin(widget, req.headers.origin, req.headers.referer);
      const visitor = await WebChatPresenceService.getInstance().upsertFromPublic({
        publicKey: req.params.publicKey,
        presenceId: body.presenceId ?? '',
        pageUrl: body.pageUrl,
        pageTitle: body.pageTitle,
        referrer: body.referrer ?? (typeof req.headers.referer === 'string' ? req.headers.referer : undefined),
        chatOpened: body.chatOpened,
        chatEverOpened: body.chatEverOpened,
        proactiveInviteClicked: body.proactiveInviteClicked,
        notificationDismissed: body.notificationDismissed,
        visitorToken: body.visitorToken,
        origin: req.headers.origin,
        referer: req.headers.referer,
        headers: req.headers,
        remoteIp: req.socket.remoteAddress,
      });
      if (!visitor) return res.status(400).json({ error: 'presenceId inválido' });
      const widgetClientId = String(widget.clientId);
      res.json({
        ok: true,
        socketAuth: issueWebChatPresenceSocketAuth(widgetClientId, body.presenceId ?? ''),
      });
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.includes('não encontrado') ? 404 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.get('/widgets/:publicKey/presence/:presenceId/pending', async (req, res) => {
    try {
      const widget = await svc.getActiveWidgetByPublicKey(req.params.publicKey);
      if (!widget) return res.status(404).json({ error: 'Widget não encontrado' });
      await svc.assertOrigin(widget, req.headers.origin, req.headers.referer);
      const agentEngage = await WebChatPresenceService.getInstance().consumePendingEngage(
        req.params.publicKey,
        req.params.presenceId,
      );
      res.json({ agentEngage: agentEngage ?? null });
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

  r.post('/sessions/close', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      await svc.closeVisitorConversation(token, req.headers.origin, req.headers.referer);
      res.json({ ok: true });
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 400;
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
      const name = (e as Error).name;
      const status =
        name === 'WebChatSendRateLimitError'
          ? 429
          : msg.includes('inválida') || msg.includes('encerrada')
            ? 401
            : msg.includes('Origem')
              ? 403
              : 400;
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

  r.post('/sessions/typing', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const { typing } = req.body as { typing?: boolean };
      await svc.setVisitorTyping(token, Boolean(typing), req.headers.origin, req.headers.referer);
      res.json({ ok: true });
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

  r.post('/sessions/faq-pick', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const body = req.body as { articleId?: string };
      if (!body.articleId?.trim()) return res.status(400).json({ error: 'articleId obrigatório' });
      const result = await svc.pickFaqArticle(
        token,
        body.articleId.trim(),
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

  r.post('/sessions/message-receipts', async (req, res) => {
    try {
      const token = visitorTokenFromReq(req);
      if (!token) return res.status(401).json({ error: 'Token de visitante obrigatório' });
      const remoteIp = req.ip || req.socket.remoteAddress;
      if (isWebChatMessageReceiptRateLimited(token, remoteIp)) {
        return res.status(429).json({ error: 'Muitas confirmações. Aguarde um momento.' });
      }
      const body = req.body as { deliveredMessageIds?: string[]; readThroughMessageId?: string };
      await svc.markVisitorMessageReceipts(
        token,
        {
          deliveredMessageIds: Array.isArray(body.deliveredMessageIds) ? body.deliveredMessageIds : undefined,
          readThroughMessageId:
            typeof body.readThroughMessageId === 'string' ? body.readThroughMessageId : undefined,
        },
        req.headers.origin,
        req.headers.referer,
      );
      res.json({ ok: true });
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('inválida') || msg.includes('encerrada') ? 401 : msg.includes('Origem') ? 403 : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/widgets/:publicKey/tickets/lookup', async (req, res) => {
    try {
      const body = req.body as { ticketRef?: string; accessToken?: string };
      const result = await svc.lookupTicketPublic(req.params.publicKey, {
        ticketRef: body.ticketRef ?? '',
        accessToken: body.accessToken ?? '',
        origin: req.headers.origin,
        referer: req.headers.referer,
        remoteIp: req.ip || req.socket.remoteAddress,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('não encontrado') || msg.includes('não está disponível')
          ? 404
          : msg.includes('Origem')
            ? 403
            : msg.includes('Não encontramos')
              ? 404
              : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/widgets/:publicKey/tickets/resend-token', async (req, res) => {
    try {
      const body = req.body as {
        ticketRef?: string;
        channel?: 'whatsapp' | 'email';
        phone?: string;
        email?: string;
      };
      const result = await svc.resendTicketTokenPublic(req.params.publicKey, {
        ticketRef: body.ticketRef ?? '',
        channel: body.channel,
        phone: body.phone,
        email: body.email,
        origin: req.headers.origin,
        referer: req.headers.referer,
        remoteIp: req.ip || req.socket.remoteAddress,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('não encontrado') || msg.includes('não está disponível')
          ? 404
          : msg.includes('Origem')
            ? 403
            : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/widgets/:publicKey/tickets/resend-token/confirm', async (req, res) => {
    try {
      const body = req.body as {
        ticketRef?: string;
        channel?: 'whatsapp' | 'email';
        phone?: string;
        email?: string;
        verificationCode?: string;
      };
      const result = await svc.confirmTicketTokenResendPublic(req.params.publicKey, {
        ticketRef: body.ticketRef ?? '',
        channel: body.channel,
        phone: body.phone,
        email: body.email,
        verificationCode: body.verificationCode ?? '',
        origin: req.headers.origin,
        referer: req.headers.referer,
        remoteIp: req.ip || req.socket.remoteAddress,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('não encontrado') || msg.includes('não está disponível')
          ? 404
          : msg.includes('Origem')
            ? 403
            : 400;
      res.status(status).json({ error: msg });
    }
  });

  r.post('/widgets/:publicKey/tickets/resume', async (req, res) => {
    try {
      const body = req.body as { ticketRef?: string; accessToken?: string; pageUrl?: string; pageTitle?: string };
      const result = await svc.resumeTicketSession(req.params.publicKey, {
        ticketRef: body.ticketRef ?? '',
        accessToken: body.accessToken ?? '',
        pageUrl: body.pageUrl,
        pageTitle: body.pageTitle,
        userAgent: req.headers['user-agent'],
        origin: req.headers.origin,
        referer: req.headers.referer,
        remoteIp: req.ip || req.socket.remoteAddress,
      });
      res.json(result);
    } catch (e) {
      const msg = (e as Error).message;
      const status =
        msg.includes('não encontrado') || msg.includes('Não encontramos') || msg.includes('encerrada')
          ? 404
          : msg.includes('Origem')
            ? 403
            : 400;
      res.status(status).json({ error: msg });
    }
  });

  return r;
}
