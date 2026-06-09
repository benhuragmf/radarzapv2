import mongoose from 'mongoose';
import { InboxMessage } from '@/models/InboxMessage';

const processedMemory = new Map<string, number>();
const MEMORY_TTL_MS = 10 * 60 * 1000;
const MEMORY_MAX = 5000;

function memoryKey(clientId: string, channel: string, messageId: string): string {
  return `${clientId}:${channel}:${messageId}`;
}

function pruneMemory(now: number): void {
  if (processedMemory.size <= MEMORY_MAX) return;
  for (const [k, ts] of processedMemory) {
    if (now - ts > MEMORY_TTL_MS) processedMemory.delete(k);
  }
}

/** Evita processar a mesma mensagem WA duas vezes (retry Baileys / batch). */
export async function isDuplicateInboundMessage(
  clientId: string,
  channel: string,
  whatsappMessageId: string | undefined,
): Promise<boolean> {
  if (!whatsappMessageId?.trim()) return false;

  const now = Date.now();
  pruneMemory(now);
  const key = memoryKey(clientId, channel, whatsappMessageId);
  if (processedMemory.has(key)) return true;

  const exists = await InboxMessage.exists({
    clientId: new mongoose.Types.ObjectId(clientId),
    whatsappMessageId,
  });
  if (exists) {
    processedMemory.set(key, now);
    return true;
  }
  return false;
}

export function markInboundMessageProcessed(
  clientId: string,
  channel: string,
  whatsappMessageId: string | undefined,
): void {
  if (!whatsappMessageId?.trim()) return;
  processedMemory.set(memoryKey(clientId, channel, whatsappMessageId), Date.now());
}
