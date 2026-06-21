import {
  attendanceSelectionFromSettings,
  attendanceSettingsPatchFromSelection,
  inferAttendanceModeFromLegacyMode,
  inferCredentialSourceFromLegacyMode,
  isAttendanceModeSelectable,
  isValidAttendanceMode,
  legacySettingsFromAttendanceSelection,
  resolveAttendanceMode,
  shouldRunGenerativeAi,
  effectiveWebChatPremiumAi,
  webChatPremiumAiAllowed,
} from '@/types/attendance-mode';

describe('attendance-mode adapter', () => {
  it('disabled → attendanceMode disabled + credential none', () => {
    expect(inferAttendanceModeFromLegacyMode('disabled')).toBe('disabled');
    expect(inferCredentialSourceFromLegacyMode('disabled')).toBe('none');
    expect(attendanceSelectionFromSettings({ mode: 'disabled' })).toEqual({
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
      attendanceSettingsPatchFromSelection({
        attendanceMode: 'robotic',
        credentialSource: 'none',
      }),
    ).toEqual({ attendanceMode: 'robotic', mode: 'disabled', enabled: false });
  });

  it('basic_triage não ativa IA externa', () => {
    expect(
      attendanceSettingsPatchFromSelection({
        attendanceMode: 'basic_triage',
        credentialSource: 'radarzap',
      }),
    ).toEqual({ attendanceMode: 'basic_triage', mode: 'disabled', enabled: false });
  });

  it('premium sem credencial cai em disabled', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'premium_assistant',
        credentialSource: 'none',
      }),
    ).toEqual({ mode: 'disabled', enabled: false });
  });

  it('IA Básica é selecionável na UI (Fase 5)', () => {
    expect(isAttendanceModeSelectable('basic_triage')).toBe(true);
    expect(isAttendanceModeSelectable('robotic')).toBe(true);
    expect(isAttendanceModeSelectable('premium_assistant')).toBe(true);
  });

  it('resolveAttendanceMode prioriza campo persistido', () => {
    expect(
      resolveAttendanceMode({ mode: 'disabled', attendanceMode: 'robotic' }),
    ).toBe('robotic');
    expect(
      attendanceSelectionFromSettings({ mode: 'disabled', attendanceMode: 'robotic' }),
    ).toEqual({ attendanceMode: 'robotic', credentialSource: 'none' });
  });

  it('shouldRunGenerativeAi só no premium com mode ativo', () => {
    expect(
      shouldRunGenerativeAi({ mode: 'radarzap', enabled: true, attendanceMode: 'premium_assistant' }),
    ).toBe(true);
    expect(
      shouldRunGenerativeAi({ mode: 'disabled', enabled: false, attendanceMode: 'robotic' }),
    ).toBe(false);
    expect(
      shouldRunGenerativeAi({ mode: 'radarzap', enabled: true, attendanceMode: 'robotic' }),
    ).toBe(false);
  });

  it('isValidAttendanceMode valida enum', () => {
    expect(isValidAttendanceMode('robotic')).toBe(true);
    expect(isValidAttendanceMode('invalid')).toBe(false);
  });

  it('effectiveWebChatPremiumAi exige modo Premium + toggle widget', () => {
    const premium = { mode: 'radarzap' as const, enabled: true, attendanceMode: 'premium_assistant' as const };
    expect(effectiveWebChatPremiumAi(true, premium)).toBe(true);
    expect(effectiveWebChatPremiumAi(false, premium)).toBe(false);
    expect(
      effectiveWebChatPremiumAi(true, { mode: 'disabled', enabled: false, attendanceMode: 'basic_triage' }),
    ).toBe(false);
    expect(webChatPremiumAiAllowed(premium)).toBe(true);
    expect(webChatPremiumAiAllowed({ mode: 'disabled', attendanceMode: 'robotic' })).toBe(false);
  });
});
