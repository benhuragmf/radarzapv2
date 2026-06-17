import { parseWebChatAttachment } from '../webchat-attachment.util';

describe('parseWebChatAttachment', () => {
  const tinyPng =
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

  const tinyPdf = Buffer.from('%PDF-1.4\n%EOF').toString('base64');

  it('aceita PNG em base64', () => {
    const result = parseWebChatAttachment({
      dataBase64: tinyPng,
      mimeType: 'image/png',
      fileName: 'test.png',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mime).toBe('image/png');
      expect(result.ext).toBe('png');
      expect(result.mediaType).toBe('image');
      expect(result.body).toContain('test.png');
    }
  });

  it('aceita PDF em base64', () => {
    const result = parseWebChatAttachment({
      dataBase64: tinyPdf,
      mimeType: 'application/pdf',
      fileName: 'orcamento',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.mime).toBe('application/pdf');
      expect(result.mediaType).toBe('document');
      expect(result.fileName).toContain('.pdf');
    }
  });

  it('usa legenda quando informada', () => {
    const result = parseWebChatAttachment({
      dataBase64: tinyPng,
      mimeType: 'image/png',
      fileName: 'foto.png',
      caption: 'Segue o print do erro',
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.body).toBe('Segue o print do erro');
    }
  });

  it('rejeita tipo não permitido', () => {
    const result = parseWebChatAttachment({
      dataBase64: tinyPng,
      mimeType: 'application/zip',
    });
    expect(result.ok).toBe(false);
  });
});
