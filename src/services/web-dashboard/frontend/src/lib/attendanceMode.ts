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
    title: 'Desativado',
    description:
      'Apenas humano, fila, respostas rápidas e chamados. Nenhuma IA generativa conversa com o cliente.',
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
    badge: 'Baixo custo',
    badgeClass: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    note:
      'Classificador local + base de conhecimento; LLM opcional só em ambiguidade (configurável em Economia e regras).',
  },
  {
    id: 'premium_assistant',
    title: 'IA Premium — Assistente Virtual',
    description:
      'Tenta ajudar o cliente usando base de conhecimento, skills, memória e regras de transferência.',
    badge: 'Assistente completo',
    badgeClass: 'bg-brand-500/15 text-brand-400 border-brand-500/30',
    note: 'Representa o comportamento avançado da IA atual quando ativa com credencial configurada.',
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
    description: 'Usa a chave interna da plataforma e respeita os limites do plano.',
  },
  {
    id: 'company',
    title: 'Chave própria da empresa',
    description:
      'A empresa usa sua própria API Key. Os custos externos ficam por conta da empresa.',
  },
  {
    id: 'none',
    title: 'Nenhum / IA desligada',
    description: 'Não usa provedor de IA generativa.',
  },
];
