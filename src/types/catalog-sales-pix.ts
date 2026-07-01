export interface CatalogSalesPixFields {
  pixKey?: string;
  pixHolderName?: string;
  pixInstructions?: string;
}

/** Monta texto de PIX para IA e mensagens ao cliente. */
export function buildCatalogPixInstructions(parts: CatalogSalesPixFields): string {
  const lines: string[] = [];
  const key = parts.pixKey?.trim();
  const holder = parts.pixHolderName?.trim();
  if (key) lines.push(`Chave PIX: ${key}`);
  if (holder) lines.push(`Titular: ${holder}`);
  const extra = parts.pixInstructions?.trim() ?? '';
  if (extra) {
    const withoutDup = extra
      .split('\n')
      .filter(line => {
        const t = line.trim();
        if (!t) return false;
        if (key && /^chave\s*pix\s*:/i.test(t)) return false;
        if (holder && /^titular\s*:/i.test(t)) return false;
        return true;
      })
      .join('\n')
      .trim();
    if (withoutDup) lines.push(withoutDup);
  }
  return lines.join('\n').trim();
}

/** Lê chave/titular de pixInstructions legado quando campos dedicados estão vazios. */
export function enrichCatalogSalesPixFields(
  raw?: CatalogSalesPixFields | null,
): CatalogSalesPixFields {
  const cfg: CatalogSalesPixFields = { ...(raw ?? {}) };
  const instructions = cfg.pixInstructions?.trim() ?? '';
  if (!cfg.pixKey?.trim() && instructions) {
    for (const line of instructions.split('\n')) {
      const m = line.match(/^\s*chave\s*pix\s*:\s*(.+)\s*$/i);
      if (m?.[1]) cfg.pixKey = m[1].trim();
    }
  }
  if (!cfg.pixHolderName?.trim() && instructions) {
    for (const line of instructions.split('\n')) {
      const m = line.match(/^\s*titular\s*:\s*(.+)\s*$/i);
      if (m?.[1]) cfg.pixHolderName = m[1].trim();
    }
  }
  return cfg;
}

export function resolveCatalogPixInstructions(raw?: CatalogSalesPixFields | null): string {
  const enriched = enrichCatalogSalesPixFields(raw);
  return buildCatalogPixInstructions(enriched);
}
