import type { AiMode } from './ai-assistant';

/**
 * Modo de atendimento (conceito de produto) — separado do provedor/credencial LLM.
 * Persistido em `AiSettings.attendanceMode` desde a Fase 3.
 */
export type AttendanceMode =
  | 'disabled'
  | 'robotic'
  | 'basic_triage'
  | 'premium_assistant';

export const ATTENDANCE_MODE_VALUES: readonly AttendanceMode[] = [
  'disabled',
  'robotic',
  'basic_triage',
  'premium_assistant',
] as const;

/** Quem fornece/paga a credencial da IA generativa (legado: `AiSettings.mode`). */
export type AiCredentialSource = 'none' | 'radarzap' | 'company';

export interface AttendanceUiSelection {
  attendanceMode: AttendanceMode;
  credentialSource: AiCredentialSource;
}

export function isValidAttendanceMode(value: unknown): value is AttendanceMode {
  return typeof value === 'string' && (ATTENDANCE_MODE_VALUES as readonly string[]).includes(value);
}

/** Modos ainda não disponíveis na UI (Fase 5). */
export function isAttendanceModeSelectable(mode: AttendanceMode): boolean {
  return mode !== 'basic_triage';
}

/** @deprecated use isAttendanceModeSelectable */
export const isAttendanceModeSelectableInPhase1 = isAttendanceModeSelectable;

/** Infere modo de atendimento a partir do campo legado `AiSettings.mode` (sem `attendanceMode`). */
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

/** Resolve `attendanceMode` persistido ou infere do legado. */
export function resolveAttendanceMode(settings: {
  mode: AiMode;
  attendanceMode?: AttendanceMode | null;
}): AttendanceMode {
  if (isValidAttendanceMode(settings.attendanceMode)) {
    return settings.attendanceMode;
  }
  return inferAttendanceModeFromLegacyMode(settings.mode);
}

/** Converte seleção da UI para payload legado (`mode` + `enabled`) — runtime LLM usa isto. */
export function legacySettingsFromAttendanceSelection(
  selection: AttendanceUiSelection,
): { mode: AiMode; enabled: boolean } {
  const { attendanceMode, credentialSource } = selection;

  if (attendanceMode === 'disabled' || attendanceMode === 'robotic') {
    return { mode: 'disabled', enabled: false };
  }

  if (attendanceMode === 'basic_triage') {
    return { mode: 'disabled', enabled: false };
  }

  if (credentialSource === 'radarzap') {
    return { mode: 'radarzap', enabled: true };
  }
  if (credentialSource === 'company') {
    return { mode: 'company', enabled: true };
  }

  return { mode: 'disabled', enabled: false };
}

/** Payload completo para gravar settings (Fase 3+). */
export function attendanceSettingsPatchFromSelection(
  selection: AttendanceUiSelection,
): { attendanceMode: AttendanceMode; mode: AiMode; enabled: boolean } {
  return {
    attendanceMode: selection.attendanceMode,
    ...legacySettingsFromAttendanceSelection(selection),
  };
}

/** Estado da UI a partir das settings do servidor. */
export function attendanceSelectionFromSettings(settings: {
  mode: AiMode;
  enabled?: boolean;
  attendanceMode?: AttendanceMode | null;
}): AttendanceUiSelection {
  const attendanceMode = resolveAttendanceMode(settings);
  let credentialSource = inferCredentialSourceFromLegacyMode(settings.mode);
  if (attendanceMode !== 'premium_assistant') {
    credentialSource = 'none';
  }
  return { attendanceMode, credentialSource };
}

/** @deprecated use attendanceSelectionFromSettings */
export function attendanceSelectionFromLegacySettings(settings: {
  mode: AiMode;
  enabled?: boolean;
}): AttendanceUiSelection {
  return attendanceSelectionFromSettings(settings);
}

/** Backfill: deriva `attendanceMode` quando ausente no documento. */
export function syncAttendanceModeFromLegacy(settings: {
  mode: AiMode;
  attendanceMode?: AttendanceMode | null;
}): AttendanceMode {
  if (isValidAttendanceMode(settings.attendanceMode)) {
    return settings.attendanceMode;
  }
  return inferAttendanceModeFromLegacyMode(settings.mode);
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

/** LLM deve rodar apenas no modo Premium com credencial ativa. */
export function shouldRunGenerativeAi(settings: {
  mode: AiMode;
  enabled?: boolean;
  attendanceMode?: AttendanceMode | null;
}): boolean {
  const mode = resolveAttendanceMode(settings);
  if (mode !== 'premium_assistant') return false;
  return isLegacyGenerativeAiActive(settings);
}
