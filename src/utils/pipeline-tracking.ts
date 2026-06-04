import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';
import { formatCanalRota, formatDiscordPoster } from '@/utils/discord-wa-format';
import type { PipelineLogMeta } from '@/utils/pipeline-log';

/** Metadados de rastreio (quem enviou, quem postou, canal) para logs e relatórios. */
export function buildPipelineTrackingMeta(
  extracted?: ExtractedMessage | null,
  extra: Partial<PipelineLogMeta> = {}
): PipelineLogMeta {
  if (!extracted) return { ...extra };

  return {
    tenantSender: extracted.radarzapSenderLabel,
    discordPoster: extracted.discordPosterLabel ?? extracted.authorName,
    discordPosterTag: formatDiscordPoster(extracted),
    discordAuthorId: extracted.authorId,
    discordAuthorUser: extracted.authorName,
    canalRota: formatCanalRota(extracted),
    channelName: extracted.channelName,
    guildName: extracted.guildName,
    guildId: extracted.guildId,
    captureKind: extracted.captureKind,
    primaryLink: extracted.primaryLink,
    ...extra,
  };
}
