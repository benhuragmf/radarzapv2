import {
  parseContactCsv,
  normalizeContactPhoneE164,
  parseBirthday,
  detectCsvProfile,
  dedupeCanonicalRows,
} from '../contact-csv-import';

describe('contact-csv-import', () => {
  describe('normalizeContactPhoneE164', () => {
    it('normaliza BR com máscara', () => {
      expect(normalizeContactPhoneE164('(11) 97690-4921')).toBe('+5511976904921');
    });
    it('adiciona DDI 55 em 11 dígitos', () => {
      expect(normalizeContactPhoneE164('11976904921')).toBe('+5511976904921');
    });
    it('rejeita telefone vazio', () => {
      expect(normalizeContactPhoneE164('')).toBeNull();
    });
  });

  describe('parseBirthday', () => {
    it('aceita ISO', () => {
      expect(parseBirthday('1990-05-15')).toBe('1990-05-15');
    });
    it('aceita BR com ano', () => {
      expect(parseBirthday('15/05/1990')).toBe('1990-05-15');
    });
    it('aceita Google sem ano', () => {
      expect(parseBirthday('--05-15')).toBe('0000-05-15');
    });
    it('retorna undefined para inválido', () => {
      expect(parseBirthday('não é data')).toBeUndefined();
    });
  });

  describe('detectCsvProfile', () => {
    it('detecta radarzap', () => {
      expect(detectCsvProfile(['nome', 'telefone', 'email'])).toBe('radarzap');
    });
    it('detecta google', () => {
      expect(
        detectCsvProfile(['name', 'phone 1 - value', 'group membership']),
      ).toBe('google');
    });
    it('detecta apple', () => {
      expect(detectCsvProfile(['first name', 'last name', 'mobile phone'])).toBe('apple');
    });
  });

  describe('parseContactCsv', () => {
    const radarCsv = `nome,telefone,aniversario,grupos
Maria Silva,+5511988776655,1992-03-20,VIP; Clientes
João Santos,5511976904921,15/08/1990,
`;

    it('parse perfil radarzap com telefones E.164', () => {
      const r = parseContactCsv(radarCsv);
      expect(r.profile).toBe('radarzap');
      expect(r.rows).toHaveLength(2);
      expect(r.rows[0].telefone).toBe('+5511988776655');
      expect(r.rows[0].grupos).toEqual(['VIP', 'Clientes']);
      expect(r.rows[1].telefone).toBe('+5511976904921');
      expect(r.rows[1].aniversario).toBe('1990-08-15');
    });

    it('marca linha sem telefone como erro', () => {
      const csv = `nome,telefone
Sem Tel,
Com Tel,+5511999998888
`;
      const r = parseContactCsv(csv);
      expect(r.rows).toHaveLength(1);
      expect(r.erros.some((e) => e.motivo.includes('Telefone'))).toBe(true);
    });

    it('parse trecho Google', () => {
      const googleCsv = `Name,Given Name,Family Name,Birthday,Group Membership,Phone 1 - Type,Phone 1 - Value
,Maria,Silva,1992-03-20,VIP ::: * myContacts,Mobile,+55 11 98877-6655
`;
      const r = parseContactCsv(googleCsv);
      expect(r.profile).toBe('google');
      expect(r.rows[0].nome).toBe('Maria Silva');
      expect(r.rows[0].telefone).toBe('+5511988776655');
      expect(r.rows[0].grupos).toContain('VIP');
    });
  });

  describe('dedupeCanonicalRows', () => {
    it('remove duplicata no mesmo arquivo', () => {
      const { rows, ignorados } = dedupeCanonicalRows([
        { nome: 'A', telefone: '+5511999998888', lineNumber: 2 },
        { nome: 'B', telefone: '+5511999998888', lineNumber: 3 },
      ]);
      expect(rows).toHaveLength(1);
      expect(ignorados).toBe(1);
    });
  });
});
