import {
  getTriageConfidenceTier,
  isHighConfidenceTriage,
  isLowConfidenceTriage,
  isMediumConfidenceTriage,
  mapBasicIntentToProduct,
  resolveBasicTriageAction,
  resolveBasicTriageFallback,
  shouldSkipBasicTriageForBridge,
  TRIAGE_CONFIDENCE_HIGH,
  TRIAGE_CONFIDENCE_LOW,
} from '@/types/basic-triage.util';
import type { BasicTriageClassification } from '@/utils/basic-triage-classifier';

describe('basic-triage.util', () => {
  it('mapeia intenções internas para produto', () => {
    expect(mapBasicIntentToProduct('commercial')).toBe('sales');
    expect(mapBasicIntentToProduct('finance')).toBe('billing');
    expect(mapBasicIntentToProduct('support')).toBe('support');
    expect(mapBasicIntentToProduct('ticket_status')).toBe('ticket_status');
    expect(mapBasicIntentToProduct('greeting')).toBe('unknown');
  });

  it('tiers de confiança TOP 14', () => {
    expect(isHighConfidenceTriage(0.8)).toBe(true);
    expect(isMediumConfidenceTriage(0.6)).toBe(true);
    expect(isLowConfidenceTriage(0.3)).toBe(true);
    expect(getTriageConfidenceTier(TRIAGE_CONFIDENCE_HIGH)).toBe('high');
    expect(getTriageConfidenceTier(TRIAGE_CONFIDENCE_LOW)).toBe('medium');
    expect(getTriageConfidenceTier(0.2)).toBe('low');
  });

  it('resolveBasicTriageAction — alta confiança roteia', () => {
    const c: BasicTriageClassification = {
      intent: 'commercial',
      confidence: 0.8,
      suggestedMenuKey: '1',
    };
    expect(resolveBasicTriageAction(c)).toBe('route');
  });

  it('resolveBasicTriageAction — média confiança esclarece', () => {
    const c: BasicTriageClassification = {
      intent: 'support',
      confidence: 0.6,
      suggestedMenuKey: '3',
    };
    expect(resolveBasicTriageAction(c)).toBe('clarify');
  });

  it('resolveBasicTriageAction — humano vai para fila', () => {
    const c: BasicTriageClassification = {
      intent: 'human_request',
      confidence: 0.88,
      suggestedMenuKey: '4',
    };
    expect(resolveBasicTriageAction(c)).toBe('queue');
  });

  it('resolveBasicTriageAction — ticket_status esclarece', () => {
    const c: BasicTriageClassification = {
      intent: 'ticket_status',
      confidence: 0.82,
      suggestedMenuKey: '3',
    };
    expect(resolveBasicTriageAction(c)).toBe('clarify');
  });

  it('resolveBasicTriageAction — unknown baixa vai para fila', () => {
    const c: BasicTriageClassification = { intent: 'unknown', confidence: 0.2 };
    expect(resolveBasicTriageAction(c)).toBe('queue');
  });

  it('shouldSkipBasicTriageForBridge', () => {
    expect(shouldSkipBasicTriageForBridge({ whatsappBridgeActive: true })).toBe(true);
    expect(shouldSkipBasicTriageForBridge({})).toBe(false);
  });

  it('resolveBasicTriageFallback', () => {
    expect(resolveBasicTriageFallback('route')).toBe('department_route');
    expect(resolveBasicTriageFallback('queue')).toBe('human_queue');
  });
});
