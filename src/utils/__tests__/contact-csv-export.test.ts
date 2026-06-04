import {
  buildContactCsvExport,
  consentStatusForExport,
  parseExportProfile,
} from '../contact-csv-export';
import { ConsentStatus } from '@/types/consent';

describe('contact-csv-export', () => {
  it('parseExportProfile aceita perfis válidos', () => {
    expect(parseExportProfile('google-compatible')).toBe('google-compatible');
  });

  it('rejeita perfil inválido', () => {
    expect(() => parseExportProfile('invalid')).toThrow(/inválido/);
  });

  it('consentStatusForExport mapeia estados', () => {
    expect(consentStatusForExport(ConsentStatus.ACCEPTED)).toBe('granted');
    expect(consentStatusForExport(ConsentStatus.PENDING)).toBe('pending');
    expect(consentStatusForExport(ConsentStatus.REFUSED_THREE)).toBe('revoked');
  });

  it('export nativo inclui BOM e cabeçalho', () => {
    const csv = buildContactCsvExport('radarzap-native', [
      {
        nome: 'Maria',
        telefone: '+5511988776655',
        aniversario: '1992-03-20',
        grupos: ['VIP'],
        consentStatus: ConsentStatus.ACCEPTED,
      },
    ]);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('nome,telefone');
    expect(csv).toContain('empresa');
    expect(csv).toContain('telefone_secundario');
    expect(csv).toContain('tipo_telefone');
    expect(csv).toContain('Maria');
    expect(csv).toContain('granted');
  });

  it('export google inclui colunas esperadas', () => {
    const csv = buildContactCsvExport('google-compatible', [
      { nome: 'João Silva', telefone: '+5511976904921' },
    ]);
    expect(csv).toContain('Phone 1 - Value');
    expect(csv).toContain('João Silva');
  });
});
