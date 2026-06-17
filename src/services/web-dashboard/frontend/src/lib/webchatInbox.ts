export const WEBCHAT_INBOX_ID_PREFIX = 'wc:';

export function isWebChatInboxId(id: string): boolean {
  return id.startsWith(WEBCHAT_INBOX_ID_PREFIX);
}

export function webChatInboxIdToMongo(id: string): string {
  return id.startsWith(WEBCHAT_INBOX_ID_PREFIX) ? id.slice(WEBCHAT_INBOX_ID_PREFIX.length) : id;
}

export function webChatMediaSrc(mediaUrl: string): string {
  const [clientId, filename] = mediaUrl.split('/')
  return `/api/webchat/media/${encodeURIComponent(clientId)}/${encodeURIComponent(filename)}`
}
