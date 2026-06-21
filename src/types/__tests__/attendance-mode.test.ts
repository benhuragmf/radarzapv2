import {
  attendanceSelectionFromLegacySettings,
  inferAttendanceModeFromLegacyMode,
  inferCredentialSourceFromLegacyMode,
  isAttendanceModeSelectableInPhase1,
  legacySettingsFromAttendanceSelection,
} from '@/types/attendance-mode';

describe('attendance-mode adapter', () => {
  it('disabled → attendanceMode disabled + credential none', () => {
    expect(inferAttendanceModeFromLegacyMode('disabled')).toBe('disabled');
    expect(inferCredentialSourceFromLegacyMode('disabled')).toBe('none');
    expect(attendanceSelectionFromLegacySettings({ mode: 'disabled' })).toEqual({
      attendanceMode: 'disabled',
      credentialSource: 'none',
    });
  });

  it('radarzap → premium_assistant + credential radarzap', () => {
    expect(inferAttendanceModeFromLegacyMode('radarzap')).toBe('premium_assistant');
    expect(inferCredentialSourceFromLegacyMode('radarzap')).toBe('radarzap');
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'premium_assistant',
        credentialSource: 'radarzap',
      }),
    ).toEqual({ mode: 'radarzap', enabled: true });
  });

  it('company → premium_assistant + credential company', () => {
    expect(inferAttendanceModeFromLegacyMode('company')).toBe('premium_assistant');
    expect(inferCredentialSourceFromLegacyMode('company')).toBe('company');
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'premium_assistant',
        credentialSource: 'company',
      }),
    ).toEqual({ mode: 'company', enabled: true });
  });

  it('robotic salva legado disabled sem ativar IA', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'robotic',
        credentialSource: 'none',
      }),
    ).toEqual({ mode: 'disabled', enabled: false });
  });

  it('basic_triage não ativa IA externa (fase 1)', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'basic_triage',
        credentialSource: 'radarzap',
      }),
    ).toEqual({ mode: 'disabled', enabled: false });
  });

  it('premium sem credencial cai em disabled', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'premium_assistant',
        credentialSource: 'none',
      }),
    ).toEqual({ mode: 'disabled', enabled: false });
  });

  it('IA Básica não é selecionável na fase 1', () => {
    expect(isAttendanceModeSelectableInPhase1('basic_triage')).toBe(false);
    expect(isAttendanceModeSelectableInPhase1('robotic')).toBe(true);
    expect(isAttendanceModeSelectableInPhase1('premium_assistant')).toBe(true);
  });
});
