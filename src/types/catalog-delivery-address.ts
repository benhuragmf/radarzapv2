/** Validação de endereço completo para cálculo de entrega por distância. */

import { formatCepDisplay, isValidCepDigits, normalizeCepDigits } from './br-cep-format';

export const CATALOG_DELIVERY_ADDRESS_HINT =
  'Informe o CEP primeiro; depois rua, número, bairro, cidade, estado e país.';

export const CATALOG_DELIVERY_ADDRESS_EXAMPLE =
  '01001-000, Praça da Sé, 100, Sé, São Paulo, SP, Brasil';

export interface DeliveryAddressStructured {
  cep: string;
  street: string;
  number: string;
  neighborhood: string;
  city: string;
  state: string;
  country?: string;
  complement?: string;
}

const BR_UF =
  /\b(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)\b/i;

export function deliveryAddressParts(address: string): string[] {
  return address
    .split(/[,;]/)
    .map(p => p.trim())
    .filter(Boolean);
}

function partLooksLikeCep(part: string): boolean {
  return isValidCepDigits(part);
}

/** Formato canônico: CEP, rua, número, bairro, cidade, UF, país */
export function formatDeliveryAddress(parts: DeliveryAddressStructured): string {
  const cep = formatCepDisplay(parts.cep);
  const country = parts.country?.trim() || 'Brasil';
  const streetLine = [parts.street.trim(), parts.complement?.trim()].filter(Boolean).join(' — ');
  return [
    cep,
    streetLine,
    parts.number.trim(),
    parts.neighborhood.trim(),
    parts.city.trim(),
    parts.state.trim().toUpperCase(),
    country,
  ]
    .filter(Boolean)
    .join(', ');
}

/** Interpreta endereço salvo (CEP primeiro ou legado). */
export function parseDeliveryAddress(raw: string | null | undefined): DeliveryAddressStructured | null {
  const parts = deliveryAddressParts(raw ?? '');
  if (parts.length < 6) return null;

  if (partLooksLikeCep(parts[0] ?? '')) {
    return {
      cep: normalizeCepDigits(parts[0] ?? ''),
      street: parts[1] ?? '',
      number: parts[2] ?? '',
      neighborhood: parts[3] ?? '',
      city: parts[4] ?? '',
      state: parts[5] ?? '',
      country: parts[6] ?? 'Brasil',
    };
  }

  const cepIdx = parts.findIndex(p => partLooksLikeCep(p));
  if (cepIdx < 0) return null;

  return {
    cep: normalizeCepDigits(parts[cepIdx] ?? ''),
    street: parts[0] ?? '',
    number: parts[1] ?? '',
    neighborhood: parts[2] ?? '',
    city: parts[cepIdx + 1] ?? '',
    state: parts[cepIdx + 2] ?? '',
    country: parts[cepIdx + 3] ?? 'Brasil',
  };
}

export function emptyDeliveryAddress(): DeliveryAddressStructured {
  return {
    cep: '',
    street: '',
    number: '',
    neighborhood: '',
    city: '',
    state: '',
    country: 'Brasil',
  };
}

/** Exige CEP, rua, número, bairro, cidade, estado e país. */
export function isCompleteDeliveryAddress(address: string | null | undefined): boolean {
  return deliveryAddressValidationError(address) === null;
}

export function deliveryAddressValidationError(
  address: string | null | undefined,
): string | null {
  const structured = parseDeliveryAddress(address);
  if (!structured) {
    const t = address?.trim() ?? '';
    if (!t) {
      return `Informe o endereço completo da empresa (${CATALOG_DELIVERY_ADDRESS_HINT})`;
    }
    return `Use o formato: ${CATALOG_DELIVERY_ADDRESS_EXAMPLE}`;
  }
  if (!isValidCepDigits(structured.cep)) {
    return 'Informe o CEP com 8 dígitos (ex.: 01001-000).';
  }
  if (!structured.street.trim()) return 'Informe a rua/logradouro (busque pelo CEP).';
  if (!structured.number.trim()) return 'Informe o número do imóvel.';
  if (!structured.neighborhood.trim()) return 'Informe o bairro.';
  if (!structured.city.trim()) return 'Informe a cidade.';
  if (!BR_UF.test(structured.state)) {
    return 'Informe a sigla do estado (UF), ex.: SP, RJ, MG.';
  }
  const country = structured.country?.trim() || 'Brasil';
  if (!/\b(brasil|brazil)\b/i.test(country)) {
    return 'País deve ser Brasil.';
  }
  return null;
}

/** Garante país na query de geocoding. */
export function normalizeAddressForGeocode(
  address: string,
  defaultCountry = 'Brasil',
): string {
  const structured = parseDeliveryAddress(address);
  if (structured) {
    return formatDeliveryAddress(structured);
  }
  const t = address.trim();
  if (!t) return t;
  if (/\b(brasil|brazil)\b/i.test(t)) return t;
  return `${t}, ${defaultCountry}`;
}
