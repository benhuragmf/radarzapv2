const MAX_WEBCHAT_ATTACHMENT_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];

export type WebChatAttachmentPayload = {
  dataBase64: string;
  mimeType: string;
  fileName: string;
  caption?: string;
};

export function validateWebChatAttachmentFile(file: File): string | null {
  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return 'Use JPEG, PNG, WebP ou PDF';
  }
  if (file.size > MAX_WEBCHAT_ATTACHMENT_BYTES) {
    return `Arquivo muito grande — máximo ${MAX_WEBCHAT_ATTACHMENT_BYTES / (1024 * 1024)} MB`;
  }
  return null;
}

export function readWebChatAttachmentFile(
  file: File,
  caption?: string,
): Promise<WebChatAttachmentPayload> {
  const validationError = validateWebChatAttachmentFile(file);
  if (validationError) return Promise.reject(new Error(validationError));

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? '');
      const base64 = result.includes(',') ? result.split(',')[1] : result;
      const payload: WebChatAttachmentPayload = {
        dataBase64: base64,
        mimeType: file.type,
        fileName: file.name,
      };
      const trimmedCaption = caption?.trim();
      if (trimmedCaption) payload.caption = trimmedCaption.slice(0, 500);
      resolve(payload);
    };
    reader.onerror = () => reject(new Error('Falha ao ler arquivo'));
    reader.readAsDataURL(file);
  });
}

/** @deprecated use readWebChatAttachmentFile */
export const readWebChatImageFile = readWebChatAttachmentFile;

/** @deprecated use validateWebChatAttachmentFile */
export const validateWebChatImageFile = validateWebChatAttachmentFile;
