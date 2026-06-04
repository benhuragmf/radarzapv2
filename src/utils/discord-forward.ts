import type { Message } from 'discord.js';
import { MessageReferenceType } from 'discord-api-types/v10';

/** Mensagem encaminhada (Discord coloca o conteúdo no snapshot, não no wrapper). */
export function isDiscordForwardMessage(message: Message): boolean {
  const ref = message.reference;
  if (!ref || ref.type !== MessageReferenceType.Forward) return false;
  return (message.messageSnapshots?.size ?? 0) > 0;
}

/**
 * Fonte de texto/embeds/anexos para captura.
 * Em forwards, o wrapper costuma vir sem `content`/`embeds`.
 */
export function contentSourceMessage(message: Message): Message {
  if (!isDiscordForwardMessage(message)) return message;
  const snap = message.messageSnapshots?.first();
  return (snap as unknown as Message | undefined) ?? message;
}
