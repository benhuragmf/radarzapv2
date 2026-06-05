jest.mock('@whiskeysockets/baileys', () => ({
  jidDecode: (jid: string) => ({ user: jid.split('@')[0] }),
}));

import {
  isPhoneInParticipants,
  isWaIdentityInParticipants,
  phoneMatchesParticipant,
} from '@/utils/group-membership';

describe('group-membership', () => {
  describe('phoneMatchesParticipant', () => {
    it('matches E.164 with participant JID', () => {
      expect(phoneMatchesParticipant('+5566996819456', '5566996819456@s.whatsapp.net')).toBe(true);
    });

    it('matches BR variant with/without 9th digit', () => {
      expect(phoneMatchesParticipant('+5566996819456', '556696819456@s.whatsapp.net')).toBe(true);
    });

    it('returns false when not a participant', () => {
      expect(phoneMatchesParticipant('+558184384907', '5566996819456@s.whatsapp.net')).toBe(false);
    });
  });

  describe('isPhoneInParticipants', () => {
    it('finds phone in participant list', () => {
      const ok = isPhoneInParticipants('+5566996819456', [
        { id: '558184384907@s.whatsapp.net' },
        { id: '5566996819456@s.whatsapp.net' },
      ]);
      expect(ok).toBe(true);
    });

    it('returns false when absent', () => {
      const ok = isPhoneInParticipants('+5566996819456', [
        { id: '558184384907@s.whatsapp.net' },
      ]);
      expect(ok).toBe(false);
    });

    it('matches via phoneNumber when participant id is @lid', () => {
      const ok = isPhoneInParticipants('+5511976904921', [
        {
          id: '39488566902931@lid',
          phoneNumber: '5511976904921@s.whatsapp.net',
          lid: '39488566902931@lid',
        },
      ]);
      expect(ok).toBe(true);
    });
  });

  describe('isWaIdentityInParticipants', () => {
    it('matches session by LID when phone is only on phoneNumber field', () => {
      const ok = isWaIdentityInParticipants(
        { phone: '+5511976904921', lid: '39488566902931@lid' },
        [{ id: '39488566902931@lid', lid: '39488566902931@lid' }],
      );
      expect(ok).toBe(true);
    });
  });
});
