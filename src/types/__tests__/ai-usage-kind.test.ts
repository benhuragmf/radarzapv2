import {
  aiUsageKindFromProviderLabel,
  aiUsageKindLabel,
  inferAiUsageKind,
} from '../ai-usage-kind';

describe('ai-usage-kind', () => {
  it('infere basic_triage do provider legado', () => {
    expect(inferAiUsageKind('radarzap-basic-triage')).toBe('basic_triage');
    expect(inferAiUsageKind('radarzap')).toBe('premium_assistant');
  });

  it('prioriza usageKind persistido', () => {
    expect(inferAiUsageKind('radarzap', 'basic_triage')).toBe('basic_triage');
  });

  it('mapeia providerLabel para kind', () => {
    expect(aiUsageKindFromProviderLabel('radarzap-basic-triage')).toBe('basic_triage');
    expect(aiUsageKindFromProviderLabel('radarzap')).toBe('premium_assistant');
  });

  it('rótulos legíveis', () => {
    expect(aiUsageKindLabel('premium_assistant')).toMatch(/Premium/);
    expect(aiUsageKindLabel('basic_triage')).toMatch(/Básica/);
  });
});
