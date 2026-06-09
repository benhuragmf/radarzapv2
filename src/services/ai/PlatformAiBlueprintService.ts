import mongoose from 'mongoose';
import { PlatformAiBlueprint, IPlatformAiBlueprint } from '@/models/PlatformAiBlueprint';
import { PLATFORM_AI_BLUEPRINT_DEFAULTS } from '@/constants/ai-platform-blueprint-defaults';

export type PlatformAiBlueprintPayload = {
  agentName: string;
  identity: string;
  soul: string;
  agents: string;
  tools: string;
  memoryGuide: string;
  skillsGuide: string;
  knowledgeGuide: string;
  finalRules: string;
  greetingKnown: string;
  greetingUnknown: string;
  version: number;
  updatedAt: Date;
};

export class PlatformAiBlueprintService {
  private static instance: PlatformAiBlueprintService;

  static getInstance(): PlatformAiBlueprintService {
    if (!this.instance) this.instance = new PlatformAiBlueprintService();
    return this.instance;
  }

  async getGlobal(): Promise<IPlatformAiBlueprint> {
    let doc = await PlatformAiBlueprint.findOne({ key: 'global' });
    if (!doc) {
      doc = await PlatformAiBlueprint.create({ key: 'global', ...PLATFORM_AI_BLUEPRINT_DEFAULTS });
    }
    return doc;
  }

  toPayload(doc: IPlatformAiBlueprint): PlatformAiBlueprintPayload {
    return {
      agentName: doc.agentName,
      identity: doc.identity,
      soul: doc.soul,
      agents: doc.agents,
      tools: doc.tools,
      memoryGuide: doc.memoryGuide,
      skillsGuide: doc.skillsGuide,
      knowledgeGuide: doc.knowledgeGuide,
      finalRules: doc.finalRules,
      greetingKnown: doc.greetingKnown,
      greetingUnknown: doc.greetingUnknown,
      version: doc.version,
      updatedAt: doc.updatedAt,
    };
  }

  async updateGlobal(
    patch: Partial<PlatformAiBlueprintPayload>,
    userId: string,
  ): Promise<IPlatformAiBlueprint> {
    const current = await this.getGlobal();
    const set: Record<string, unknown> = {
      updatedByUserId: new mongoose.Types.ObjectId(userId),
      version: (current.version ?? 1) + 1,
    };
    const fields = [
      'agentName',
      'identity',
      'soul',
      'agents',
      'tools',
      'memoryGuide',
      'skillsGuide',
      'knowledgeGuide',
      'finalRules',
      'greetingKnown',
      'greetingUnknown',
    ] as const;
    for (const f of fields) {
      if (typeof patch[f] === 'string') set[f] = patch[f];
    }
    const doc = await PlatformAiBlueprint.findOneAndUpdate(
      { key: 'global' },
      { $set: set },
      { new: true, upsert: true },
    );
    if (!doc) throw new Error('Falha ao salvar blueprint');
    return doc;
  }

  async resetToDefaults(userId: string): Promise<IPlatformAiBlueprint> {
    return this.updateGlobal({ ...PLATFORM_AI_BLUEPRINT_DEFAULTS }, userId);
  }
}
