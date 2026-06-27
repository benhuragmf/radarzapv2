import type { DestinationClassificationStats } from '@/types/contact-classification';

const UTF8_BOM = '\uFEFF';

function escapeCsvField(value: string): string {
  if (/[",\r\n]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function row(fields: string[]): string {
  return fields.map(escapeCsvField).join(',');
}

export function buildClassificationStatsCsv(stats: DestinationClassificationStats): string {
  const lines: string[] = [row(['secao', 'chave', 'valor'])];
  lines.push(row(['resumo', 'total_contatos', String(stats.totalContacts)]));
  lines.push(row(['resumo', 'elegiveis_campanha', String(stats.campaignSelectable)]));
  lines.push(row(['resumo', 'bloqueados_campanha', String(stats.campaignBlocked)]));
  lines.push(row(['resumo', 'backfill_pendente', String(stats.backfillPending)]));

  for (const seg of stats.smartSegments) {
    lines.push(row(['segmento', seg.id, String(seg.count)]));
  }

  const pushMap = (secao: string, map: Record<string, number>) => {
    for (const [key, count] of Object.entries(map).sort((a, b) => b[1] - a[1])) {
      if (count > 0) lines.push(row([secao, key, String(count)]));
    }
  };

  pushMap('tipo', stats.byKind);
  pushMap('permissao', stats.byPermission);
  pushMap('origem', stats.byOrigin);
  pushMap('temperatura', stats.byTemperature);
  pushMap('funil', stats.byCommercialStatus);
  pushMap('qualidade_telefone', stats.byPhoneQuality);

  return UTF8_BOM + lines.join('\n');
}

export type ClassificationContactCsvRow = {
  nome: string;
  telefone: string;
  email?: string;
  empresa?: string;
  classification: {
    kind: string;
    origin: string;
    permission: string;
    commercialStatus: string;
    temperature: string;
    phoneQuality: string;
    campaignSelectable: boolean;
    sendBlockReason?: string;
  };
};

export function buildContactsClassificationCsv(rows: ClassificationContactCsvRow[]): string {
  const header = [
    'nome',
    'telefone',
    'email',
    'empresa',
    'tipo',
    'origem',
    'permissao_lgpd',
    'funil',
    'temperatura',
    'qualidade_telefone',
    'elegivel_campanha',
    'motivo_bloqueio_campanha',
  ];
  const lines = [row(header)];
  for (const r of rows) {
    const c = r.classification;
    lines.push(
      row([
        r.nome,
        r.telefone,
        r.email ?? '',
        r.empresa ?? '',
        c.kind,
        c.origin,
        c.permission,
        c.commercialStatus,
        c.temperature,
        c.phoneQuality,
        c.campaignSelectable ? 'sim' : 'nao',
        c.sendBlockReason ?? '',
      ]),
    );
  }
  return UTF8_BOM + lines.join('\n');
}
