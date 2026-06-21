import {
  appendCappedDestinationNotes,
  DESTINATION_NOTES_MAX_LENGTH,
  webChatNoteContentKey,
} from '../webchat-destination-link.util';

describe('webchat-destination-link.util', () => {
  it('webChatNoteContentKey remove carimbo de data', () => {
    expect(webChatNoteContentKey('[WebChat 2026-06-19 01:54] Motivo: teste')).toBe('Motivo: teste');
  });

  it('appendCappedDestinationNotes mantém texto dentro do limite', () => {
    const line = '[WebChat 2026-06-19 01:54] Motivo: x';
    const prev = 'a'.repeat(DESTINATION_NOTES_MAX_LENGTH - 10);
    const next = appendCappedDestinationNotes(prev, line);
    expect(next.length).toBeLessThanOrEqual(DESTINATION_NOTES_MAX_LENGTH);
    expect(next.endsWith(line)).toBe(true);
  });

  it('appendCappedDestinationNotes descarta linhas antigas quando estoura', () => {
    const old = 'linha antiga '.repeat(120);
    const line = '[WebChat 2026-06-19 02:00] Motivo: novo';
    const next = appendCappedDestinationNotes(old, line);
    expect(next.length).toBeLessThanOrEqual(DESTINATION_NOTES_MAX_LENGTH);
    expect(next).toContain('Motivo: novo');
  });
});
