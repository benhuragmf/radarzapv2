import mongoose, { Schema, Document } from 'mongoose';
import { PLATFORM_AI_BLUEPRINT_DEFAULTS } from '@/constants/ai-platform-blueprint-defaults';

/** Blueprint global da IA — único documento, gerido pelo admin Radar Chat. */
export interface IPlatformAiBlueprint extends Document {
  key: 'global';
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
  updatedByUserId?: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const PlatformAiBlueprintSchema = new Schema<IPlatformAiBlueprint>(
  {
    key: { type: String, required: true, unique: true, default: 'global', enum: ['global'] },
    agentName: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.agentName, maxlength: 80 },
    identity: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.identity, maxlength: 8000 },
    soul: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.soul, maxlength: 8000 },
    agents: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.agents, maxlength: 12000 },
    tools: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.tools, maxlength: 6000 },
    memoryGuide: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.memoryGuide, maxlength: 4000 },
    skillsGuide: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.skillsGuide, maxlength: 4000 },
    knowledgeGuide: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.knowledgeGuide, maxlength: 4000 },
    finalRules: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.finalRules, maxlength: 4000 },
    greetingKnown: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.greetingKnown, maxlength: 500 },
    greetingUnknown: { type: String, default: PLATFORM_AI_BLUEPRINT_DEFAULTS.greetingUnknown, maxlength: 500 },
    version: { type: Number, default: 1, min: 1 },
    updatedByUserId: { type: Schema.Types.ObjectId },
  },
  { timestamps: true, collection: 'platformAiBlueprints' },
);

export const PlatformAiBlueprint = mongoose.model<IPlatformAiBlueprint>(
  'PlatformAiBlueprint',
  PlatformAiBlueprintSchema,
);
