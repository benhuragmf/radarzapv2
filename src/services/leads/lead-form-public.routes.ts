import { Router } from 'express';
import { LeadForm } from '@/models/LeadForm';
import { LeadFormService } from './LeadFormService';
import { LeadFormPreviewPageService } from './lead-form-preview-page.service';
import type { LeadFormPreviewAppearanceAttrs } from './lead-form-preview-page.service';
import { getOrganizationWebsite } from '@/utils/embed-allowed-domains.util';
import { isEmbedPreviewPanelOrigin } from '@/utils/embed-preview-origin.util';
import { resolveSafeExternalHttpsUrl } from '@/utils/safe-external-url.util';
import { applyLeadPreviewProxyHeaders } from '@/utils/lead-preview-proxy-headers.util';

export function createLeadFormPublicRouter(): Router {
  const r = Router();
  const svc = LeadFormService.getInstance();
  const previewPageSvc = LeadFormPreviewPageService.getInstance();

  r.get('/forms/:publicKey/preview-config', async (req, res) => {
    try {
      if (!isEmbedPreviewPanelOrigin(req.headers.origin, req.headers.referer)) {
        return res.status(403).json({ error: 'Origem não autorizada para prévia' });
      }
      const publicKey = req.params.publicKey.trim();
      const form = await LeadForm.findOne({ publicKey }).exec();
      if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });
      res.json(svc.getPublicConfig(form));
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.get('/forms/:publicKey/config', async (req, res) => {
    try {
      const form = await svc.getActiveFormByPublicKey(req.params.publicKey);
      if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });
      await svc.assertOrigin(form, req.headers.origin, req.headers.referer);
      res.json(svc.getPublicConfig(form));
    } catch (e) {
      res.status(403).json({ error: (e as Error).message });
    }
  });

  r.get('/forms/:publicKey/preview-site', async (req, res) => {
    try {
      if (!isEmbedPreviewPanelOrigin(req.headers.origin, req.headers.referer)) {
        return res.status(403).json({ error: 'Origem não autorizada para prévia' });
      }
      const publicKey = req.params.publicKey.trim();
      const form = await LeadForm.findOne({ publicKey }).select('clientId').lean();
      if (!form) return res.status(404).json({ error: 'Formulário não encontrado' });
      const website = await getOrganizationWebsite(String(form.clientId));
      const site = resolveSafeExternalHttpsUrl(website);
      res.json({ site });
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });

  r.get('/forms/:publicKey/preview-page', async (req, res) => {
    try {
      if (!isEmbedPreviewPanelOrigin(req.headers.origin, req.headers.referer)) {
        return res.status(403).json({ error: 'Origem não autorizada para prévia' });
      }
      const publicKey = req.params.publicKey.trim();
      const rawSection = parseInt(String(req.query.section ?? '3'), 10);
      const sectionIndex = Number.isFinite(rawSection) ? rawSection : 3;
      const appearance = parsePreviewAppearanceQuery(req.query);

      const result = await previewPageSvc.buildPreviewPage({
        publicKey,
        sectionIndex,
        appearance,
      });

      applyLeadPreviewProxyHeaders(res, result.siteOrigin);
      res.send(result.html);
    } catch (e) {
      const msg = (e as Error).message;
      const status = msg.includes('não encontrado') ? 404 : 502;
      res.status(status).send(
        `<!DOCTYPE html><html lang="pt-BR"><body style="font-family:system-ui;padding:24px">` +
          `<p><strong>Prévia indisponível:</strong> ${msg}</p>` +
          `<p><a href="/leads/preview.html?key=${encodeURIComponent(req.params.publicKey)}">Abrir prévia simples</a></p>` +
          `</body></html>`,
      );
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

function parsePreviewAppearanceQuery(
  query: Record<string, unknown>,
): LeadFormPreviewAppearanceAttrs | undefined {
  const theme = typeof query.theme === 'string' ? query.theme : undefined;
  const size = typeof query.size === 'string' ? query.size : undefined;
  const borderRadiusRaw = query.borderRadius;
  const borderRadius =
    borderRadiusRaw !== undefined && borderRadiusRaw !== ''
      ? Number(borderRadiusRaw)
      : undefined;
  const showLogoRaw = query.showLogo;
  let showLogo: boolean | undefined;
  if (showLogoRaw === '1' || showLogoRaw === 'true') showLogo = true;
  if (showLogoRaw === '0' || showLogoRaw === 'false') showLogo = false;
  const primaryColor =
    typeof query.primaryColor === 'string' ? query.primaryColor : undefined;

  if (!theme && !size && borderRadius === undefined && showLogo === undefined && !primaryColor) {
    return undefined;
  }

  return {
    theme,
    size,
    borderRadius: Number.isFinite(borderRadius) ? borderRadius : undefined,
    showLogo,
    primaryColor,
  };
}
