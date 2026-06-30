import { createServiceLogger } from '@/utils/logger';
import {
  emptyWaAutomatedPeerState,
  evaluateAutomatedPeerSuppression,
  recordPeerInbound,
  recordPeerOutbound,
  type AutomatedPeerSuppressReason,
  type WaAutomatedPeerState,
} from '@/utils/wa-automated-peer.util';

const logger = createServiceLogger('WaAutomatedPeerGuard');

const peerStateByKey = new Map<string, WaAutomatedPeerState>();
const MAX_KEYS = 8000;

function peerKey(clientId: string, contactIdentifier: string): string {
  const contact = contactIdentifier.includes('@')
    ? contactIdentifier.split('@')[0]!
    : contactIdentifier;
  return `${clientId}:${contact.replace(/\D/g, '') || contact}`;
}

function pruneKeyMap(): void {
  if (peerStateByKey.size <= MAX_KEYS) return;
  const drop = Math.floor(MAX_KEYS / 4);
  let i = 0;
  for (const k of peerStateByKey.keys()) {
    peerStateByKey.delete(k);
    if (++i >= drop) break;
  }
}

export class WaAutomatedPeerGuardService {
  private static instance: WaAutomatedPeerGuardService;

  static getInstance(): WaAutomatedPeerGuardService {
    if (!WaAutomatedPeerGuardService.instance) {
      WaAutomatedPeerGuardService.instance = new WaAutomatedPeerGuardService();
    }
    return WaAutomatedPeerGuardService.instance;
  }

  /** Testes — limpa estado em memória. */
  static resetForTests(): void {
    peerStateByKey.clear();
    WaAutomatedPeerGuardService.instance = undefined as unknown as WaAutomatedPeerGuardService;
  }

  private getState(key: string): WaAutomatedPeerState {
    return peerStateByKey.get(key) ?? emptyWaAutomatedPeerState();
  }

  recordOutbound(clientId: string, contactIdentifier: string, text: string, nowMs = Date.now()): void {
    const trimmed = text.trim();
    if (!trimmed) return;
    const key = peerKey(clientId, contactIdentifier);
    peerStateByKey.set(key, recordPeerOutbound(this.getState(key), trimmed, nowMs));
    pruneKeyMap();
  }

  /**
   * Avalia inbound; se suprimir, registra timestamp mesmo assim (burst).
   * Retorna motivo quando o fluxo automático deve parar.
   */
  evaluateInbound(
    clientId: string,
    contactIdentifier: string,
    inboundText: string,
    nowMs = Date.now(),
  ): AutomatedPeerSuppressReason | null {
    const trimmed = inboundText.trim();
    if (!trimmed) return null;

    const key = peerKey(clientId, contactIdentifier);
    const state = this.getState(key);
    const { suppress, reason } = evaluateAutomatedPeerSuppression(trimmed, state, nowMs);
    const next = recordPeerInbound(state, nowMs);
    peerStateByKey.set(key, next);
    pruneKeyMap();

    if (suppress && reason) {
      logger.warn('Inbound suprimido — provável peer automatizado', {
        clientId,
        contact: contactIdentifier.slice(0, 8) + '…',
        reason,
      });
      return reason;
    }

    return null;
  }
}
