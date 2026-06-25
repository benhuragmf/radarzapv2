import {
  mapLeadStatusToProductStage,
  normalizeLeadStage,
  PRODUCT_STAGE_TO_LEAD_STATUS,
} from '@/types/lead-stage.util';

describe('lead-stage.util', () => {
  it('mapeia status persistidos para etapas de produto', () => {
    expect(mapLeadStatusToProductStage('new')).toBe('new');
    expect(mapLeadStatusToProductStage('in_review')).toBe('contact_attempt');
    expect(mapLeadStatusToProductStage('in_progress')).toBe('in_service');
    expect(mapLeadStatusToProductStage('converted')).toBe('won');
  });

  it('normaliza etapa de produto para status persistido', () => {
    expect(normalizeLeadStage('contact_attempt')).toBe('in_review');
    expect(normalizeLeadStage('proposal_sent')).toBe('qualified');
    expect(normalizeLeadStage('unknown')).toBe('new');
  });

  it('cobre todas as etapas oficiais do funil', () => {
    expect(PRODUCT_STAGE_TO_LEAD_STATUS.won).toBe('converted');
    expect(PRODUCT_STAGE_TO_LEAD_STATUS.no_response).toBe('lost');
  });
});
