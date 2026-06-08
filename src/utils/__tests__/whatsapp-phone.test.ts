jest.mock('@whiskeysockets/baileys', () => ({
  jidDecode: (jid: string) => ({ user: jid.split('@')[0] }),
}));

import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  identifierCandidatesFromJids,
  isLikelyPhoneIdentifier,
  resolvePhoneFromJids,
  wuidToPhone,
} from '@/utils/whatsapp-phone';

describe('whatsapp-phone', () => {
  describe('wuidToPhone', () => {
    it('formats BR phone JID', () => {
      expect(wuidToPhone('5511976904921@s.whatsapp.net')).toBe('+5511976904921');
    });

    it('ignores @lid (not a phone)', () => {
      expect(wuidToPhone('39488566902931@lid')).toBeUndefined();
    });

    it('ignores LID-like digit strings', () => {
      expect(isLikelyPhoneIdentifier('+39488566902931')).toBe(false);
    });
  });

  describe('identifierCandidatesFromJids', () => {
    it('uses phone JID and ignores LID digits', () => {
      expect(
        identifierCandidatesFromJids('39488566902931@lid', '5511976904921@s.whatsapp.net'),
      ).toEqual(expect.arrayContaining(['+5511976904921', '5511976904921']));
      expect(identifierCandidatesFromJids('39488566902931@lid')).toEqual([]);
    });
  });

  describe('resolvePhoneFromJids', () => {
    it('reads lid-mapping reverse file from session dir', () => {
      const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-session-'));
      const clientId = 'test-client';
      const sessionDir = path.join(tmp, 'sessions', clientId);
      fs.mkdirSync(sessionDir, { recursive: true });
      fs.writeFileSync(
        path.join(sessionDir, 'lid-mapping-39488566902931_reverse.json'),
        JSON.stringify('5511976904921'),
      );

      const cwd = process.cwd();
      process.chdir(tmp);
      try {
        const phone = resolvePhoneFromJids(clientId, '39488566902931@lid');
        expect(phone).toBe('+5511976904921');
      } finally {
        process.chdir(cwd);
        fs.rmSync(tmp, { recursive: true, force: true });
      }
    });
  });
});
