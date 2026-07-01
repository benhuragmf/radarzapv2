/** Coordenadas de mensagens de localização WhatsApp (Baileys). */

export interface WaInboundLocation {
  lat: number;
  lng: number;
  name?: string;
  address?: string;
  /** true = live location (atualização); false = pin fixo */
  isLive?: boolean;
}

/** WhatsApp pode enviar graus inteiros × 1e6 ou decimais — normaliza para graus. */
export function waCoordToDegrees(value: number | null | undefined): number | null {
  if (value == null || !Number.isFinite(value)) return null;
  const n = Number(value);
  if (Math.abs(n) > 180) return n / 1_000_000;
  return n;
}

export function isValidWaCoordinates(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    Math.abs(lat) <= 90 &&
    Math.abs(lng) <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

export function formatLocationLabel(lat: number, lng: number, name?: string): string {
  const coords = `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  if (name?.trim()) return `📍 ${name.trim()} (${coords})`;
  return `📍 Localização enviada (${coords})`;
}

const LOCATION_INBOUND_RE =
  /^📍\s*(?:Localização enviada|Localização GPS)\s*\(\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*\)/i;

/** Texto exibido no Inbox quando o cliente envia pin no WhatsApp. */
export function isWaLocationInboundText(text: string): boolean {
  return LOCATION_INBOUND_RE.test(text.trim());
}

export function parseWaLocationFromInboundText(text: string): { lat: number; lng: number } | null {
  const m = text.trim().match(LOCATION_INBOUND_RE);
  if (!m) return null;
  const lat = Number(m[1]);
  const lng = Number(m[2]);
  if (!isValidWaCoordinates(lat, lng)) return null;
  return { lat, lng };
}
