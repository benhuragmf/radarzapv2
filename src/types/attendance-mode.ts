import type { AiMode } from './ai-assistant';

/**
 * Modo de atendimento (conceito de produto) — separado do provedor/credencial LLM.
 * Fase 1: adapter apenas; persistência dedicada virá na Fase 3 (`attendanceMode` no Mongo).
 */
export type AttendanceMode =
  | 'disabled'
  | 'robotic'
  | 'basic_triage'
  | 'premium_assistant';

/** Quem fornece/paga a credencial da IA generativa (legado: `AiSettings.mode`). */
export type AiCredentialSource = 'none' | 'radarzap' | 'company';

export interface AttendanceUiSelection {
  attendanceMode: AttendanceMode;
  credentialSource: AiCredentialSource;
}

/** Modos que ainda não persistem no backend — seleção válida só na sessão até Fase 3. */
export const ATTENDANCE_MODES_SESSION_ONLY: ReadonlySet<AttendanceMode> = new Set([
  'robotic',
  'basic_triage',
]);

export function isAttendanceModeSelectableInPhase1(mode: AttendanceMode): boolean {
  return mode !== 'basic_triage';
}

/** Infere modo de atendimento a partir do campo legado `AiSettings.mode`. */
export function inferAttendanceModeFromLegacyMode(mode: AiMode): AttendanceMode {
  if (mode === 'disabled') return 'disabled';
  return 'premium_assistant';
}

/** Infere provedor/credencial a partir do campo legado. */
export function inferCredentialSourceFromLegacyMode(mode: AiMode): AiCredentialSource {
  if (mode === 'disabled') return 'none';
  if (mode === 'radarzap') return 'radarzap';
  if (mode === 'company') return 'company';
  return 'none';
}

/** Converte seleção da UI para payload legado (`mode` + `enabled`) — compatível com backend atual. */
export function legacySettingsFromAttendanceSelection(
  selection: AttendanceUiSelection,
): { mode: AiMode; enabled: boolean } {
  const { attendanceMode, credentialSource } = selection;

  if (attendanceMode === 'disabled' || attendanceMode === 'robotic') {
    return { mode: 'disabled', enabled: false };
  }

  if (attendanceMode === 'basic_triage') {
    // Fase 5 — por segurança, não ativa LLM até implementação completa.
    return { mode: 'disabled', enabled: false };
  }

  // premium_assistant
  if (credentialSource === 'radarzap') {
    return { mode: 'radarzap', enabled: true };
  }
  if (credentialSource === 'company') {
    return { mode: 'company', enabled: true };
  }

  return { mode: 'disabled', enabled: false };
}

/** Estado inicial da UI ao carregar settings do servidor. */
export function attendanceSelectionFromLegacySettings(settings: {
  mode: AiMode;
  enabled?: boolean;
}): AttendanceUiSelection {
  const attendanceMode = inferAttendanceModeFromLegacyMode(settings.mode);
  const credentialSource = inferCredentialSourceFromLegacyMode(settings.mode);
  return { attendanceMode, credentialSource };
}

/** Rótulo curto para stats / resumos. */
export function attendanceModeLabel(mode: AttendanceMode): string {
  switch (mode) {
    case 'disabled':
      return 'Desativado';
    case 'robotic':
      return 'Robotizado';
    case 'basic_triage':
      return 'IA Básica';
    case 'premium_assistant':
      return 'IA Premium';
    default:
      return 'Desativado';
  }
}

export function credentialSourceLabel(source: AiCredentialSource): string {
  switch (source) {
    case 'radarzap':
      return 'RadarZap';
    case 'company':
      return 'Chave própria';
    case 'none':
      return 'Nenhum';
    default:
      return 'Nenhum';
  }
}

/** IA generativa (LLM) está ativa no runtime legado. */
export function isLegacyGenerativeAiActive(settings: { mode: AiMode; enabled?: boolean }): boolean {
  return settings.mode !== 'disabled' && settings.enabled !== false;
}
