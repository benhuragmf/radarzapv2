/** Estados normalizados (Evolution API / Baileys) */
export type WaConnectionState = 'close' | 'connecting' | 'open';

export interface WaQrCodePayload {
  base64: string;
  code: string;
  count: number;
  pairingCode?: string | null;
}

export interface WaInstanceState {
  clientId: string;
  state: WaConnectionState;
  statusReason?: number;
  wuid?: string;
  profileName?: string;
}

export type WaSessionEvent =
  | {
      event: 'CONNECTION_UPDATE';
      clientId: string;
      data: {
        state: WaConnectionState;
        statusReason?: number;
        wuid?: string;
        profileName?: string;
      };
      date_time: string;
    }
  | {
      event: 'QRCODE_UPDATED';
      clientId: string;
      data: { qrcode: WaQrCodePayload };
      date_time: string;
    };

/** Mapeia status interno do cache para estado Evolution */
export function cacheStatusToState(
  status?: string,
  hasSocket?: boolean,
): WaConnectionState {
  if (hasSocket || status === 'connected') return 'open';
  if (status === 'connecting' || status === 'qr-required') return 'connecting';
  return 'close';
}

export function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Extrai número legível do wuid Baileys (5511999999999@s.whatsapp.net) */
export function wuidToPhone(wuid?: string): string | undefined {
  if (!wuid) return undefined;
  const raw = wuid.split('@')[0]?.replace(/\D/g, '');
  if (!raw) return undefined;
  return `+${raw}`;
}

/** Converte estado live + cache para status do dashboard */
export function liveStateToStatus(
  state: WaConnectionState,
  cachedStatus?: string,
): 'connected' | 'disconnected' | 'connecting' | 'qr-required' {
  if (state === 'open') return 'connected';
  if (state === 'connecting') {
    return cachedStatus === 'qr-required' ? 'qr-required' : 'connecting';
  }
  return 'disconnected';
}
