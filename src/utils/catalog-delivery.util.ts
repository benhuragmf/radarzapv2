/** Cálculo de entrega por distância (origem empresa → endereço cliente). */

import {
  CATALOG_DELIVERY_ADDRESS_HINT,
  deliveryAddressValidationError,
  formatAddressForGeocodeQuery,
  formatDeliveryAddress,
  isCompleteDeliveryAddress,
  isGeocodableCustomerAddress,
  normalizeAddressForGeocode,
  parseDeliveryAddress,
  parseLooseDeliveryAddress,
  stripStreetTypePrefix,
} from '../types/catalog-delivery-address';
import { lookupBrCep } from './br-cep.util';

/** Monta endereço completo a partir de CEP (ViaCEP) + número informado pelo cliente. */
export async function buildDeliveryAddressFromCepAndNumber(
  cep: string,
  streetNumber: string,
): Promise<string | null> {
  const lookup = await lookupBrCep(cep);
  if (!lookup) return null;
  const number = streetNumber.trim().replace(/[^\dA-Za-z]/g, '').slice(0, 10);
  if (!number) return null;
  return formatDeliveryAddress({
    cep: lookup.cep,
    street: lookup.street.trim() || 'Logradouro',
    number,
    neighborhood: lookup.neighborhood.trim() || 'Centro',
    city: lookup.city,
    state: lookup.state,
    country: 'Brasil',
    complement: lookup.complement,
  });
}

export type CatalogDeliveryKmRates = {
  km1?: string;
  km2?: string;
  km3?: string;
  km4?: string;
  km5?: string;
  km6?: string;
  km7?: string;
  km8?: string;
};

const KM_KEYS = ['km1', 'km2', 'km3', 'km4', 'km5', 'km6', 'km7', 'km8'] as const;

export function normalizeKmRates(raw?: Partial<CatalogDeliveryKmRates> | null): CatalogDeliveryKmRates {
  if (!raw) return {};
  const out: CatalogDeliveryKmRates = {};
  for (const key of KM_KEYS) {
    const val = raw[key]?.trim();
    if (val) out[key] = val;
  }
  return out;
}

/** Graus → km (Haversine — linha reta; fallback se rota indisponível). */
export function haversineDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Faixa 1–8 km (arredonda para cima; mín. 1 se > 0). */
export function distanceKmToTier(distanceKm: number): number {
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return 1;
  return Math.min(8, Math.max(1, Math.ceil(distanceKm)));
}

export function deliveryFeeForTier(
  tierKm: number,
  rates: CatalogDeliveryKmRates,
): string | null {
  const key = `km${tierKm}` as keyof CatalogDeliveryKmRates;
  const fee = rates[key]?.trim();
  return fee || null;
}

export function formatKmRatesForAiPrompt(
  originAddress: string,
  _rates: CatalogDeliveryKmRates,
): string {
  return [
    `Origem da empresa: ${originAddress.trim() || 'não informado'}`,
    `Formato obrigatório do endereço: ${CATALOG_DELIVERY_ADDRESS_HINT}`,
    'Entrega por distância (faixas 1–8 km): o *sistema* calcula frete e total após o endereço completo — pela rota quando possível.',
    'Colete CEP → número → confirme collectedAddress completo.',
    'O cliente pode enviar o pin de localização fixa no WhatsApp — o sistema calcula o frete pelas coordenadas.',
    'Se o pin não tiver número confiável, o sistema pede rua e número antes de cotar o frete.',
    'PROIBIDO informar valor de frete, taxa de entrega ou total ao cliente — o sistema envia mensagem automática com os valores exatos.',
    'Se o cliente perguntar o frete antes do endereço, diga que o valor será calculado assim que o endereço estiver completo.',
  ].join('\n');
}

/** Distância pela rota (OSRM / OpenStreetMap). Retorna null se indisponível. */
export async function roadDistanceKm(
  origin: GeocodeResult,
  dest: GeocodeResult,
): Promise<number | null> {
  const url = `https://router.project-osrm.org/route/v1/driving/${origin.lon},${origin.lat};${dest.lon},${dest.lat}?overview=false`;
  try {
    const res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { routes?: Array<{ distance?: number }> };
    const meters = data.routes?.[0]?.distance;
    if (meters == null || !Number.isFinite(meters) || meters <= 0) return null;
    return meters / 1000;
  } catch {
    return null;
  }
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName?: string;
}

function buildGeocodeQuery(raw: string, countryCode = 'Brasil'): string {
  const trimmed = raw.trim();
  const loose = parseLooseDeliveryAddress(trimmed);
  if (loose) return formatAddressForGeocodeQuery(loose);
  return normalizeAddressForGeocode(trimmed, countryCode);
}

/** Geocodifica endereço do cliente — aceita formato livre (rua+número+cidade+UF). */
export async function geocodeCustomerAddressFree(
  query: string,
  opts?: { countryCode?: string },
): Promise<GeocodeResult | null> {
  const q = buildGeocodeQuery(query, opts?.countryCode ?? 'Brasil');
  if (q.length < 15) return null;
  if (!isGeocodableCustomerAddress(query) && deliveryAddressValidationError(q)) return null;
  return geocodeAddressFreeRaw(q);
}

/** Geocodifica endereço via Nominatim (OSM). Falha silenciosa se rede indisponível. */
export async function geocodeAddressFree(
  query: string,
  opts?: { countryCode?: string },
): Promise<GeocodeResult | null> {
  const q = normalizeAddressForGeocode(query, opts?.countryCode ?? 'Brasil');
  if (q.length < 20) return null;
  if (deliveryAddressValidationError(q)) return null;
  return geocodeAddressFreeRaw(q);
}

async function geocodeAddressFreeRaw(q: string): Promise<GeocodeResult | null> {
  const params = new URLSearchParams({
    q,
    format: 'json',
    limit: '1',
    countrycodes: 'br',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/search?${params}`, {
      headers: {
        'User-Agent': 'RadarChat/2.17 (catalog-delivery; contact@radarchat.local)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string; display_name?: string }>;
    const hit = data[0];
    if (!hit) return null;
    const lat = parseFloat(hit.lat);
    const lon = parseFloat(hit.lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null;
    return { lat, lon, displayName: hit.display_name };
  } catch {
    return null;
  }
}

/** Endereço a partir do pin WhatsApp + reverse geocoding (OSM). */
export interface ReverseGeocodeResult {
  displayName: string;
  lat: number;
  lon: number;
  houseNumber?: string;
  road?: string;
  suburb?: string;
  city?: string;
  state?: string;
  postcode?: string;
}

export async function reverseGeocodeCoords(
  lat: number,
  lon: number,
): Promise<ReverseGeocodeResult | null> {
  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lon),
    format: 'json',
    addressdetails: '1',
  });
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?${params}`, {
      headers: {
        'User-Agent': 'RadarChat/2.17 (catalog-delivery; contact@radarchat.local)',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(12_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      display_name?: string;
      lat?: string;
      lon?: string;
      address?: {
        house_number?: string;
        road?: string;
        suburb?: string;
        neighbourhood?: string;
        city?: string;
        town?: string;
        village?: string;
        state?: string;
        postcode?: string;
      };
    };
    const name = data.display_name?.trim();
    if (!name) return null;
    const addr = data.address;
    return {
      displayName: name,
      lat: parseFloat(data.lat ?? String(lat)),
      lon: parseFloat(data.lon ?? String(lon)),
      houseNumber: addr?.house_number?.trim(),
      road: addr?.road?.trim(),
      suburb: (addr?.suburb ?? addr?.neighbourhood)?.trim(),
      city: (addr?.city ?? addr?.town ?? addr?.village)?.trim(),
      state: addr?.state?.trim(),
      postcode: addr?.postcode?.trim(),
    };
  } catch {
    return null;
  }
}

/** Pin sem número confiável — pedir rua e número ao cliente. */
export function locationAddressNeedsConfirmation(opts: {
  reverse?: ReverseGeocodeResult | null;
  waAddress?: string;
  addressLabel: string;
  isLive?: boolean;
}): boolean {
  if (opts.isLive) return true;
  if (isCompleteDeliveryAddress(opts.waAddress)) return false;
  if (opts.waAddress?.trim() && textHasStreetNumber(opts.waAddress)) return false;
  if (opts.reverse?.houseNumber?.trim()) return false;
  if (isCompleteDeliveryAddress(opts.addressLabel)) return false;
  if (/^Localização GPS/i.test(opts.addressLabel)) return true;
  if (!opts.reverse) return true;
  return true;
}

function textHasStreetNumber(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  if (/^\d{5}-?\d{3}$/.test(t)) return false;
  return /(?:^|[\s,])(?:n[ºo°.]?\s*)?\d{1,6}[a-zA-Z]?(?:\s|$|[,.\-])/i.test(` ${t} `);
}

const STREET_TYPE_PREFIX_RE =
  /^(?:rua\s*:|r\.\s*|r:\s*|avenida\s*:|av\.\s*|av:\s*|travessa\s*:|tv\.\s*|alameda\s*:|rod\.\s*|estrada\s*:)\s*/i;

export function parseStreetNumberReply(
  text: string,
): { street: string; number: string } | null {
  const t = text.trim();
  if (!t) return null;
  if (isCompleteDeliveryAddress(t)) {
    const parsed = parseDeliveryAddress(t);
    if (parsed?.street && parsed.number) {
      return { street: parsed.street.trim(), number: parsed.number.trim() };
    }
  }
  const candidates = [t, t.replace(STREET_TYPE_PREFIX_RE, '').trim()];
  for (const candidate of candidates) {
    const c = candidate.trim();
    if (!c) continue;
    const comma = c.match(/^(.+?),\s*(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)\s*$/i);
    if (comma) {
      return {
        street: stripStreetTypePrefix(comma[1]!.trim()),
        number: comma[2]!.trim(),
      };
    }
    const inline = c.match(/^(.+?)\s+(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)\s*$/i);
    if (inline && inline[1]!.trim().length >= 3) {
      return {
        street: stripStreetTypePrefix(inline[1]!.trim()),
        number: inline[2]!.trim(),
      };
    }
  }
  const onlyNum = t.match(/^(?:n[ºo°.]?\s*)?(\d{1,6}[a-zA-Z]?)\s*$/i);
  if (onlyNum) {
    return { street: '', number: onlyNum[1]!.trim() };
  }
  return null;
}

/** Monta endereço completo a partir do pin + confirmação do cliente (rua e número). */
export function mergeLocationConfirmReply(
  reply: string,
  reverse: ReverseGeocodeResult | null,
): string | null {
  const trimmed = reply.trim();
  if (!trimmed) return null;
  if (isCompleteDeliveryAddress(trimmed)) return trimmed;

  const parsed = parseStreetNumberReply(trimmed);
  if (!parsed?.number) return null;

  const street = parsed.street || stripStreetTypePrefix(reverse?.road?.trim() ?? '');
  const number = parsed.number;
  if (!street || !number) {
    if (!number) return null;
    if (!reverse?.road?.trim()) return null;
  }

  const cepDigits = reverse?.postcode?.replace(/\D/g, '') ?? '';
  const neighborhood = reverse?.suburb?.trim() || reverse?.city?.trim() || 'Centro';
  const city = reverse?.city?.trim() ?? '';
  const stateMatch = reverse?.state?.match(/\b([A-Z]{2})\b/i);
  const state = stateMatch?.[1]?.toUpperCase() ?? '';

  if (!city || !state) return null;

  if (cepDigits.length === 8) {
    return formatDeliveryAddress({
      cep: cepDigits,
      street: street || reverse!.road!.trim(),
      number,
      neighborhood,
      city,
      state,
      country: 'Brasil',
    });
  }

  return formatAddressForGeocodeQuery({
    cep: '',
    street: street || reverse!.road!.trim(),
    number,
    neighborhood,
    city,
    state,
    country: 'Brasil',
  });
}

export function locationAreaHint(reverse: ReverseGeocodeResult | null): string {
  if (!reverse) return '';
  const parts = [reverse.suburb, reverse.city, reverse.state?.match(/\b([A-Z]{2})\b/i)?.[1]]
    .filter(Boolean)
    .join(', ');
  return parts;
}

export function buildAddressLabelFromLocation(parts: {
  reverseDisplayName?: string;
  waName?: string;
  waAddress?: string;
  lat: number;
  lng: number;
}): string {
  if (parts.waAddress?.trim()) return parts.waAddress.trim().slice(0, 500);
  if (parts.reverseDisplayName?.trim()) return parts.reverseDisplayName.trim().slice(0, 500);
  const label = parts.waName?.trim();
  if (label) return `${label} (${parts.lat.toFixed(5)}, ${parts.lng.toFixed(5)})`.slice(0, 500);
  return `Localização GPS (${parts.lat.toFixed(5)}, ${parts.lng.toFixed(5)})`;
}

/** Frete origem (endereço empresa) → coordenadas do cliente (pin WhatsApp). */
export async function estimateDeliveryToCoordinates(opts: {
  originAddress: string;
  destLat: number;
  destLng: number;
  rates: CatalogDeliveryKmRates;
  countryCode?: string;
}): Promise<{
  distanceKm: number;
  tierKm: number;
  deliveryFee: string | null;
  geocoded: boolean;
  distanceMethod: 'road' | 'haversine';
} | null> {
  const origin = await geocodeAddressFree(opts.originAddress, {
    countryCode: opts.countryCode ?? 'Brasil',
  });
  if (!origin) return null;

  const dest: GeocodeResult = { lat: opts.destLat, lon: opts.destLng };
  let distanceMethod: 'road' | 'haversine' = 'road';
  let distanceKm = await roadDistanceKm(origin, dest);
  if (distanceKm == null) {
    distanceKm = haversineDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);
    distanceMethod = 'haversine';
  }

  const tierKm = distanceKmToTier(distanceKm);
  const deliveryFee = deliveryFeeForTier(tierKm, opts.rates);
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    tierKm,
    deliveryFee,
    geocoded: true,
    distanceMethod,
  };
}

export async function estimateDeliveryFromAddresses(opts: {
  originAddress: string;
  destinationAddress: string;
  rates: CatalogDeliveryKmRates;
  countryCode?: string;
}): Promise<{
  distanceKm: number;
  tierKm: number;
  deliveryFee: string | null;
  geocoded: boolean;
  distanceMethod: 'road' | 'haversine';
} | null> {
  const [origin, dest] = await Promise.all([
    geocodeAddressFree(opts.originAddress, { countryCode: opts.countryCode }),
    geocodeCustomerAddressFree(opts.destinationAddress, { countryCode: opts.countryCode }),
  ]);
  if (!origin || !dest) return null;

  let distanceMethod: 'road' | 'haversine' = 'road';
  let distanceKm = await roadDistanceKm(origin, dest);
  if (distanceKm == null) {
    distanceKm = haversineDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);
    distanceMethod = 'haversine';
  }

  const tierKm = distanceKmToTier(distanceKm);
  const deliveryFee = deliveryFeeForTier(tierKm, opts.rates);
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    tierKm,
    deliveryFee,
    geocoded: true,
    distanceMethod,
  };
}

/** Remove valores de frete/total da IA quando o sistema já enviou (ou falhou) cotação oficial. */
const AI_TRANSFER_DURING_CATALOG =
  /\b(vou te transferir|vou encaminhar|estou transferindo|transferir para|encaminhar para|atendente humano|aguarde um momento)\b/i;

/** Remove promessa de transferência quando o fluxo de entrega/catálogo ainda está ativo. */
export function sanitizeAiReplyStripTransferDuringCatalogFlow(reply: string): string {
  const kept = reply
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      return !AI_TRANSFER_DURING_CATALOG.test(t);
    });
  const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length >= 8 ? cleaned : reply.trim();
}

export function aiReplyCollectsDeliveryAddress(reply: string): boolean {
  return /\b(cep|endere[cç]o de entrega|endere[cç]o completo|n[uú]mero do seu endere[cç]o|calcular o frete|valor total)\b/i.test(
    reply.trim(),
  );
}

const AI_PIX_LINE = /\b(pix|chave pix|comprovante|titular)\b/i;

/** Remove instruções PIX da IA quando o endereço ainda não foi coletado/cotado. */
export function sanitizeAiReplyStripPixBeforeAddress(reply: string): string {
  const kept = reply
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (AI_PIX_LINE.test(t) && /r\$\s*[\d.,]+/i.test(t)) return false;
      if (/^chave pix:/i.test(t)) return false;
      if (/^titular:/i.test(t)) return false;
      if (/^para pagar via pix/i.test(t)) return false;
      return true;
    });
  const cleaned = kept.join('\n').replace(/\n{3,}/g, '\n\n').trim();
  return cleaned.length >= 8 ? cleaned : reply.trim();
}

export function sanitizeAiReplyWhenServerQuotedDelivery(
  reply: string,
  opts: {
    serverQuoteSent: boolean;
    quoteFailed?: boolean;
    useDistanceBasedDelivery: boolean;
  },
): string {
  if (!opts.useDistanceBasedDelivery) return reply;
  if (!opts.serverQuoteSent && !opts.quoteFailed) return reply;
  const blocked = /(frete|entrega|taxa|total|valor\s+total|pix|r\$)/i;
  const kept = reply
    .split('\n')
    .filter(line => {
      const t = line.trim();
      if (!t) return true;
      if (/r\$\s*[\d.,]+/i.test(t) && blocked.test(t)) return false;
      if (/total\s*:/i.test(t) && /r\$/i.test(t)) return false;
      return true;
    });
  const cleaned = kept.join('\n').trim();
  if (cleaned.length >= 12) return cleaned;
  return 'Perfeito! Em instantes você recebe o resumo do pedido com os valores calculados pelo sistema.';
}
