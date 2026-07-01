/** Endereço deRef de Entrega v1 — objeto estrutural no pedido (RadarChat 2.17.60+) */

import type { ReverseGeocodeResult } from '@/utils/catalog-delivery.util';
import {
  formatDeliveryAddress,
  parseDeliveryAddress,
  parseLooseDeliveryAddress,
  type DeliveryAddressStructured,
} from './catalog-delivery-address';
import { formatCepDisplay, normalizeCepDigits } from './br-cep-format';

export const DELIVERY_ADDRESS_V1_SOURCES = [
  'cep',
  'whatsapp_pin',
  'text',
  'text_after_pin',
  'contact_saved_address',
  'operator',
  'webchat',
  'mixed',
  'legacy_backfill',
] as const;

export type DeliveryAddressV1Source = (typeof DELIVERY_ADDRESS_V1_SOURCES)[number];

export const DELIVERY_ADDRESS_V1_STATUSES = [
  'empty',
  'partial',
  'received',
  'needs_confirmation',
  'confirmed',
  'geocoding_failed',
  'freight_pending',
  'freight_confirmed',
  'needs_human_review',
  'cancelled',
] as const;

export type DeliveryAddressV1Status = (typeof DELIVERY_ADDRESS_V1_STATUSES)[number];

export type DeliveryAddressConfirmedBy = 'customer' | 'operator' | 'system';

export interface DeliveryAddressV1 {
  rawText?: string;
  street?: string;
  number?: string;
  complement?: string;
  reference?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  uf?: string;
  zipCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  source?: DeliveryAddressV1Source;
  confidence?: 'low' | 'medium' | 'high';
  status?: DeliveryAddressV1Status;
  confirmedBy?: DeliveryAddressConfirmedBy;
  confirmedAt?: Date | string;
  normalizedAt?: Date | string;
  needsHumanReview?: boolean;
  missingFields?: string[];
  geocodeProvider?: string;
  geocodeStatus?: 'pending' | 'ok' | 'failed' | 'skipped';
  reverseGeocodeStatus?: 'pending' | 'ok' | 'failed' | 'skipped';
  mapsUrl?: string;
  formattedAddress?: string;
  notes?: string;
  /** Versão da regra de frete usada no snapshot (ex.: distance_km_v1) */
  freightRuleVersion?: string;
}

export interface DeliveryAddressSnapshot {
  formattedAddress: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  zipCode?: string;
  latitude?: number;
  longitude?: number;
  source?: DeliveryAddressV1Source;
  confirmedAt?: Date | string;
  confirmedBy?: DeliveryAddressConfirmedBy;
  deliveryDistanceKm?: number;
  deliveryTierKm?: number;
  deliveryFee?: string;
  subtotalAmount?: string;
  totalAmount?: string;
  freightRuleVersion?: string;
  capturedAt: Date | string;
}

export function buildMapsUrl(lat?: number, lng?: number): string | undefined {
  if (lat == null || lng == null || !Number.isFinite(lat) || !Number.isFinite(lng)) return undefined;
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function structuredToDeliveryAddressV1(
  parts: DeliveryAddressStructured,
  opts?: {
    source?: DeliveryAddressV1Source;
    rawText?: string;
    lat?: number;
    lng?: number;
    status?: DeliveryAddressV1Status;
    confidence?: DeliveryAddressV1['confidence'];
    missingFields?: string[];
  },
): DeliveryAddressV1 {
  const uf = parts.state.trim().toUpperCase();
  const formatted = formatDeliveryAddress(parts);
  return {
    rawText: opts?.rawText,
    street: parts.street.trim(),
    number: parts.number.trim(),
    complement: parts.complement?.trim(),
    neighborhood: parts.neighborhood.trim(),
    city: parts.city.trim(),
    state: parts.state.trim(),
    uf,
    zipCode: parts.cep ? formatCepDisplay(normalizeCepDigits(parts.cep)) : undefined,
    country: parts.country?.trim() || 'Brasil',
    latitude: opts?.lat,
    longitude: opts?.lng,
    source: opts?.source ?? 'text',
    confidence: opts?.confidence ?? 'medium',
    status: opts?.status ?? 'received',
    normalizedAt: new Date(),
    missingFields: opts?.missingFields ?? [],
    mapsUrl: buildMapsUrl(opts?.lat, opts?.lng),
    formattedAddress: formatted,
    geocodeStatus: 'skipped',
    reverseGeocodeStatus: opts?.lat != null ? 'ok' : 'skipped',
  };
}

export function formatAddressConfirmationLine(v1: DeliveryAddressV1): string {
  const street = v1.street?.trim();
  const number = v1.number?.trim();
  const city = v1.city?.trim();
  const uf = (v1.uf ?? v1.state)?.trim().toUpperCase();
  const neighborhood = v1.neighborhood?.trim();

  const streetLine = [street, number ? `nº ${number}` : ''].filter(Boolean).join(', ');
  const region = [neighborhood, city && uf ? `${city}-${uf}` : city ?? uf].filter(Boolean).join(', ');
  return [streetLine, region].filter(Boolean).join(', ') || v1.formattedAddress?.trim() || 'endereço informado';
}

export function buildAddressConfirmationRequestMessage(v1: DeliveryAddressV1): string {
  const line = formatAddressConfirmationLine(v1);
  return (
    `Recebi o endereço. Antes de calcular a entrega, confirme se está correto: *${line}*.\n\n` +
    'Responda *sim* para confirmar ou envie a correção.'
  );
}

export function buildAddressNeedsNumberMessage(): string {
  return 'Consegui identificar a rua, mas falta o *número* do imóvel. Me envie somente o número, por favor.';
}

export function buildCepCollectedNeedsNumberMessage(): string {
  return (
    'Encontrei o endereço pelo CEP. Agora me informe o *número* do imóvel para confirmar a entrega antes do pagamento.'
  );
}

export function buildPinNeedsStreetNumberMessage(): string {
  return 'Recebi sua localização. Agora me envie apenas a *rua* e o *número* do imóvel para confirmar a entrega.';
}

export function buildCepOfferAllowedReply(): string {
  return 'Sim, pode me enviar o *CEP*. Com ele eu localizo a rua e depois confirmo o número antes de calcular a entrega.';
}

export function buildGeocodingFailedHumanMessage(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return (
    `${prefix}Recebi seu endereço, mas não consegui confirmar a localização automaticamente. ` +
    'Vou chamar um atendente para conferir a entrega antes do pagamento.'
  );
}

export function textIsAddressConfirmationYes(text: string): boolean {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!t || t.length > 40) return false;
  return /^(sim|s|correto|certo|isso|confirmo|confirmado|ta certo|esta certo|ok|pode ser|exato|isso mesmo|isso ai)$/.test(
    t,
  );
}

export function textIsAddressConfirmationNo(text: string): boolean {
  const t = text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  if (!t) return false;
  if (/^(nao|n|errado|incorreto|corrigir|outro endereco|trocar endereco|nao e esse|nao e este)$/.test(t)) {
    return true;
  }
  return /\b(nao|errado|corrigir|outro endereco)\b/.test(t) && t.length <= 80;
}

export function isDeliveryAddressV1Confirmed(v1?: DeliveryAddressV1 | null): boolean {
  if (!v1?.status) return false;
  return v1.status === 'confirmed' || v1.status === 'freight_pending' || v1.status === 'freight_confirmed';
}

export function deliveryAddressV1NeedsConfirmation(v1?: DeliveryAddressV1 | null): boolean {
  return v1?.status === 'needs_confirmation';
}

export function deliveryAddressV1Label(v1?: DeliveryAddressV1 | null): string {
  if (!v1?.status || v1.status === 'empty') return 'Sem endereço';
  switch (v1.status) {
    case 'partial':
    case 'received':
      return 'Endereço parcial';
    case 'needs_confirmation':
      return 'Endereço aguardando confirmação';
    case 'confirmed':
      return 'Endereço confirmado';
    case 'freight_pending':
      return 'Frete pendente';
    case 'freight_confirmed':
      return 'Frete confirmado';
    case 'geocoding_failed':
    case 'needs_human_review':
      return 'Conferência humana necessária';
    case 'cancelled':
      return 'Endereço cancelado';
    default:
      return 'Endereço';
  }
}

export function syncLegacyFieldsFromV1(v1: DeliveryAddressV1): {
  deliveryAddress?: string;
  deliveryLocationLat?: number;
  deliveryLocationLng?: number;
  deliveryLocationPendingConfirm?: boolean;
} {
  const pending =
    v1.status === 'partial' ||
    v1.status === 'received' ||
    v1.status === 'needs_confirmation' ||
    Boolean(v1.missingFields?.length);
  return {
    deliveryAddress: v1.formattedAddress?.slice(0, 500),
    deliveryLocationLat: v1.latitude,
    deliveryLocationLng: v1.longitude,
    deliveryLocationPendingConfirm: pending,
  };
}

export function backfillDeliveryAddressV1FromLegacy(order: {
  deliveryAddress?: string;
  deliveryLocationLat?: number;
  deliveryLocationLng?: number;
  deliveryLocationPendingConfirm?: boolean;
  status?: string;
}): DeliveryAddressV1 | undefined {
  const raw = order.deliveryAddress?.trim();
  if (!raw) {
    if (order.deliveryLocationLat != null && order.deliveryLocationLng != null) {
      return {
        latitude: order.deliveryLocationLat,
        longitude: order.deliveryLocationLng,
        source: 'whatsapp_pin',
        status: order.deliveryLocationPendingConfirm ? 'partial' : 'received',
        confidence: 'low',
        normalizedAt: new Date(),
        mapsUrl: buildMapsUrl(order.deliveryLocationLat, order.deliveryLocationLng),
        formattedAddress: raw || `Localização GPS (${order.deliveryLocationLat}, ${order.deliveryLocationLng})`,
        missingFields: order.deliveryLocationPendingConfirm ? ['street', 'number'] : [],
      };
    }
    return { status: 'empty', normalizedAt: new Date() };
  }

  const structured = parseDeliveryAddress(raw) ?? parseLooseDeliveryAddress(raw);
  if (structured) {
    const v1 = structuredToDeliveryAddressV1(structured, {
      source: 'legacy_backfill',
      rawText: raw,
      lat: order.deliveryLocationLat,
      lng: order.deliveryLocationLng,
      status: order.deliveryLocationPendingConfirm
        ? 'needs_confirmation'
        : order.status === 'aguardando_pagamento'
          ? 'confirmed'
          : 'received',
      confidence: 'medium',
    });
    return v1;
  }

  return {
    rawText: raw,
    formattedAddress: raw,
    source: 'legacy_backfill',
    status: order.deliveryLocationPendingConfirm ? 'partial' : 'received',
    latitude: order.deliveryLocationLat,
    longitude: order.deliveryLocationLng,
    confidence: 'low',
    normalizedAt: new Date(),
    mapsUrl: buildMapsUrl(order.deliveryLocationLat, order.deliveryLocationLng),
  };
}

export function createDeliveryAddressSnapshot(opts: {
  v1: DeliveryAddressV1;
  order: {
    deliveryDistanceKm?: number;
    deliveryTierKm?: number;
    deliveryFee?: string;
    subtotalAmount?: string;
    totalAmount?: string;
  };
  freightRuleVersion?: string;
}): DeliveryAddressSnapshot {
  const { v1, order } = opts;
  return {
    formattedAddress: v1.formattedAddress ?? formatAddressConfirmationLine(v1),
    street: v1.street,
    number: v1.number,
    neighborhood: v1.neighborhood,
    city: v1.city,
    uf: v1.uf ?? v1.state,
    zipCode: v1.zipCode,
    latitude: v1.latitude,
    longitude: v1.longitude,
    source: v1.source,
    confirmedAt: v1.confirmedAt ?? new Date(),
    confirmedBy: v1.confirmedBy,
    deliveryDistanceKm: order.deliveryDistanceKm,
    deliveryTierKm: order.deliveryTierKm,
    deliveryFee: order.deliveryFee,
    subtotalAmount: order.subtotalAmount,
    totalAmount: order.totalAmount,
    freightRuleVersion: opts.freightRuleVersion ?? v1.freightRuleVersion ?? 'distance_km_v1',
    capturedAt: new Date(),
  };
}

export function mergePinReverseIntoV1(
  v1: DeliveryAddressV1,
  reverse: ReverseGeocodeResult | null,
): DeliveryAddressV1 {
  if (!reverse) return v1;
  const next = { ...v1 };
  if (!next.street && reverse.road) next.street = reverse.road;
  if (!next.number && reverse.houseNumber) next.number = reverse.houseNumber;
  if (!next.neighborhood && reverse.suburb) next.neighborhood = reverse.suburb;
  if (!next.city && reverse.city) next.city = reverse.city;
  if (!next.uf && reverse.state) {
    next.state = reverse.state;
  }
  if (!next.zipCode && reverse.postcode) next.zipCode = formatCepDisplay(normalizeCepDigits(reverse.postcode));
  if (!next.formattedAddress && reverse.displayName) next.formattedAddress = reverse.displayName;
  next.latitude = reverse.lat;
  next.longitude = reverse.lon;
  next.mapsUrl = buildMapsUrl(reverse.lat, reverse.lon);
  next.reverseGeocodeStatus = 'ok';
  return next;
}
