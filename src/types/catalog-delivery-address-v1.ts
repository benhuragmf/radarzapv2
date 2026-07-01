/** Endereço deRef de Entrega v1 — objeto estrutural no pedido (RadarChat 2.17.60+) */

import type { ReverseGeocodeResult } from '@/utils/catalog-delivery.util';
import {
  formatDeliveryAddress,
  parseDeliveryAddress,
  parseLooseDeliveryAddress,
  type DeliveryAddressStructured,
} from './catalog-delivery-address';
import { formatCepDisplay, isValidCepDigits, normalizeCepDigits } from './br-cep-format';
import { parseStreetNumberReply } from '@/utils/catalog-delivery.util';

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

export type InlineAddressCorrectionKind =
  | 'number'
  | 'street_number'
  | 'neighborhood'
  | 'complement'
  | 'cep';

export interface InlineAddressCorrection {
  kind: InlineAddressCorrectionKind;
  number?: string;
  street?: string;
  neighborhood?: string;
  complement?: string;
  zipCode?: string;
}

function normalizeInlineText(text: string): string {
  return text.trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
}

function stripNegationPrefix(text: string): string {
  return text
    .trim()
    .replace(/^(?:nao|n[aã]o|errado|incorreto|corrigir)[,.\s!?-]+/i, '')
    .replace(/^(?:é|e|o|a)\s+/i, '')
    .trim();
}

/** Negativa com dado útil inline — ex.: "não, é número 120". */
export function parseInlineAddressCorrectionAfterNo(text: string): InlineAddressCorrection | null {
  const raw = text.trim();
  if (!raw) return null;
  const norm = normalizeInlineText(raw);
  const hasNegation =
    /^(nao|n|errado|incorreto|corrigir)\b/.test(norm) || /\b(nao|errado|corrigir|incorreto)\b/.test(norm);
  if (!hasNegation) return null;

  const cepMatch = norm.match(/\bcep\s*[:\-]?\s*(\d{5}-?\d{3}|\d{8})\b/);
  if (cepMatch?.[1]) {
    const digits = normalizeCepDigits(cepMatch[1]);
    if (isValidCepDigits(digits)) {
      return { kind: 'cep', zipCode: formatCepDisplay(digits) };
    }
  }

  const bairroMatch = raw.match(/\bbairro\s*(?:é|e|:)?\s*(.+)$/i);
  if (bairroMatch?.[1]?.trim()) {
    return { kind: 'neighborhood', neighborhood: bairroMatch[1].trim() };
  }

  const compMatch = raw.match(/\bcomplemento\s*(?:é|e|:)?\s*(.+)$/i);
  if (compMatch?.[1]?.trim()) {
    return { kind: 'complement', complement: compMatch[1].trim() };
  }

  const numExplicit = norm.match(
    /(?:numero|n\.?\s*º|nº|n)\s*(?:é|e|:)?\s*(\d{1,6}[a-zA-Z]?)/,
  );
  if (numExplicit?.[1]) {
    return { kind: 'number', number: numExplicit[1] };
  }

  const afterNeg = stripNegationPrefix(raw);
  if (afterNeg) {
    const swapInAfterNeg = afterNeg.match(/^(\d{1,6}[a-zA-Z]?)\s+(?:é|e)\s+(\d{1,6}[a-zA-Z]?)\s*$/i);
    if (swapInAfterNeg?.[2]) {
      return { kind: 'number', number: swapInAfterNeg[2] };
    }

    const loose = parseLooseDeliveryAddress(afterNeg);
    if (loose?.street?.trim() && loose?.number?.trim()) {
      return {
        kind: 'street_number',
        street: loose.street.trim(),
        number: loose.number.trim(),
        neighborhood: loose.neighborhood?.trim() || undefined,
      };
    }
    const streetNum = parseStreetNumberReply(afterNeg);
    if (streetNum?.street && streetNum?.number) {
      return {
        kind: 'street_number',
        street: streetNum.street,
        number: streetNum.number,
      };
    }
    const onlyNum = afterNeg.match(/^(?:é|e|numero|nº|n\.?\s*)?\s*(\d{1,6}[a-zA-Z]?)\s*$/i);
    if (onlyNum?.[1]) {
      return { kind: 'number', number: onlyNum[1] };
    }
  }

  const swapNum = norm.match(/\b(?:é|e)\s*(\d{1,6}[a-zA-Z]?)\s*$/);
  if (swapNum?.[1] && /\b(nao|errado|incorreto)\b/.test(norm)) {
    return { kind: 'number', number: swapNum[1] };
  }

  return null;
}

/** Negativa simples sem correção inline — ex.: "não", "errado". */
export function textIsSimpleAddressConfirmationNo(text: string): boolean {
  if (parseInlineAddressCorrectionAfterNo(text)) return false;
  const t = normalizeInlineText(text);
  if (!t) return false;
  if (/^(nao|n|errado|incorreto|corrigir|outro endereco|trocar endereco|nao e esse|nao e este)$/.test(t)) {
    return true;
  }
  return /\b(nao|errado|corrigir|outro endereco)\b/.test(t) && t.length <= 80;
}

export function textIsAddressConfirmationNo(text: string): boolean {
  return textIsSimpleAddressConfirmationNo(text);
}

export function refreshV1AfterInlineCorrection(v1: DeliveryAddressV1): DeliveryAddressV1 {
  const line = formatAddressConfirmationLine(v1);
  return {
    ...v1,
    formattedAddress: line,
    status: 'needs_confirmation',
    confirmedAt: undefined,
    confirmedBy: undefined,
    needsHumanReview: false,
    normalizedAt: new Date(),
  };
}

export function buildInlineNumberCorrectedMessage(v1: DeliveryAddressV1): string {
  return (
    `Atualizei o número do endereço. Confirme por favor: *${formatAddressConfirmationLine(v1)}*.\n\n` +
    'Responda *sim* para confirmar ou envie a correção.'
  );
}

export function buildInlineAddressCorrectedMessage(v1: DeliveryAddressV1): string {
  return (
    `Atualizei o endereço. Confirme por favor: *${formatAddressConfirmationLine(v1)}*.\n\n` +
    'Responda *sim* para confirmar ou envie a correção.'
  );
}

export function buildInlineCepCorrectedMessage(): string {
  return (
    'Atualizei pelo CEP informado. Agora confirme o número do imóvel ou envie a correção do endereço.'
  );
}

export function buildSimpleAddressRejectionMessage(contactFirstName?: string): string {
  const prefix = contactFirstName?.trim() ? `${contactFirstName.trim()}, ` : '';
  return (
    `${prefix}Sem problema. Me envie o endereço correto com rua e número, ou o CEP para eu localizar novamente.`
  );
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
