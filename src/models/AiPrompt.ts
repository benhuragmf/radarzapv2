import mongoose, { Schema, Document } from 'mongoose';
import { DEFAULT_AI_SYSTEM_PROMPT } from '@/types/ai-assistant';

export interface IAiPrompt extends Document {
  clientId: mongoose.Types.ObjectId;
  /** Nome exibido ao cliente (vazio = padrão RadarZap do blueprint global). */
  agentName: string;
  /** Saudação quando o contato já tem nome no cadastro (vazio = blueprint global). */
  greetingKnown: string;
  /** Saudação para contato sem nome (vazio = blueprint global). */
  greetingUnknown: string;
  /** SOUL — persona, tom e limites do assistente. */
  systemPrompt: string;
  /** IDENTITY — nome, emoji e vibe do assistente virtual. */
  identityBlock: string;
  /** AGENTS — regras operacionais e fluxo de atendimento. */
  agentsGuide: string;
  /** TOOLS — notas sobre processos/ferramentas (não confundir com skills aprendidas). */
  toolsNotes: string;
  /** Regras extras (legado — mesclado com agentsGuide no prompt). */
  customRules: string;
  /** Usar dados do cadastro (contato, tickets) no prompt — economiza tokens. */
  useSystemContext: boolean;
  /** Não pedir dados que já existem no cadastro. */
  skipKnownFields: boolean;
  /** Tentar resolver com base de conhecimento + skills antes de chamar LLM. */
  autoResolveEnabled: boolean;
  /** Aprendizado automático de skills (ficam pendentes até aprovação). */
  learnSkillsEnabled: boolean;
  /** Aprendizado de memória curada (MEMORY — pendente até aprovação). */
  learnMemoryEnabled: boolean;
  collectName: boolean;
  collectEmail: boolean;
  collectProblem: boolean;
  collectCpfCnpj: boolean;
  collectAddress: boolean;
  collectOrderNumber: boolean;
  collectUrgency: boolean;
  collectAttachments: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const AiPromptSchema = new Schema<IAiPrompt>(
  {
    clientId: { type: Schema.Types.ObjectId, required: true, unique: true, index: true },
    agentName: { type: String, default: '', maxlength: 80 },
    greetingKnown: { type: String, default: '', maxlength: 500 },
    greetingUnknown: { type: String, default: '', maxlength: 500 },
    systemPrompt: { type: String, default: DEFAULT_AI_SYSTEM_PROMPT, maxlength: 8000 },
    identityBlock: { type: String, default: '', maxlength: 2000 },
    agentsGuide: { type: String, default: '', maxlength: 6000 },
    toolsNotes: { type: String, default: '', maxlength: 4000 },
    customRules: { type: String, default: '', maxlength: 6000 },
    useSystemContext: { type: Boolean, default: true },
    skipKnownFields: { type: Boolean, default: true },
    autoResolveEnabled: { type: Boolean, default: true },
    learnSkillsEnabled: { type: Boolean, default: true },
    learnMemoryEnabled: { type: Boolean, default: true },
    collectName: { type: Boolean, default: true },
    collectEmail: { type: Boolean, default: true },
    collectProblem: { type: Boolean, default: true },
    collectCpfCnpj: { type: Boolean, default: false },
    collectAddress: { type: Boolean, default: false },
    collectOrderNumber: { type: Boolean, default: false },
    collectUrgency: { type: Boolean, default: true },
    collectAttachments: { type: Boolean, default: true },
  },
  { timestamps: true, collection: 'aiPrompts' },
);

export const AiPrompt = mongoose.model<IAiPrompt>('AiPrompt', AiPromptSchema);
