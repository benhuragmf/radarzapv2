import {
  parseDestinationClassFilter,
  classFilterToDestinationQuery,
  matchesDestinationClassFilter,
} from '../destination-classification.service';
import { buildClassificationStatsCsv } from '@/utils/classification-csv-export';
import type { DestinationClassificationStats } from '@/types/contact-classification';

describe('destination-classification filters', () => {
  it('parseDestinationClassFilter aceita aliases conhecidos', () => {
    expect(parseDestinationClassFilter('opt_in')).toBe('opt_in');
    expect(parseDestinationClassFilter('lead')).toBe('lead');
    expect(parseDestinationClassFilter('invalid')).toBeUndefined();
  });

  it('classFilterToDestinationQuery mapeia opt-in e quentes', () => {
    expect(classFilterToDestinationQuery('opt_in')).toEqual({ permission: 'opt_in_accepted' });
    expect(classFilterToDestinationQuery('hot')).toEqual({ temperatures: ['hot', 'warm'] });
    expect(classFilterToDestinationQuery('blocked')).toEqual({ campaignBlockedOnly: true });
    expect(classFilterToDestinationQuery('client')).toEqual({ kinds: ['client'] });
  });

  it('matchesDestinationClassFilter bloqueia campanha', () => {
    expect(
      matchesDestinationClassFilter(
        {
          kind: 'lead',
          origin: 'form',
          permission: 'opt_in_accepted',
          commercialStatus: 'new',
          temperature: 'cold',
          phoneQuality: 'verified',
          campaignSelectable: false,
          sendBlockReason: 'Opt-out',
        },
        'blocked',
      ),
    ).toBe(true);
  });

  it('buildClassificationStatsCsv gera cabeçalho e linhas', () => {
    const stats: DestinationClassificationStats = {
      totalContacts: 2,
      campaignSelectable: 1,
      campaignBlocked: 1,
      backfillPending: 0,
      smartSegments: [{ id: 'opt_in_leads', label: 'Leads opt-in', description: 'x', count: 1 }],
      byKind: { lead: 2 },
      byPermission: { opt_in_accepted: 1, pending: 1 },
      byOrigin: { form: 2 },
      byTemperature: { cold: 2 },
      byCommercialStatus: { new: 2 },
      byPhoneQuality: { verified: 2 },
    };
    const csv = buildClassificationStatsCsv(stats);
    expect(csv).toContain('secao,chave,valor');
    expect(csv).toContain('total_contatos,2');
    expect(csv).toContain('tipo,lead,2');
  });
});
