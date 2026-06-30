import { isBusinessVerticalId, BUSINESS_VERTICAL_IDS } from '@/types/business-vertical';
import { getBusinessVerticalPreset, listBusinessVerticalPresetsPublic } from '@/constants/business-vertical-presets';

describe('business-vertical presets', () => {
  it('expõe 11 verticais (10 + outro)', () => {
    expect(BUSINESS_VERTICAL_IDS).toHaveLength(11);
    expect(listBusinessVerticalPresetsPublic()).toHaveLength(11);
  });

  it('valida ids conhecidos', () => {
    expect(isBusinessVerticalId('clinica')).toBe(true);
    expect(isBusinessVerticalId('invalid')).toBe(false);
  });

  it('cada preset tem 4 setores', () => {
    for (const id of BUSINESS_VERTICAL_IDS) {
      const preset = getBusinessVerticalPreset(id);
      expect(preset?.departments).toHaveLength(4);
    }
  });

  it('merge inclui pacote IA completo para clínica', () => {
    const preset = getBusinessVerticalPreset('clinica');
    expect(preset?.aiSettings?.suggestedAttendanceMode).toBe('basic_triage');
    expect(preset?.aiSkills?.length).toBeGreaterThan(0);
    expect(preset?.aiMemories?.length).toBeGreaterThan(0);
    expect(preset?.aiPrompt?.agentName).toBeTruthy();
    expect(preset?.aiPrompt?.autoResolveEnabled).toBe(true);
  });
});
