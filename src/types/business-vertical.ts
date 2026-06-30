import type { AiTransferRules } from '@/types/ai-assistant';
import type { AiCredentialSource, AttendanceMode } from '@/types/attendance-mode';
import type { InboxQuickReply } from '@/types/inbox-quick-replies';
import type { InboxWeeklySchedule } from '@/types/inbox-settings';
import type { WebChatWidgetAppearance } from '@/types/webchat';

export type BusinessVerticalId =
  | 'varejo_fisico'
  | 'ecommerce'
  | 'restaurante'
  | 'clinica'
  | 'escritorio'
  | 'imobiliaria'
  | 'beleza'
  | 'auto_center'
  | 'educacao'
  | 'servicos'
  | 'outro';

export const BUSINESS_VERTICAL_IDS: readonly BusinessVerticalId[] = [
  'varejo_fisico',
  'ecommerce',
  'restaurante',
  'clinica',
  'escritorio',
  'imobiliaria',
  'beleza',
  'auto_center',
  'educacao',
  'servicos',
  'outro',
] as const;

export interface BusinessVerticalDepartmentPreset {
  name: string;
  menuKey: string;
  sortOrder: number;
  description?: string;
}

export interface BusinessVerticalKbArticle {
  title: string;
  content: string;
  category: string;
  keywords: string[];
  showAsQuickReply?: boolean;
  quickReplyLabel?: string;
}

export interface BusinessVerticalInboxPatch {
  welcomeWithCompany?: string;
  welcomeGeneric?: string;
  menuIntro?: string;
  menuFooter?: string;
  queueMessage?: string;
  waitingMessage?: string;
  outsideHoursMessage?: string;
  resolvedMessage?: string;
  businessHoursEnabled?: boolean;
  schedule?: InboxWeeklySchedule;
  csatPrompt?: string;
}

export interface BusinessVerticalWebChatPatch {
  appearance?: Partial<WebChatWidgetAppearance>;
  contactReasonOptions?: string[];
  autoReplyMessage?: string;
  autoReplySenderName?: string;
  proactiveGreetingEnabled?: boolean;
  proactiveGreetingMessage?: string;
  proactiveGreetingDelaySeconds?: number;
  outsideHoursMessage?: string;
}

/** Configuração completa do `AiPrompt` aplicada no onboarding. */
export interface BusinessVerticalAiPromptPatch {
  agentName?: string;
  greetingKnown?: string;
  greetingUnknown?: string;
  systemPrompt?: string;
  agentsGuide?: string;
  collectName?: boolean;
  collectEmail?: boolean;
  collectProblem?: boolean;
  collectCpfCnpj?: boolean;
  collectAddress?: boolean;
  collectOrderNumber?: boolean;
  collectUrgency?: boolean;
  collectAttachments?: boolean;
  useSystemContext?: boolean;
  skipKnownFields?: boolean;
  autoResolveEnabled?: boolean;
  basicTriageLlmFallbackEnabled?: boolean;
  learnSkillsEnabled?: boolean;
  learnMemoryEnabled?: boolean;
}

export interface BusinessVerticalAiSkillPreset {
  title: string;
  triggers: string;
  solution: string;
}

export interface BusinessVerticalAiMemoryPreset {
  title: string;
  content: string;
  tags: string;
}

export interface BusinessVerticalAiSettingsPatch {
  suggestedAttendanceMode: AttendanceMode;
  credentialSource?: AiCredentialSource;
  transferRules?: Partial<AiTransferRules>;
}

export interface BusinessVerticalPreset {
  id: BusinessVerticalId;
  label: string;
  description: string;
  icon: string;
  departments: BusinessVerticalDepartmentPreset[];
  inbox?: BusinessVerticalInboxPatch;
  webChat?: BusinessVerticalWebChatPatch;
  quickRepliesExtra?: InboxQuickReply[];
  knowledgeBase?: BusinessVerticalKbArticle[];
  aiPrompt?: BusinessVerticalAiPromptPatch;
  aiSettings?: BusinessVerticalAiSettingsPatch;
  aiSkills?: BusinessVerticalAiSkillPreset[];
  aiMemories?: BusinessVerticalAiMemoryPreset[];
  suggestedAttendanceMode?: AttendanceMode;
}

export function isBusinessVerticalId(value: unknown): value is BusinessVerticalId {
  return typeof value === 'string' && (BUSINESS_VERTICAL_IDS as readonly string[]).includes(value);
}

export function verticalAiRulesText(patch?: BusinessVerticalAiPromptPatch): string {
  if (!patch) return '';
  return [patch.systemPrompt?.trim(), patch.agentsGuide?.trim()].filter(Boolean).join('\n\n');
}
