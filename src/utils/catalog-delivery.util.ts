/** Cálculo de entrega por distância (origem empresa → endereço cliente). */

import {
  CATALOG_DELIVERY_ADDRESS_HINT,
  deliveryAddressValidationError,
  normalizeAddressForGeocode,
} from '../types/catalog-delivery-address';

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

/** Graus → km (Haversine). */
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
  rates: CatalogDeliveryKmRates,
): string {
  const lines = KM_KEYS.map(k => {
    const n = k.replace('km', '');
    const val = rates[k as keyof CatalogDeliveryKmRates]?.trim() || 'não informado';
    return `- Até ${n} km: ${val}`;
  });
  return [
    `Origem da entrega (empresa): ${originAddress.trim() || 'não informado'}`,
    `Formato obrigatório do endereço: ${CATALOG_DELIVERY_ADDRESS_HINT}`,
    'Tabela por distância (referência — o sistema calcula automaticamente ao receber o endereço):',
    ...lines,
    `Colete do cliente o endereço no mesmo formato (${CATALOG_DELIVERY_ADDRESS_HINT}). Não invente taxa — aguarde o cálculo do sistema após o endereço completo.`,
  ].join('\n');
}

export interface GeocodeResult {
  lat: number;
  lon: number;
  displayName?: string;
}

/** Geocodifica endereço via Nominatim (OSM). Falha silenciosa se rede indisponível. */
export async function geocodeAddressFree(
  query: string,
  opts?: { countryCode?: string },
): Promise<GeocodeResult | null> {
  const q = normalizeAddressForGeocode(query, opts?.countryCode ?? 'Brasil');
  if (q.length < 20) return null;
  if (deliveryAddressValidationError(q)) return null;
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
} | null> {
  const [origin, dest] = await Promise.all([
    geocodeAddressFree(opts.originAddress, { countryCode: opts.countryCode }),
    geocodeAddressFree(opts.destinationAddress, { countryCode: opts.countryCode }),
  ]);
  if (!origin || !dest) return null;
  const distanceKm = haversineDistanceKm(origin.lat, origin.lon, dest.lat, dest.lon);
  const tierKm = distanceKmToTier(distanceKm);
  const deliveryFee = deliveryFeeForTier(tierKm, opts.rates);
  return {
    distanceKm: Math.round(distanceKm * 10) / 10,
    tierKm,
    deliveryFee,
    geocoded: true,
  };
}
