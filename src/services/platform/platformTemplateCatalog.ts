import mongoose from 'mongoose';
import {
  PLATFORM_WHATSAPP_TEMPLATES,
  type PlatformWhatsAppKind,
} from '@/constants/platform-whatsapp-templates';
import {
  PlatformTemplate,
  type IPlatformTemplate,
  type PlatformTemplateCategory,
} from '@/models/PlatformTemplate';

function kindToCategory(kind: PlatformWhatsAppKind): PlatformTemplateCategory {
  if (kind === 'auto') return 'informative';
  if (kind === 'birthday' || kind === 'informative' || kind === 'promo' || kind === 'reminder') {
    return kind;
  }
  return 'custom';
}

/** Sincroniza catálogo pw-* global (clientId null) no Mongo. */
export async function ensurePlatformCatalogInMongo(): Promise<void> {
  for (const def of PLATFORM_WHATSAPP_TEMPLATES) {
    const variables = [...new Set(def.variables)];
    await PlatformTemplate.updateOne(
      { name: def.name, clientId: null },
      {
        $set: {
          name: def.name,
          content: def.content,
          description: def.description,
          category: kindToCategory(def.platformKind),
          variables,
          isDefault: true,
          clientId: null,
          organizationId: null,
          updatedAt: new Date(),
        },
        $setOnInsert: {
          usage: { timesUsed: 0, lastUsed: new Date() },
          createdAt: new Date(),
        },
      },
      { upsert: true },
    );
  }
}

export type PlatformTemplateListItem = IPlatformTemplate & {
  _id: mongoose.Types.ObjectId;
  label?: string;
  platformKind?: string;
};

/** Lista catálogo global + overrides do cliente (padrão Discord). */
export async function listMergedPlatformTemplates(
  clientId: mongoose.Types.ObjectId,
): Promise<PlatformTemplateListItem[]> {
  await ensurePlatformCatalogInMongo();

  const globals = await PlatformTemplate.find({ clientId: null, isDefault: true })
    .sort({ category: 1, name: 1 })
    .lean();

  const overrides = await PlatformTemplate.find({
    clientId,
    isDefault: false,
  })
    .sort({ name: 1 })
    .lean();

  const catalogByName = new Map(
    PLATFORM_WHATSAPP_TEMPLATES.map(d => [d.name, d]),
  );

  const overrideByName = new Map(overrides.map(t => [t.name, t]));
  const merged: PlatformTemplateListItem[] = globals.map(g => {
    const override = overrideByName.get(g.name);
    const def = catalogByName.get(g.name);
    const base = (override ?? g) as unknown as PlatformTemplateListItem;
    if (def) {
      base.label = def.label;
      base.platformKind = def.platformKind;
      if (!base.description && def.description) {
        base.description = def.description;
      }
    }
    return base;
  });

  for (const o of overrides) {
    if (!merged.some(m => m.name === o.name)) {
      merged.push(o as unknown as PlatformTemplateListItem);
    }
  }

  return merged;
}
