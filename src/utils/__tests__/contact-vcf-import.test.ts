import { readFileSync } from 'fs';
import path from 'path';
import {
  decodeQuotedPrintable,
  detectContactImportFormat,
  parseContactVcf,
  unfoldVcfLines,
} from '../contact-vcf-import';

const samplePath = path.join(
  process.cwd(),
  'docs/samples/Contatos-exemplo.vcf',
);

describe('contact-vcf-import', () => {
  describe('detectContactImportFormat', () => {
    it('detecta VCF', () => {
      expect(detectContactImportFormat('BEGIN:VCARD\nVERSION:3.0\nEND:VCARD')).toBe('vcf');
    });
    it('detecta CSV', () => {
      expect(detectContactImportFormat('nome,telefone\nMaria,+5511999999999')).toBe('csv');
    });
  });

  describe('decodeQuotedPrintable', () => {
    it('decodifica acentos UTF-8', () => {
      const encoded = '=49=6E=64=C3=BA=73=74=72=69=61';
      expect(decodeQuotedPrintable(encoded)).toBe('Indústria');
    });
  });

  describe('parseContactVcf', () => {
    const snippet = `BEGIN:VCARD
VERSION:2.1
N;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:;=49=6E=64=C3=BA=73=74=72=69=61=20=45=6E=74=72=65=67=61=73=20=46=65=72=
=72=61=63=6F;;;
FN;CHARSET=UTF-8;ENCODING=QUOTED-PRINTABLE:=49=6E=64=C3=BA=73=74=72=69=61=20=45=6E=74=72=65=67=61=73=20=46=65=72=
=72=61=63=6F
TEL;CELL:+5566999918348
END:VCARD
BEGIN:VCARD
VERSION:2.1
N:Sk2;Esse;;;
FN:Esse Sk2
TEL;CELL;PREF:+5531989722457
TEL;CELL:+5531989722457
END:VCARD
BEGIN:VCARD
VERSION:2.1
N:;Kekao;;;
FN:Kekao
TEL;CELL;PREF:+554797500350
END:VCARD`;

    it('parse vCards com FN, TEL e quoted-printable', () => {
      const r = parseContactVcf(snippet);
      expect(r.profile).toBe('vcf');
      expect(r.vcardVersion).toBe('2.1');
      expect(r.rows.length).toBeGreaterThanOrEqual(2);
      const industria = r.rows.find((row) => row.nome.includes('Indústria'));
      expect(industria?.telefone).toBe('+5566999918348');
      const esse = r.rows.find((row) => row.nome === 'Esse Sk2');
      expect(esse?.telefone).toBe('+5531989722457');
    });

    it('dedupe telefones repetidos na mesma vCard', () => {
      const r = parseContactVcf(snippet);
      const esse = r.rows.filter((row) => row.telefone === '+5531989722457');
      expect(esse).toHaveLength(1);
    });

    it('marca contato sem telefone válido', () => {
      const vcf = `BEGIN:VCARD
VERSION:2.1
FN:Sem Tel
END:VCARD`;
      const r = parseContactVcf(vcf);
      expect(r.rows).toHaveLength(0);
      expect(r.erros.some((e) => e.motivo.includes('Telefone'))).toBe(true);
    });

    it('mapeia ORG para empresa (não em notas)', () => {
      const vcf = `BEGIN:VCARD
VERSION:2.1
FN:Indústria Entregas
TEL;CELL:+5566999918348
ORG:Administrativo - Indústria
END:VCARD`;
      const r = parseContactVcf(vcf);
      expect(r.rows[0]?.empresa).toBe('Administrativo - Indústria');
      expect(r.rows[0]?.notas).toBeUndefined();
    });

    it('marca tipo WhatsApp e telefone secundário distinto', () => {
      const vcf = `BEGIN:VCARD
VERSION:2.1
FN:Joao Paulo
TEL;HOME;PREF:+5566999863826
TEL;X-WhatsApp:+5566999863826
END:VCARD`;
      const r = parseContactVcf(vcf);
      expect(r.rows[0]?.tipoTelefone).toBe('whatsapp');
    });

    it('guarda segundo TEL quando número difere do principal', () => {
      const vcf = `BEGIN:VCARD
VERSION:2.1
FN:Karoline Bruno
TEL;CELL;PREF:+5566999102479
TEL;HOME:+5531989722457
END:VCARD`;
      const r = parseContactVcf(vcf);
      expect(r.rows[0]?.telefone).toBeTruthy();
      expect(r.rows[0]?.telefoneSecundario).toBeTruthy();
      expect(r.rows[0]?.telefoneSecundario).not.toBe(r.rows[0]?.telefone);
    });

    it('parse BDAY e EMAIL quando presentes', () => {
      const vcf = `BEGIN:VCARD
VERSION:4.0
FN:Maria Silva
TEL;TYPE=cell:+5511988776655
EMAIL;TYPE=home:maria@exemplo.com
BDAY:19920320
CATEGORIES:VIP,Clientes
NOTE:Cliente desde 2024
END:VCARD`;
      const r = parseContactVcf(vcf);
      expect(r.rows).toHaveLength(1);
      expect(r.rows[0]).toMatchObject({
        nome: 'Maria Silva',
        telefone: '+5511988776655',
        aniversario: '1992-03-20',
        email: 'maria@exemplo.com',
        grupos: ['VIP', 'Clientes'],
        notas: 'Cliente desde 2024',
      });
    });
  });

  describe('docs/samples/Contatos-exemplo.vcf', () => {
    it('importa amostra do repositório (20 contatos)', () => {
      const text = readFileSync(samplePath, 'utf8');
      const lines = unfoldVcfLines(text);
      const cards = lines.filter((l) => l.toUpperCase() === 'BEGIN:VCARD').length;
      expect(cards).toBe(20);

      const r = parseContactVcf(text);
      expect(r.totalLinhasDados).toBe(20);
      expect(r.rows.length).toBeGreaterThan(15);
      expect(r.rows.every((row) => row.telefone.startsWith('+'))).toBe(true);
    });
  });
});
