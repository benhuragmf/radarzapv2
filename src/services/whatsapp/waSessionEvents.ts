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
