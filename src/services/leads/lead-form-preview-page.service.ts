import { LeadForm } from '@/models/LeadForm';
import { getOrganizationWebsite } from '@/utils/embed-allowed-domains.util';
import {
  getOrganizationPlanId,
  resolveProductBrandingVisible,
} from '@/utils/branding-plan.util';
import { resolveSafeExternalHttpsUrl } from '@/utils/safe-external-url.util';

const MAX_HTML_BYTES = 2_500_000;
const FETCH_TIMEOUT_MS = 12_000;
const SECTION_CLOSE = '</section>';

export interface LeadFormPreviewAppearanceAttrs {
  theme?: string;
  size?: string;
  borderRadius?: number;
  showLogo?: boolean;
  primaryColor?: string;
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;');
}

function appearanceDataAttrs(appearance?: LeadFormPreviewAppearanceAttrs): string {
  if (!appearance) return '';
  let attrs = '';
  if (appearance.theme) attrs += ` data-preview-theme="${escapeAttr(appearance.theme)}"`;
  if (appearance.size) attrs += ` data-preview-size="${escapeAttr(appearance.size)}"`;
  if (typeof appearance.borderRadius === 'number' && !Number.isNaN(appearance.borderRadius)) {
    attrs += ` data-preview-border-radius="${appearance.borderRadius}"`;
  }
  if (typeof appearance.showLogo === 'boolean') {
    attrs += ` data-preview-show-logo="${appearance.showLogo ? '1' : '0'}"`;
  }
  if (appearance.primaryColor) {
    attrs += ` data-preview-primary-color="${escapeAttr(appearance.primaryColor)}"`;
  }
  return attrs;
}

export function injectAfterSection(html: string, sectionIndex: number, injection: string): string {
  if (sectionIndex <= 0) {
    const bodyOpen = html.search(/<body\b[^>]*>/i);
    if (bodyOpen === -1) return injection + html;
    const insertAt = html.indexOf('>', bodyOpen) + 1;
    return html.slice(0, insertAt) + injection + html.slice(insertAt);
  }

  let pos = 0;
  let count = 0;
  const closeLower = SECTION_CLOSE.toLowerCase();
  const htmlLower = html.toLowerCase();

  while (count < sectionIndex) {
    const idx = htmlLower.indexOf(closeLower, pos);
    if (idx === -1) break;
    pos = idx + SECTION_CLOSE.length;
    count += 1;
  }

  if (count < sectionIndex) {
    const bodyClose = html.search(/<\/body>/i);
    if (bodyClose === -1) return html + injection;
    return html.slice(0, bodyClose) + injection + html.slice(bodyClose);
  }

  return html.slice(0, pos) + injection + html.slice(pos);
}

export function sanitizePreviewHtml(html: string): string {
  let out = html;
  out = out.replace(/<base\b[^>]*>/gi, '');
  out = out.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '');
  out = out.replace(/<script\b[^>]*\/>/gi, '');
  out = out.replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  out = out.replace(
    /<meta\b[^>]*http-equiv\s*=\s*["']?refresh["']?[^>]*>/gi,
    '',
  );
  out = out.replace(
    /<meta\b[^>]*content\s*=\s*["'][^"']*frame-ancestors[^"']*["'][^>]*>/gi,
    '',
  );
  return out;
}

export function ensureBaseTag(html: string, siteUrl: string): string {
  // Não usamos <base> — quebraria /leads/form.js (resolveria no domínio do cliente).
  return html;
}

/** Converte href/src raiz (/foo) para URL absoluta do site do cliente. */
export function absolutizeRootRelativeUrls(html: string, siteUrl: string): string {
  let origin: string;
  try {
    origin = new URL(siteUrl).origin;
  } catch {
    return html;
  }
  return html.replace(
    /(\s(?:href|src)=["'])\/(?!\/)([^"']*)(["'])/gi,
    (_match, prefix: string, path: string, quote: string) =>
      `${prefix}${origin}/${path}${quote}`,
  );
}

const PREVIEW_HEAD_FIX =
  '<style id="rz-lead-preview-fix">' +
  '.reveal,.reveal.visible{opacity:1!important;transform:none!important;}' +
  '#rz-lead-preview-marker{text-align:center;padding:10px 16px;font:11px/1.4 system-ui,sans-serif;' +
  'color:#94a3b8;background:rgba(15,23,42,.55);border-top:1px dashed rgba(148,163,184,.35);' +
  'border-bottom:1px dashed rgba(148,163,184,.35);}' +
  'html{scroll-behavior:auto;}' +
  '</style>';

export function injectPreviewHeadFixes(html: string): string {
  let out = html;
  if (!/\bdata-theme=/i.test(out) && /<html\b/i.test(out)) {
    out = out.replace(/<html\b/i, '<html data-theme="dark"');
  }
  if (/<\/head>/i.test(out)) {
    return out.replace(/<\/head>/i, `${PREVIEW_HEAD_FIX}\n</head>`);
  }
  if (/<head\b[^>]*>/i.test(out)) {
    return out.replace(/<head\b[^>]*>/i, match => `${match}\n${PREVIEW_HEAD_FIX}`);
  }
  return PREVIEW_HEAD_FIX + out;
}

export function countSections(html: string): number {
  const htmlLower = html.toLowerCase();
  let count = 0;
  let pos = 0;
  while (true) {
    const idx = htmlLower.indexOf(SECTION_CLOSE.toLowerCase(), pos);
    if (idx === -1) break;
    count += 1;
    pos = idx + SECTION_CLOSE.length;
  }
  return count;
}

async function fetchSiteHtml(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Radar Chat-LeadPreview/1.0 (+https://radarchat.com.br)',
        Accept: 'text/html,application/xhtml+xml',
      },
      redirect: 'follow',
    });
    if (!res.ok) {
      throw new Error(`Site retornou HTTP ${res.status}`);
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength > MAX_HTML_BYTES) {
      throw new Error('Página do site muito grande para prévia');
    }
    return new TextDecoder('utf-8', { fatal: false }).decode(buf);
  } finally {
    clearTimeout(timer);
  }
}

function buildRelocateScript(initialSection: number): string {
  const initial = Math.max(0, Math.min(20, Math.floor(initialSection)));
  return (
    '<script id="rz-lead-preview-relocate">' +
    '(function(){' +
    'var INITIAL=' +
    initial +
    ';' +
    'function relocate(sectionIndex){' +
    'var block=document.getElementById("rz-lead-preview-block");' +
    'if(!block)return;' +
    'var n=Math.max(0,parseInt(sectionIndex,10)||0);' +
    'if(n<=0){document.body.insertBefore(block,document.body.firstChild);}' +
    'else{' +
    'var sections=document.querySelectorAll("section");' +
    'var anchor=sections[n-1];' +
    'if(!anchor){document.body.appendChild(block);}' +
    'else if(anchor.nextSibling){anchor.parentNode.insertBefore(block,anchor.nextSibling);}' +
    'else{anchor.parentNode.appendChild(block);}' +
    '}' +
    'var mount=document.getElementById("form-mount");' +
    'if(mount){try{mount.scrollIntoView({block:"start",behavior:"smooth"});}catch(e){}}' +
    '}' +
    'window.addEventListener("message",function(ev){' +
    'if(!ev.data||ev.data.type!=="rz-lead-preview-section")return;' +
    'relocate(ev.data.section);' +
    '});' +
    'if(document.readyState==="loading"){document.addEventListener("DOMContentLoaded",function(){relocate(INITIAL);});}' +
    'else{relocate(INITIAL);}' +
    '})();' +
    '</script>'
  );
}

function buildInjection(
  publicKey: string,
  sectionIndex: number,
  appearance?: LeadFormPreviewAppearanceAttrs,
): string {
  const attrs = appearanceDataAttrs(appearance);
  return (
    '\n<!-- Radar Chat lead preview slot -->\n' +
    '<div id="rz-lead-preview-block">\n' +
    '<div id="rz-lead-preview-marker">↕ Formulário inserido aqui — o site continua empurrado abaixo</div>\n' +
    `<div id="form-mount"${attrs} style="margin:0 auto;padding:12px 20px 32px;box-sizing:border-box;min-height:80px;"></div>\n` +
    '</div>\n' +
    `<script src="/leads/form.js" data-form-key="${publicKey}" data-container="form-mount" async></script>\n` +
    buildRelocateScript(sectionIndex)
  );
}

export function buildPreviewRelocateScript(initialSection: number): string {
  return buildRelocateScript(initialSection);
}

export class LeadFormPreviewPageService {
  private static instance: LeadFormPreviewPageService;

  static getInstance(): LeadFormPreviewPageService {
    if (!LeadFormPreviewPageService.instance) {
      LeadFormPreviewPageService.instance = new LeadFormPreviewPageService();
    }
    return LeadFormPreviewPageService.instance;
  }

  async buildPreviewPage(options: {
    publicKey: string;
    sectionIndex: number;
    appearance?: LeadFormPreviewAppearanceAttrs;
  }): Promise<{ html: string; siteOrigin: string; sectionCount: number }> {
    const form = await LeadForm.findOne({ publicKey: options.publicKey.trim() })
      .select('clientId publicKey appearance')
      .lean();
    if (!form) throw new Error('Formulário não encontrado');

    const planId = await getOrganizationPlanId(String(form.clientId));
    const storedShowLogo = Boolean((form.appearance as { showLogo?: boolean } | undefined)?.showLogo);
    const previewShowLogo =
      options.appearance?.showLogo !== undefined
        ? options.appearance.showLogo
        : storedShowLogo;
    const appearance: LeadFormPreviewAppearanceAttrs | undefined = {
      ...(options.appearance ?? {}),
      showLogo: resolveProductBrandingVisible(planId, previewShowLogo),
    };

    const website = await getOrganizationWebsite(String(form.clientId));
    const siteUrl = resolveSafeExternalHttpsUrl(website);
    if (!siteUrl) throw new Error('Site da empresa não configurado ou URL inválida');

    const raw = await fetchSiteHtml(siteUrl);
    const sectionCount = countSections(raw);
    const section = Math.max(0, Math.min(sectionCount || 12, options.sectionIndex));

    let html = sanitizePreviewHtml(raw);
    html = absolutizeRootRelativeUrls(html, siteUrl);
    html = injectPreviewHeadFixes(html);
    html = injectAfterSection(html, section, buildInjection(options.publicKey, section, appearance));

    return {
      html,
      siteOrigin: new URL(siteUrl).origin,
      sectionCount,
    };
  }
}
