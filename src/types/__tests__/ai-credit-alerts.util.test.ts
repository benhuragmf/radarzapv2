import {
  buildAiCreditAlertMessage,
  resolveAiCreditUsageLevel,
  shouldEmitAiCreditAlert,
} from '@/types/ai-credit-alerts.util';

describe('ai-credit-alerts.util', () => {
  describe('resolveAiCreditUsageLevel', () => {
    it('ok abaixo de 80%', () => {
      const r = resolveAiCreditUsageLevel({
        usedThisMonth: 300,
        totalAllowance: 400,
        depleted: false,
      });
      expect(r.level).toBe('ok');
      expect(r.depleted).toBe(false);
    });

    it('warning_80 entre 80% e 90%', () => {
      const r = resolveAiCreditUsageLevel({
        usedThisMonth: 330,
        totalAllowance: 400,
        depleted: false,
      });
      expect(r.level).toBe('warning_80');
    });

    it('warning_90 entre 90% e 100%', () => {
      const r = resolveAiCreditUsageLevel({
        usedThisMonth: 370,
        totalAllowance: 400,
        depleted: false,
      });
      expect(r.level).toBe('warning_90');
    });

    it('exhausted em 100% ou depleted', () => {
      expect(
        resolveAiCreditUsageLevel({
          usedThisMonth: 400,
          totalAllowance: 400,
          depleted: false,
        }).level,
      ).toBe('exhausted');
      expect(
        resolveAiCreditUsageLevel({
          usedThisMonth: 50,
          totalAllowance: 400,
          depleted: true,
        }).level,
      ).toBe('exhausted');
    });
  });

  describe('shouldEmitAiCreditAlert', () => {
    it('não emite em ok', () => {
      expect(shouldEmitAiCreditAlert('warning_80', 'ok')).toBe(false);
    });

    it('emite na primeira subida de nível', () => {
      expect(shouldEmitAiCreditAlert(null, 'warning_80')).toBe(true);
      expect(shouldEmitAiCreditAlert('ok', 'warning_90')).toBe(true);
      expect(shouldEmitAiCreditAlert('warning_80', 'warning_90')).toBe(true);
      expect(shouldEmitAiCreditAlert('warning_90', 'exhausted')).toBe(true);
    });

    it('não repete mesmo nível', () => {
      expect(shouldEmitAiCreditAlert('warning_90', 'warning_90')).toBe(false);
    });
  });

  describe('buildAiCreditAlertMessage', () => {
    it('mensagens por nível', () => {
      const snap = { used: 90, allowance: 100, ratio: 0.9, level: 'warning_90' as const, depleted: false };
      expect(buildAiCreditAlertMessage('warning_90', snap).title).toMatch(/crítico/);
      expect(buildAiCreditAlertMessage('exhausted', snap).body).toMatch(/encaminhado/);
      expect(buildAiCreditAlertMessage('warning_80', snap).title).toMatch(/baixo/);
    });
  });
});
