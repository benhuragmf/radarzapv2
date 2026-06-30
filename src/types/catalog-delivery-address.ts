/** Validação de endereço completo para cálculo de entrega por distância. */

export const CATALOG_DELIVERY_ADDRESS_HINT =
  'Endereço completo: rua, número, bairro, CEP, cidade, estado e país.';

export const CATALOG_DELIVERY_ADDRESS_EXAMPLE =
  'Rua das Flores, 120, Centro, 01001-000, São Paulo, SP, Brasil';

const BR_UF =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;

export function deliveryAddressParts(address: string): string[] {
  return address
    .split(/[,;]/)
    .map(p => p.trim())
    .filter(Boolean);
}

/** Exige rua, número, bairro, CEP, cidade, estado e país (mín. 6 partes + CEP + UF + país). */
export function isCompleteDeliveryAddress(address: string | null | undefined): boolean {
  return deliveryAddressValidationError(address) === null;
}

export function deliveryAddressValidationError(
  address: string | null | undefined,
): string | null {
  const t = address?.trim() ?? '';
  if (!t) {
    return `Informe o endereço completo da empresa (${CATALOG_DELIVERY_ADDRESS_HINT})`;
  }
  if (t.length < 30) {
    return 'Endereço muito curto. Inclua rua, número, bairro, CEP, cidade, estado e país.';
  }
  const parts = deliveryAddressParts(t);
  if (parts.length < 6) {
    return `Separe o endereço com vírgulas: ${CATALOG_DELIVERY_ADDRESS_EXAMPLE}`;
  }
  if (!/\d{5}-?\d{3}/.test(t)) {
    return 'Inclua o CEP no formato 00000-000 ou 00000000.';
  }
  const hasStreetNumber =
    /,\s*\d+[A-Za-z]?(\s|,|-|$)/.test(t) || /\bn[º°.]?\s*\d+/i.test(t) || /\b\d{1,5}\b/.test(parts[1] ?? '');
  if (!hasStreetNumber) {
    return 'Inclua o número do imóvel (ex.: Rua Exemplo, 120, ...).';
  }
  if (!BR_UF.test(t)) {
    return 'Inclua a sigla do estado (UF), ex.: SP, RJ, MG.';
  }
  if (!/\b(brasil|brazil)\b/i.test(t)) {
    return 'Inclua o país no final (Brasil).';
  }
  return null;
}

/** Garante país na query de geocoding. */
export function normalizeAddressForGeocode(
  address: string,
  defaultCountry = 'Brasil',
): string {
  const t = address.trim();
  if (!t) return t;
  if (/\b(brasil|brazil)\b/i.test(t)) return t;
  return `${t}, ${defaultCountry}`;
}
