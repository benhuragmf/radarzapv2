import {
  attendanceSelectionFromSettings,
  attendanceSettingsPatchFromSelection,
  getAttendanceModeLabel,
  inferAttendanceModeFromLegacyMode,
  inferCredentialSourceFromLegacyMode,
  isAiAttendanceMode,
  isAttendanceModeSelectable,
  isHumanOnlyMode,
  isValidAttendanceMode,
  legacySettingsFromAttendanceSelection,
  modeUsesBasicTriageChain,
  modeUsesPremiumAiChain,
  modeUsesRoboticMenu,
  normalizeAttendanceMode,
  requiresAiCredits,
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

  it('hybrid com credencial radarzap ativa LLM legado', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'hybrid',
        credentialSource: 'radarzap',
      }),
    ).toEqual({ mode: 'radarzap', enabled: true });
    expect(
      attendanceSelectionFromSettings({
        mode: 'radarzap',
        enabled: true,
        attendanceMode: 'hybrid',
      }),
    ).toEqual({ attendanceMode: 'hybrid', credentialSource: 'radarzap' });
  });

  it('hybrid sem credencial não ativa LLM', () => {
    expect(
      legacySettingsFromAttendanceSelection({
        attendanceMode: 'hybrid',
        credentialSource: 'none',
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

  it('IA Básica é selecionável na UI (Fase 5)', () => {
    expect(isAttendanceModeSelectable('basic_triage')).toBe(true);
    expect(isAttendanceModeSelectable('robotic')).toBe(true);
    expect(isAttendanceModeSelectable('premium_assistant')).toBe(true);
    expect(isAttendanceModeSelectable('hybrid')).toBe(true);
  });

  it('resolveAttendanceMode prioriza campo persistido', () => {
    expect(
      resolveAttendanceMode({ mode: 'disabled', attendanceMode: 'robotic' }),
    ).toBe('robotic');
    expect(
      attendanceSelectionFromSettings({ mode: 'disabled', attendanceMode: 'robotic' }),
    ).toEqual({ attendanceMode: 'robotic', credentialSource: 'none' });
  });

  it('normalizeAttendanceMode cai em disabled para valor inválido', () => {
    expect(normalizeAttendanceMode('invalid')).toBe('disabled');
    expect(normalizeAttendanceMode(null)).toBe('disabled');
    expect(normalizeAttendanceMode('hybrid')).toBe('hybrid');
  });

  it('helpers de cadeia por modo', () => {
    expect(modeUsesRoboticMenu('robotic')).toBe(true);
    expect(modeUsesRoboticMenu('hybrid')).toBe(true);
    expect(modeUsesRoboticMenu('basic_triage')).toBe(false);
    expect(modeUsesBasicTriageChain('hybrid')).toBe(true);
    expect(modeUsesBasicTriageChain('robotic')).toBe(false);
    expect(modeUsesPremiumAiChain('hybrid')).toBe(true);
    expect(modeUsesPremiumAiChain('basic_triage')).toBe(false);
    expect(requiresAiCredits('disabled')).toBe(false);
    expect(requiresAiCredits('robotic')).toBe(false);
    expect(requiresAiCredits('hybrid')).toBe(true);
    expect(isAiAttendanceMode('robotic')).toBe(false);
    expect(isHumanOnlyMode({ mode: 'disabled', attendanceMode: 'disabled' })).toBe(true);
  });

  it('shouldRunGenerativeAi no premium ou híbrido com mode ativo', () => {
    expect(
      shouldRunGenerativeAi({ mode: 'radarzap', enabled: true, attendanceMode: 'premium_assistant' }),
    ).toBe(true);
    expect(
      shouldRunGenerativeAi({ mode: 'radarzap', enabled: true, attendanceMode: 'hybrid' }),
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
    expect(isValidAttendanceMode('hybrid')).toBe(true);
    expect(isValidAttendanceMode('invalid')).toBe(false);
  });

  it('getAttendanceModeLabel retorna rótulos oficiais', () => {
    expect(getAttendanceModeLabel('disabled')).toBe('Humano/manual');
    expect(getAttendanceModeLabel('hybrid')).toBe('Híbrido');
  });

  it('effectiveWebChatPremiumAi exige modo Premium/Híbrido + toggle widget', () => {
    const premium = { mode: 'radarzap' as const, enabled: true, attendanceMode: 'premium_assistant' as const };
    const hybrid = { mode: 'radarzap' as const, enabled: true, attendanceMode: 'hybrid' as const };
    expect(effectiveWebChatPremiumAi(true, premium)).toBe(true);
    expect(effectiveWebChatPremiumAi(true, hybrid)).toBe(true);
    expect(
      effectiveWebChatPremiumAi(true, { mode: 'disabled', enabled: false, attendanceMode: 'basic_triage' }),
    ).toBe(false);
    expect(webChatPremiumAiAllowed(premium)).toBe(true);
    expect(webChatPremiumAiAllowed(hybrid)).toBe(true);
    expect(webChatPremiumAiAllowed({ mode: 'disabled', attendanceMode: 'robotic' })).toBe(false);
  });
});
