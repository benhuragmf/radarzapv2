import {
  aiUsageKindFromProviderLabel,
  aiUsageKindLabel,
  inferAiUsageKind,
} from '../ai-usage-kind';

describe('ai-usage-kind', () => {
  it('infere basic_triage do provider legado', () => {
    expect(inferAiUsageKind('radarchat-basic-triage')).toBe('basic_triage');
    expect(inferAiUsageKind('radarchat')).toBe('premium_assistant');
  });

  it('prioriza usageKind persistido', () => {
    expect(inferAiUsageKind('radarchat', 'basic_triage')).toBe('basic_triage');
  });

  it('mapeia providerLabel para kind', () => {
    expect(aiUsageKindFromProviderLabel('radarchat-basic-triage')).toBe('basic_triage');
    expect(aiUsageKindFromProviderLabel('radarchat')).toBe('premium_assistant');
  });

  it('rótulos legíveis', () => {
    expect(aiUsageKindLabel('premium_assistant')).toMatch(/Premium/);
    expect(aiUsageKindLabel('basic_triage')).toMatch(/Básica/);
  });
});
