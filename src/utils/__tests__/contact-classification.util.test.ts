import { buildContactClassification, findDuplicateDestinationIds } from '@/utils/contact-classification.util';

describe('contact-classification', () => {
  it('marca opt-in aceito para consentimento ACCEPTED', () => {
    const c = buildContactClassification({
      _id: '1',
      type: 'contact',
      identifier: '+5511999999999',
      name: 'Teste',
      consentStatus: 'ACCEPTED',
    });
    expect(c.permission).toBe('opt_in_accepted');
    expect(c.campaignSelectable).toBe(true);
  });

  it('bloqueia opt-out após recusa', () => {
    const c = buildContactClassification({
      _id: '2',
      type: 'contact',
      identifier: '+5511888888888',
      name: 'Recusou',
      consentStatus: 'REFUSED_FIRST',
    });
    expect(c.permission).toBe('opt_out');
    expect(c.campaignSelectable).toBe(false);
    expect(c.sendBlockReason).toMatch(/Opt-out/i);
  });

  it('infere lead quando há hint de captura', () => {
    const c = buildContactClassification(
      {
        _id: '3',
        type: 'contact',
        identifier: '+5511777777777',
        name: 'Lead Site',
        consentStatus: 'ACCEPTED',
      },
      { lead: { status: 'new', origin: 'site', temperature: 'hot' } },
    );
    expect(c.kind).toBe('lead');
    expect(c.origin).toBe('form');
    expect(c.temperature).toBe('hot');
  });

  it('detecta duplicados pelo identificador', () => {
    const dupes = findDuplicateDestinationIds([
      { _id: 'a', type: 'contact', identifier: '+5511999999999' },
      { _id: 'b', type: 'contact', identifier: '+55 11 99999-9999' },
      { _id: 'c', type: 'contact', identifier: '+5511888888888' },
    ]);
    expect(dupes.has('a')).toBe(true);
    expect(dupes.has('b')).toBe(true);
    expect(dupes.has('c')).toBe(false);
  });
});
