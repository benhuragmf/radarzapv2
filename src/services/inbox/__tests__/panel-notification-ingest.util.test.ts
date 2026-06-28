import mongoose from 'mongoose';
import {
  assertWhatsAppIngestMatchesSession,
  buildPanelWaIngestEvent,
  isValidPanelWaIngestId,
  parsePanelWaIngestType,
} from '@/services/inbox/panel-notification-ingest.util';

jest.mock('@/models/WhatsAppSession', () => ({
  WhatsAppSession: {
    exists: jest.fn(),
  },
}));

const { WhatsAppSession } = jest.requireMock('@/models/WhatsAppSession');
const orgId = new mongoose.Types.ObjectId().toString();

describe('panel-notification-ingest.util (AH-R05)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('valida id sess-<timestamp>', () => {
    expect(isValidPanelWaIngestId('sess-1781818554645')).toBe(true);
    expect(isValidPanelWaIngestId('evil-alert')).toBe(false);
  });

  it('ignora title/body do cliente — templates fixos', () => {
    const ev = buildPanelWaIngestEvent('whatsapp:disconnected', 'sess-1234567890');
    expect(ev.title).toBe('WhatsApp desconectado');
    expect(ev.urgent).toBe(true);
    expect(ev.href).toBe('/sessions');
  });

  it('connected exige sessão active', async () => {
    WhatsAppSession.exists.mockResolvedValue(null);
    await expect(
      assertWhatsAppIngestMatchesSession(orgId, 'whatsapp:connected'),
    ).rejects.toThrow(/não está conectado/);
  });

  it('connected ok com sessão active', async () => {
    WhatsAppSession.exists.mockResolvedValue({ _id: 'x' });
    await expect(
      assertWhatsAppIngestMatchesSession(orgId, 'whatsapp:connected'),
    ).resolves.toBeUndefined();
  });

  it('disconnected não exige checagem de sessão', async () => {
    await expect(
      assertWhatsAppIngestMatchesSession(orgId, 'whatsapp:disconnected'),
    ).resolves.toBeUndefined();
    expect(WhatsAppSession.exists).not.toHaveBeenCalled();
  });

  it('parsePanelWaIngestType rejeita tipos arbitrários', () => {
    expect(parsePanelWaIngestType('whatsapp:connected')).toBe('whatsapp:connected');
    expect(parsePanelWaIngestType('billing:plan_expired')).toBeNull();
  });
});
