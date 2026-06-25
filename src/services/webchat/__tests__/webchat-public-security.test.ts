import { WebChatService } from '../WebChatService';
import { WebChatWidget } from '@/models/WebChatWidget';

jest.mock('@/models/WebChatWidget');
jest.mock('@/models/WebChatConversation');
jest.mock('@/models/WebChatMessage');

describe('WebChat público — segurança básica', () => {
  const svc = WebChatService.getInstance();

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('widget inativo não carrega via getActiveWidgetByPublicKey', async () => {
    (WebChatWidget.findOne as jest.Mock).mockResolvedValue(null);
    const widget = await svc.getActiveWidgetByPublicKey('wck_' + 'a'.repeat(32));
    expect(widget).toBeNull();
    expect(WebChatWidget.findOne).toHaveBeenCalledWith(
      expect.objectContaining({ active: true }),
    );
  });

  it('widget ativo carrega por publicKey', async () => {
    const row = { publicKey: 'wck_' + 'b'.repeat(32), active: true };
    (WebChatWidget.findOne as jest.Mock).mockResolvedValue(row);
    const widget = await svc.getActiveWidgetByPublicKey(row.publicKey);
    expect(widget).toBe(row);
  });

  it('token inválido retorna null', async () => {
    (WebChatWidget.findOne as jest.Mock).mockResolvedValue(null);
    await expect(svc.getActiveWidgetByPublicKey('wck_invalid')).resolves.toBeNull();
  });
});
