/** Utilitários — exibição humana segura (endereço confirmado × pin) — RadarChat 2.17.61 */

export interface DeliveryAddressV1HumanView {
  status?: string;
  source?: string;
  formattedAddress?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  uf?: string;
  state?: string;
  zipCode?: string;
  complement?: string;
  reference?: string;
  confirmedAt?: string | Date;
  confirmedBy?: string;
  latitude?: number;
  longitude?: number;
  mapsUrl?: string;
}

/** Distância acima da qual alertamos divergência pin × endereço confirmado. */
export const PIN_ADDRESS_DIVERGENCE_WARN_METERS = 400;

const EARTH_RADIUS_M = 6_371_000;

export function haversineDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return EARTH_RADIUS_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export type PinAddressDivergenceLevel = 'none' | 'ok' | 'warn' | 'manual';

export interface PinAddressDivergenceResult {
  level: PinAddressDivergenceLevel;
  distanceMeters?: number;
  message?: string;
}

export function buildGoogleMapsUrl(lat: number, lng: number): string {
  return `https://www.google.com/maps?q=${encodeURIComponent(`${lat},${lng}`)}`;
}

export function pinLocationSourceLabel(source?: string, channel?: string): string {
  if (source === 'whatsapp_pin' || source === 'text_after_pin') {
    return channel === 'webchat' ? 'webchat' : 'whatsapp_pin';
  }
  if (channel === 'webchat') return 'webchat';
  if (channel === 'whatsapp') return 'whatsapp';
  return source ?? channel ?? 'desconhecida';
}

export function isDeliveryAddressV1ConfirmedForHuman(v1?: DeliveryAddressV1HumanView | null): boolean {
  if (!v1?.status) return false;
  return (
    v1.status === 'confirmed' ||
    v1.status === 'freight_pending' ||
    v1.status === 'freight_confirmed'
  );
}

export function deliveryAddressV1HumanLabel(v1?: DeliveryAddressV1HumanView | null): string {
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

function formatAddressLine(v1: DeliveryAddressV1HumanView): string {
  const street = v1.street?.trim();
  const number = v1.number?.trim();
  const city = v1.city?.trim();
  const uf = (v1.uf ?? v1.state)?.trim().toUpperCase();
  const neighborhood = v1.neighborhood?.trim();
  const streetLine = [street, number ? `nº ${number}` : ''].filter(Boolean).join(', ');
  const region = [neighborhood, city && uf ? `${city}-${uf}` : city ?? uf].filter(Boolean).join(', ');
  return [streetLine, region].filter(Boolean).join(', ') || v1.formattedAddress?.trim() || 'endereço informado';
}

export function formatDeliveryAddressV1DetailLines(v1?: DeliveryAddressV1HumanView | null): string[] {
  if (!v1) return [];
  const lines: string[] = [];
  if (v1.street?.trim()) lines.push(`Rua: ${v1.street.trim()}${v1.number ? `, nº ${v1.number.trim()}` : ''}`);
  else if (v1.number?.trim()) lines.push(`Número: ${v1.number.trim()}`);
  if (v1.neighborhood?.trim()) lines.push(`Bairro: ${v1.neighborhood.trim()}`);
  const cityUf = [v1.city?.trim(), (v1.uf ?? v1.state)?.trim()].filter(Boolean).join('-');
  if (cityUf) lines.push(`Cidade/UF: ${cityUf}`);
  if (v1.zipCode?.trim()) lines.push(`CEP: ${v1.zipCode.trim()}`);
  if (v1.complement?.trim()) lines.push(`Complemento: ${v1.complement.trim()}`);
  if (v1.reference?.trim()) lines.push(`Referência: ${v1.reference.trim()}`);
  if (lines.length === 0 && v1.formattedAddress?.trim()) {
    lines.push(v1.formattedAddress.trim());
  }
  return lines;
}

export function evaluatePinAddressDivergence(opts: {
  pinLat?: number | null;
  pinLng?: number | null;
  addressV1?: DeliveryAddressV1HumanView | null;
  warnThresholdMeters?: number;
}): PinAddressDivergenceResult {
  const pinLat = opts.pinLat;
  const pinLng = opts.pinLng;
  const hasPin = pinLat != null && pinLng != null && Number.isFinite(pinLat) && Number.isFinite(pinLng);
  const v1 = opts.addressV1;
  const addressConfirmed = isDeliveryAddressV1ConfirmedForHuman(v1);

  if (!hasPin) {
    return { level: 'none' };
  }

  if (!addressConfirmed) {
    return {
      level: 'manual',
      message:
        'Localização sem validação completa. Confirme manualmente antes de repassar ao entregador.',
    };
  }

  const addrLat = v1?.latitude;
  const addrLng = v1?.longitude;
  const hasAddressCoords =
    addrLat != null && addrLng != null && Number.isFinite(addrLat) && Number.isFinite(addrLng);

  if (!hasAddressCoords) {
    return {
      level: 'manual',
      message:
        'Localização sem validação completa. Confirme manualmente antes de repassar ao entregador.',
    };
  }

  const distanceMeters = haversineDistanceMeters(pinLat, pinLng, addrLat, addrLng);
  const threshold = opts.warnThresholdMeters ?? PIN_ADDRESS_DIVERGENCE_WARN_METERS;

  if (distanceMeters > threshold) {
    return {
      level: 'warn',
      distanceMeters: Math.round(distanceMeters),
      message:
        'Atenção: a localização enviada pelo cliente parece distante do endereço confirmado. Confirme manualmente antes de repassar ao entregador.',
    };
  }

  return { level: 'ok', distanceMeters: Math.round(distanceMeters) };
}

export interface ManualDeliveryCopyInput {
  orderCode?: string | null;
  contactName?: string;
  deliveryAddressV1?: DeliveryAddressV1HumanView | null;
  deliveryAddress?: string;
  pinLat?: number;
  pinLng?: number;
  deliveryFee?: string;
  totalAmount?: string;
  snapshotDeliveryFee?: string;
  snapshotTotal?: string;
}

export function buildManualDeliveryCopyText(input: ManualDeliveryCopyInput): string {
  const v1 = input.deliveryAddressV1;
  const formatted =
    (isDeliveryAddressV1ConfirmedForHuman(v1) && v1?.formattedAddress?.trim()) ||
    (v1 ? formatAddressLine(v1) : '') ||
    input.deliveryAddress?.trim() ||
    '—';

  const complementParts = [v1?.complement?.trim(), v1?.reference?.trim()].filter(Boolean);
  const complementRef = complementParts.length ? complementParts.join(' · ') : '—';

  const mapsUrl =
    v1?.mapsUrl?.trim() ||
    (input.pinLat != null && input.pinLng != null
      ? buildGoogleMapsUrl(input.pinLat, input.pinLng)
      : v1?.latitude != null && v1?.longitude != null
        ? buildGoogleMapsUrl(v1.latitude, v1.longitude)
        : '—');

  const coords =
    input.pinLat != null && input.pinLng != null
      ? `${input.pinLat.toFixed(6)}, ${input.pinLng.toFixed(6)}`
      : v1?.latitude != null && v1?.longitude != null
        ? `${v1.latitude.toFixed(6)}, ${v1.longitude.toFixed(6)}`
        : '—';

  const freight = input.snapshotDeliveryFee?.trim() || input.deliveryFee?.trim() || '—';
  const total = input.snapshotTotal?.trim() || input.totalAmount?.trim() || '—';

  return [
    `Pedido: ${input.orderCode?.trim() || '—'}`,
    `Cliente: ${input.contactName?.trim() || '—'}`,
    `Endereço confirmado: ${formatted}`,
    `Complemento/referência: ${complementRef}`,
    `Localização no Maps: ${mapsUrl}`,
    `Coordenadas: ${coords}`,
    `Frete: ${freight}`,
    `Total do pedido: ${total}`,
    'Observação: confira se o pin enviado corresponde ao endereço confirmado.',
  ].join('\n');
}
