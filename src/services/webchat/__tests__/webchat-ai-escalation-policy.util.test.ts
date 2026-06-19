import { normalizeEscalationPolicy } from '../webchat-ai-escalation-policy.util';

describe('webchat-ai-escalation-policy.util', () => {
  it('usa defaults quando vazio', () => {
    const p = normalizeEscalationPolicy(null);
    expect(p.humanRequest).toBe('triage_first');
    expect(p.escalateAfterRepeatedRequests).toBe(2);
  });

  it('aceita immediate por setor', () => {
    const p = normalizeEscalationPolicy({ commercialRequest: 'immediate' });
    expect(p.commercialRequest).toBe('immediate');
    expect(p.humanRequest).toBe('triage_first');
  });

  it('limita repetidos entre 0 e 5', () => {
    expect(normalizeEscalationPolicy({ escalateAfterRepeatedRequests: 9 }).escalateAfterRepeatedRequests).toBe(5);
    expect(normalizeEscalationPolicy({ escalateAfterRepeatedRequests: -1 }).escalateAfterRepeatedRequests).toBe(0);
  });
});
