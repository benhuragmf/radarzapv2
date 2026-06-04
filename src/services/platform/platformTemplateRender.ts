import mongoose from 'mongoose';
import {
  renderPlatformCatalogTemplate,
  previewPlatformTemplateContent,
} from '@/constants/platform-whatsapp-templates';
import { PlatformTemplate } from '@/models/PlatformTemplate';

function applyVariables(content: string, variables: Record<string, string>): string {
  let rendered = content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }
  return rendered
    .replace(/\{[^}]+\}/g, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Conteúdo efetivo do modelo (override Mongo > catálogo pw-*). */
export async function resolvePlatformTemplateContent(
  clientId: mongoose.Types.ObjectId,
  templateName: string,
): Promise<string | null> {
  const override = await PlatformTemplate.findOne({
    name: templateName,
    clientId,
    isDefault: false,
  }).lean();
  if (override?.content) return override.content;

  const global = await PlatformTemplate.findOne({
    name: templateName,
    clientId: null,
    isDefault: true,
  }).lean();
  if (global?.content) return global.content;

  const catalog = renderPlatformCatalogTemplate(templateName, {});
  return catalog;
}

/** Renderiza pw-* (ou custom) com variáveis do destino. */
export async function renderPlatformTemplateForClient(
  clientId: mongoose.Types.ObjectId,
  templateName: string,
  variables: Record<string, string>,
): Promise<string | null> {
  const catalogOnly = renderPlatformCatalogTemplate(templateName, variables);
  if (catalogOnly) return catalogOnly;

  const content = await resolvePlatformTemplateContent(clientId, templateName);
  if (!content) return null;
  if (Object.keys(variables).length === 0) {
    return previewPlatformTemplateContent(content);
  }
  return applyVariables(content, variables);
}
