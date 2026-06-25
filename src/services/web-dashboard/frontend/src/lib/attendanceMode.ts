export type {
  AttendanceMode,
  AiCredentialSource,
  AttendanceUiSelection,
} from '@radarzap-types/attendance-mode';

export {
  attendanceModeLabel,
  attendanceSelectionFromLegacySettings,
  attendanceSelectionFromSettings,
  attendanceSettingsPatchFromSelection,
  credentialSourceLabel,
  inferAttendanceModeFromLegacyMode,
  inferCredentialSourceFromLegacyMode,
  isAttendanceModeSelectable,
  isLegacyGenerativeAiActive,
  legacySettingsFromAttendanceSelection,
  resolveAttendanceMode,
} from '@radarzap-types/attendance-mode';

import type { AttendanceMode } from '@radarzap-types/attendance-mode';

export interface AttendanceModeCardDef {
  id: AttendanceMode;
  title: string;
  description: string;
  badge: string;
  badgeClass: string;
  note?: string;
  example?: string;
  comingSoon?: boolean;
}

export const ATTENDANCE_MODE_CARDS: AttendanceModeCardDef[] = [
  {
    id: 'disabled',
    title: 'Humano/manual',
    description:
      'Envia direto para a fila de atendimento humano. Sem robô nem IA generativa.',
    badge: 'Sem IA',
    badgeClass: 'bg-zinc-500/15 text-zinc-400 border-zinc-500/30',
    note:
      'Desativa a IA generativa. Fluxos fixos, fila e atendimento humano continuam conforme as configurações de Triagem e Bot.',
  },
  {
    id: 'robotic',
    title: 'Atendimento Robotizado',
    description:
      'Menu guiado com opções, botões e respostas fixas. Ideal para organizar o atendimento sem custo de IA.',
    badge: 'Custo IA R$ 0',
    badgeClass: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    example: '1 — Comercial\n2 — Suporte\n3 — Financeiro\n4 — Falar com atendente',
    note:
      'No WhatsApp e no chat do site (modo Robotizado em IA Atendimento), usa a triagem e os setores já configurados.',
  },
  {
    id: 'basic_triage',
    title: 'IA Básica — Triagem Inteligente',
    description:
      'Entende a intenção do cliente e encaminha para o setor correto usando o mínimo possível de IA.',
    badge: '~1 crédito/atendimento típico',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    note:
      'Classificador local + base de conhecimento; LLM opcional só em ambiguidade. Expectativa de ~1 crédito por atendimento com LLM — cobrança real é pelo custo usado.',
  },
  {
    id: 'premium_assistant',
    title: 'IA Premium — Assistente Virtual',
    description:
      'Tenta ajudar o cliente usando base de conhecimento, skills, memória e regras de transferência.',
    badge: '~2 créditos/atendimento típico',
    badgeClass: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    note: 'Assistente conversacional completo. Expectativa de ~2 créditos por turno típico — cobrança real proporcional ao custo de cada chamada LLM.',
  },
  {
    id: 'hybrid',
    title: 'Híbrido',
    description:
      'Combina menu robotizado, triagem básica e IA Premium (se habilitada) com fallback humano.',
    badge: 'Menu + triagem + IA',
    badgeClass: 'bg-violet-500/15 text-violet-400 border-violet-500/30',
    example: 'Menu → intenção → resposta IA → fila humana',
    note:
      'Primeiro o menu de setores; mensagens livres passam por triagem básica; com provedor e créditos, IA Premium pode responder antes de encaminhar.',
  },
];

export interface CredentialSourceCardDef {
  id: 'radarzap' | 'company' | 'none';
  title: string;
  description: string;
}

export const CREDENTIAL_SOURCE_CARDS: CredentialSourceCardDef[] = [
  {
    id: 'radarzap',
    title: 'RadarZap',
    description:
      'Usa a chave interna da plataforma. Limites em chamadas LLM; créditos gastos refletem o custo real de cada cliente.',
  },
  {
    id: 'company',
    title: 'Chave própria da empresa',
    description:
      'A empresa usa sua própria API Key. Os custos externos ficam por conta da empresa — não consome créditos RadarZap.',
  },
  {
    id: 'none',
    title: 'Nenhum / IA desligada',
    description: 'Não usa provedor de IA generativa.',
  },
];
