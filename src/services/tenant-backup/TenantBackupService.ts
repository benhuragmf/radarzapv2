import mongoose from 'mongoose';
import { Organization } from '@/models/Organization';
import { Destination } from '@/models/Destination';
import { ContactGroup } from '@/models/ContactGroup';
import { InboxSettings } from '@/models/InboxSettings';
import { InboxDepartment } from '@/models/InboxDepartment';
import { Rule } from '@/models/Rule';
import { Template } from '@/models/Template';
import { DiscordChannel } from '@/models/DiscordChannel';
import { BirthdayAutomationRule } from '@/models/BirthdayAutomationRule';
import { WebhookEndpoint } from '@/models/WebhookEndpoint';
import { ApiKey } from '@/models/ApiKey';
import { createServiceLogger } from '@/utils/logger';
import { encryptField, decryptField } from '@/utils/field-encryption';

const logger = createServiceLogger('TenantBackup');
export const TENANT_BACKUP_VERSION = '2.5.0';
export const BACKUP_ENCRYPTED_FORMAT = 'radarchat-backup-encrypted';

export type EncryptedBackupExport = {
  format: typeof BACKUP_ENCRYPTED_FORMAT;
  version: string;
  ciphertext: string;
};

export type TenantBackupPayload = {
  version: string;
  exportedAt: string;
  organizationId: string;
  data: {
    organization?: Record<string, unknown>;
    destinations: Record<string, unknown>[];
    contactGroups: Record<string, unknown>[];
    inboxSettings: Record<string, unknown> | null;
    inboxDepartments: Record<string, unknown>[];
    rules: Record<string, unknown>[];
    templates: Record<string, unknown>[];
    discordChannels: Record<string, unknown>[];
    birthdayRules: Record<string, unknown>[];
    webhookEndpoints: Record<string, unknown>[];
    apiKeys: Record<string, unknown>[];
  };
};

function stripMongo<T extends Record<string, unknown>>(doc: T): T {
  const { __v, ...rest } = doc;
  return rest as T;
}

export class TenantBackupService {
  private static instance: TenantBackupService;

  static getInstance(): TenantBackupService {
    if (!TenantBackupService.instance) TenantBackupService.instance = new TenantBackupService();
    return TenantBackupService.instance;
  }

  static isEncryptedExport(body: unknown): body is EncryptedBackupExport {
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as EncryptedBackupExport).format === BACKUP_ENCRYPTED_FORMAT
    );
  }

  static parseImportPayload(raw: unknown): TenantBackupPayload {
    if (TenantBackupService.isEncryptedExport(raw)) {
      const json = decryptField(raw.ciphertext);
      return JSON.parse(json) as TenantBackupPayload;
    }
    return raw as TenantBackupPayload;
  }

  wrapExportPayload(payload: TenantBackupPayload): TenantBackupPayload | EncryptedBackupExport {
    if (process.env.BACKUP_ENCRYPT_EXPORT !== 'true') return payload;
    return {
      format: BACKUP_ENCRYPTED_FORMAT,
      version: TENANT_BACKUP_VERSION,
      ciphertext: encryptField(JSON.stringify(payload)),
    };
  }

  async exportOrganization(organizationId: string): Promise<TenantBackupPayload> {
    const oid = new mongoose.Types.ObjectId(organizationId);
    const clientFilter = { clientId: oid };

    const [
      org,
      destinations,
      contactGroups,
      inboxSettings,
      inboxDepartments,
      rules,
      templates,
      discordChannels,
      birthdayRules,
      webhookEndpoints,
      apiKeys,
    ] = await Promise.all([
      Organization.findById(oid).lean(),
      Destination.find(clientFilter).lean(),
      ContactGroup.find(clientFilter).lean(),
      InboxSettings.findOne(clientFilter).lean(),
      InboxDepartment.find(clientFilter).lean(),
      Rule.find(clientFilter).lean(),
      Template.find(clientFilter).lean(),
      DiscordChannel.find(clientFilter).lean(),
      BirthdayAutomationRule.find(clientFilter).lean(),
      WebhookEndpoint.find({ organizationId: oid }).lean(),
      ApiKey.find({ organizationId: oid }).select('-keyHash').lean(),
    ]);

    if (!org) throw new Error('Organização não encontrada');

    const orgSafe = stripMongo({ ...org } as Record<string, unknown>);
    delete orgSafe.stripeSubscriptionId;

    return {
      version: TENANT_BACKUP_VERSION,
      exportedAt: new Date().toISOString(),
      organizationId,
      data: {
        organization: orgSafe,
        destinations: destinations.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        contactGroups: contactGroups.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        inboxSettings: inboxSettings
          ? stripMongo({ ...inboxSettings } as Record<string, unknown>)
          : null,
        inboxDepartments: inboxDepartments.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        rules: rules.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        templates: templates.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        discordChannels: discordChannels.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        birthdayRules: birthdayRules.map(d => stripMongo({ ...d } as Record<string, unknown>)),
        webhookEndpoints: webhookEndpoints.map(d => {
          const row = stripMongo({ ...d } as Record<string, unknown>);
          delete row.secret;
          return row;
        }),
        apiKeys: apiKeys.map(d => stripMongo({ ...d } as Record<string, unknown>)),
      },
    };
  }

  async importOrganization(
    organizationId: string,
    payload: TenantBackupPayload,
    opts: { replace?: boolean } = {},
  ): Promise<{ imported: Record<string, number> }> {
    if (payload.version !== TENANT_BACKUP_VERSION) {
      logger.warn('Versão de backup diferente', {
        expected: TENANT_BACKUP_VERSION,
        got: payload.version,
      });
    }
    if (payload.organizationId !== organizationId) {
      throw new Error('Backup pertence a outra organização');
    }

    const oid = new mongoose.Types.ObjectId(organizationId);
    const org = await Organization.findById(oid).select('linkedGuildIds').lean();
    const linkedGuilds = new Set(org?.linkedGuildIds ?? []);
    const counts: Record<string, number> = {};

    if (opts.replace) {
      await Promise.all([
        Destination.deleteMany({ clientId: oid }),
        ContactGroup.deleteMany({ clientId: oid }),
        InboxDepartment.deleteMany({ clientId: oid }),
        Rule.deleteMany({ clientId: oid }),
        Template.deleteMany({ clientId: oid }),
        DiscordChannel.deleteMany({ clientId: oid }),
        BirthdayAutomationRule.deleteMany({ clientId: oid }),
      ]);
    }

    for (const row of payload.data.destinations) {
      const identifier = String(row.identifier ?? '');
      if (!identifier) continue;
      const { _id, createdAt, updatedAt, ...rest } = row;
      await Destination.findOneAndUpdate(
        { clientId: oid, identifier },
        { ...rest, clientId: oid, identifier },
        { upsert: true, new: true },
      );
      counts.destinations = (counts.destinations ?? 0) + 1;
    }

    for (const row of payload.data.contactGroups) {
      const name = String(row.name ?? '');
      if (!name) continue;
      const { _id, createdAt, updatedAt, ...rest } = row;
      await ContactGroup.findOneAndUpdate(
        { clientId: oid, name },
        { ...rest, clientId: oid, name },
        { upsert: true, new: true },
      );
      counts.contactGroups = (counts.contactGroups ?? 0) + 1;
    }

    if (payload.data.inboxSettings) {
      const { _id, createdAt, updatedAt, ...rest } = payload.data.inboxSettings;
      await InboxSettings.findOneAndUpdate(
        { clientId: oid },
        { ...rest, clientId: oid },
        { upsert: true, new: true },
      );
      counts.inboxSettings = 1;
    }

    for (const row of payload.data.inboxDepartments) {
      const name = String(row.name ?? '');
      if (!name) continue;
      const { _id, createdAt, updatedAt, ...rest } = row;
      await InboxDepartment.findOneAndUpdate(
        { clientId: oid, name },
        { ...rest, clientId: oid, name },
        { upsert: true, new: true },
      );
      counts.inboxDepartments = (counts.inboxDepartments ?? 0) + 1;
    }

    for (const row of payload.data.rules) {
      const { _id, createdAt, updatedAt, ...rest } = row;
      await Rule.create({ ...rest, clientId: oid });
      counts.rules = (counts.rules ?? 0) + 1;
    }

    for (const row of payload.data.templates) {
      const name = String(row.name ?? '');
      if (!name) continue;
      const { _id, createdAt, updatedAt, ...rest } = row;
      await Template.findOneAndUpdate(
        { clientId: oid, name },
        { ...rest, clientId: oid, name },
        { upsert: true, new: true },
      );
      counts.templates = (counts.templates ?? 0) + 1;
    }

    for (const row of payload.data.discordChannels) {
      const channelId = String(row.channelId ?? '');
      const guildId = String(row.guildId ?? '');
      if (!channelId || !guildId) continue;
      if (linkedGuilds.size > 0 && !linkedGuilds.has(guildId)) {
        logger.warn('Ignorando canal Discord de guild não vinculada', { guildId, organizationId });
        continue;
      }
      const { _id, createdAt, updatedAt, ...rest } = row;
      await DiscordChannel.findOneAndUpdate(
        { guildId, channelId },
        { ...rest, clientId: oid, guildId, channelId },
        { upsert: true, new: true },
      );
      counts.discordChannels = (counts.discordChannels ?? 0) + 1;
    }

    for (const row of payload.data.birthdayRules) {
      const { _id, createdAt, updatedAt, ...rest } = row;
      await BirthdayAutomationRule.create({ ...rest, clientId: oid });
      counts.birthdayRules = (counts.birthdayRules ?? 0) + 1;
    }

    logger.info('Backup importado', { organizationId, counts });
    return { imported: counts };
  }
}
