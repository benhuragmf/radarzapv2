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

export function textIsCepOnly(text: string): boolean {
  const digits = normalizeCepDigits(text.trim());
  return isValidCepDigits(digits) && text.replace(/\D/g, '').length <= 8;
}

export function storedValueIsCepOnly(value: string | null | undefined): boolean {
  const t = value?.trim() ?? '';
  if (!t) return false;
  if (textIsCepOnly(t)) return true;
  const digits = normalizeCepDigits(t);
  return isValidCepDigits(digits) && !t.includes(',');
}

export function textLooksLikeStreetNumber(text: string): boolean {
  const t = text.trim();
  if (!t || t.length > 10) return false;
  return /^\d{1,6}[a-zA-Z]?$/.test(t);
}

const STREET_TYPE_PREFIX_RE =
  /^(?:rua\s*:|r\.\s*|r:\s*|avenida\s*:|av\.\s*|av:\s*|travessa\s*:|tv\.\s*|alameda\s*:|rod\.\s*|estrada\s*:)\s*/i;

/** Remove prefixo de tipo logradouro (Rua:, Av., etc.). */
export function stripStreetTypePrefix(street: string): string {
  return street.replace(STREET_TYPE_PREFIX_RE, '').trim();
}

/**
 * Interpreta endereço livre do cliente (sem CEP obrigatório) quando há rua, número, cidade e UF.
 * Ex.: "Rua: Salmen Hanze, 1326 Vila Birigui, Rondonópolis MT"
 */
export function parseLooseDeliveryAddress(text: string): DeliveryAddressStructured | null {
  const trimmed = text.trim().replace(/\s+/g, ' ');
  if (!trimmed || trimmed.length < 12) return null;

  if (isCompleteDeliveryAddress(trimmed)) {
    return parseDeliveryAddress(trimmed);
  }

  const endCityUf = trimmed.match(/,\s*([^,]+?)\s+([A-Z]{2})\s*$/i);
  if (!endCityUf) return null;

  const city = endCityUf[1]!.trim();
  const state = endCityUf[2]!.toUpperCase();
  if (!city || !BR_UF.test(state)) return null;

  const beforeCity = trimmed.slice(0, endCityUf.index).trim();
  const streetNumMatch = beforeCity.match(
    /^(?:(?:rua\s*:|r\.\s*|r:\s*|avenida\s*:|av\.\s*|av:\s*)\s*)?(.+?),\s*(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)(?:\s+(.+))?\s*$/i,
  );
  if (!streetNumMatch) return null;

  const street = stripStreetTypePrefix(streetNumMatch[1]!.trim());
  const number = streetNumMatch[2]!.trim();
  const neighborhood = streetNumMatch[3]?.trim() ?? '';
  if (!street || !number) return null;

  return {
    cep: '',
    street,
    number,
    neighborhood: neighborhood || city,
    city,
    state,
    country: 'Brasil',
  };
}

/** Endereço com dados mínimos para geocoding (rua, número, cidade, UF). */
export function isGeocodableCustomerAddress(address: string | null | undefined): boolean {
  const t = address?.trim() ?? '';
  if (!t) return false;
  if (deliveryAddressValidationError(t) === null) return true;
  const loose = parseLooseDeliveryAddress(t);
  return Boolean(loose?.street && loose.number && loose.city && BR_UF.test(loose.state));
}

/** Texto parece endereço de entrega (CEP, número, rua+número ou endereço completo). */
export function textLooksLikeDeliveryAddressInput(text: string): boolean {
  const t = text.trim();
  if (!t || t.length < 8) return false;
  if (textIsCepOnly(t)) return true;
  if (textLooksLikeStreetNumber(t)) return true;
  if (isGeocodableCustomerAddress(t)) return true;
  if (parseLooseDeliveryAddress(t)) return true;
  if (/(?:^|[\s,])(?:n[ºo°.]?\s*)?\d{1,6}[a-zA-Z]?(?:\s|$|[,.\-])/i.test(` ${t} `)) {
    return /(?:rua|r\.|r:|avenida|av\.|av:)/i.test(t) || t.includes(',');
  }
  return false;
}

/** Monta string para geocoding a partir de endereço estruturado (com ou sem CEP). */
export function formatAddressForGeocodeQuery(parts: DeliveryAddressStructured): string {
  const country = parts.country?.trim() || 'Brasil';
  const segments = [
    parts.street.trim(),
    parts.number.trim(),
    parts.neighborhood?.trim(),
    parts.city.trim(),
    parts.state.trim().toUpperCase(),
    country,
  ].filter(Boolean);
  return segments.join(', ');
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
