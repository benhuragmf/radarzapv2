import mongoose from 'mongoose';
import { WhatsAppSession } from '@/models/WhatsAppSession';
import type { PanelEventPayload } from '@/types/panel-events';

export const PANEL_WA_INGEST_TYPES = ['whatsapp:connected', 'whatsapp:disconnected'] as const;

export type PanelWaIngestType = (typeof PANEL_WA_INGEST_TYPES)[number];

const INGEST_ID_REGEX = /^sess-\d{10,}$/;

export function isValidPanelWaIngestId(id: unknown): boolean {
  return typeof id === 'string' && INGEST_ID_REGEX.test(id);
}

export function parsePanelWaIngestType(value: unknown): PanelWaIngestType | null {
  const type = String(value ?? '').trim();
  return (PANEL_WA_INGEST_TYPES as readonly string[]).includes(type)
    ? (type as PanelWaIngestType)
    : null;
}

/** Mensagens fixas no servidor — cliente não define texto (AH-R05). */
export function buildPanelWaIngestEvent(
  type: PanelWaIngestType,
  id: string,
): PanelEventPayload {
  const connected = type === 'whatsapp:connected';
  return {
    id,
    type,
    title: connected ? 'WhatsApp conectado' : 'WhatsApp desconectado',
    body: connected
      ? 'Sessão WhatsApp ativa no painel.'
      : 'Conexão WhatsApp perdida — verifique em Sessões.',
    href: '/sessions',
    createdAt: new Date().toISOString(),
    urgent: !connected,
    ownerOnly: false,
  };
}

/** Confirma estado WA no Mongo antes de persistir ingest `connected`. */
export async function assertWhatsAppIngestMatchesSession(
  clientId: string,
  type: PanelWaIngestType,
): Promise<void> {
  if (!mongoose.Types.ObjectId.isValid(clientId)) {
    throw new Error('Organização inválida');
  }

  if (type === 'whatsapp:disconnected') {
    return;
  }

  const active = await WhatsAppSession.exists({
    clientId: new mongoose.Types.ObjectId(clientId),
    status: 'active',
  });

  if (!active) {
    throw new Error('WhatsApp não está conectado para esta organização');
  }
}
