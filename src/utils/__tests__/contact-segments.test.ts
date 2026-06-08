import { isLeadInboxDepartment } from '@/constants/contact-segments';

describe('contact-segments', () => {
  describe('isLeadInboxDepartment', () => {
    it('detects Comercial', () => {
      expect(isLeadInboxDepartment('Comercial')).toBe(true);
    });

    it('detects Vendas', () => {
      expect(isLeadInboxDepartment('Equipe de Vendas')).toBe(true);
    });

    it('ignores Suporte', () => {
      expect(isLeadInboxDepartment('Suporte')).toBe(false);
    });

    it('ignores Financeiro', () => {
      expect(isLeadInboxDepartment('Financeiro')).toBe(false);
    });
  });
});
