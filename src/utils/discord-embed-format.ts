/** Reexporta API de captura Discord → WhatsApp (compatibilidade). */
export {
  isUsefulLink as isRelevantPromoLink,
  pickBestLink as pickBestPromoLink,
  captureDiscordMessage,
  discordMarkdownToWhatsApp,
  extractStoreButtons,
  type DiscordCaptureResult,
  type StoreButton,
} from './discord-capture';

import { captureDiscordMessage, discordMarkdownToWhatsApp } from './discord-capture';

export function extractRelevantLinks(text: string): string[] {
  return discordMarkdownToWhatsApp(text).links;
}

export function formatDiscordEmbeds(
  embeds: Array<{
    title?: string | null;
    description?: string | null;
    url?: string | null;
    fields?: Array<{ name: string; value: string }>;
  }>,
) {
  const r = captureDiscordMessage({
    content: '',
    embeds,
    attachments: { values: () => [] },
    components: [],
  } as never);

  return {
    fullText: r.fullEmbedText,
    fieldsText: r.embedFieldsText,
    titles: r.embedTitles,
    descriptions: r.embedDescriptions,
    storeLabels: r.embedStoreLabels,
    relevantLinks: r.usefulLinks,
    primaryLink: r.primaryLink,
  };
}
