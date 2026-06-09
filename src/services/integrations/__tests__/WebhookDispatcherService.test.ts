import mongoose from 'mongoose';
import { WebhookDispatcherService } from '@/services/integrations/WebhookDispatcherService';
import { WebhookEndpoint } from '@/models/WebhookEndpoint';

jest.mock('@/models/WebhookEndpoint', () => ({
  WebhookEndpoint: {
    find: jest.fn(),
    updateOne: jest.fn(),
  },
}));

describe('WebhookDispatcherService', () => {
  const orgId = new mongoose.Types.ObjectId().toString();
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn().mockResolvedValue({ status: 200, ok: true });
    global.fetch = fetchMock;
    (WebhookEndpoint.updateOne as jest.Mock).mockResolvedValue({});
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('deliver envia POST com headers RadarZap', async () => {
    const svc = WebhookDispatcherService.getInstance();
    const job = {
      endpointId: 'ep1',
      organizationId: orgId,
      event: 'campaign.sent' as const,
      url: 'https://example.com/hook',
      secret: 'whsec_abc123',
      payload: {
        id: 'evt-1',
        event: 'campaign.sent' as const,
        created_at: '2026-01-01T00:00:00.000Z',
        organization_id: orgId,
        data: { campaign_id: 'c1' },
      },
    };

    const result = await svc.deliver(job);
    expect(result.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.method).toBe('POST');
    expect(init.headers).toMatchObject({
      'Content-Type': 'application/json',
      'X-RadarZap-Event': 'campaign.sent',
      'X-RadarZap-Delivery-Id': 'evt-1',
    });
    expect(String((init.headers as Record<string, string>)['X-RadarZap-Signature'])).toMatch(/^t=\d+,v1=[a-f0-9]+$/);
    expect(WebhookEndpoint.updateOne).toHaveBeenCalled();
  });

  it('deliver lança erro em HTTP 500 para retry', async () => {
    fetchMock.mockResolvedValue({ status: 500, ok: false });
    const svc = WebhookDispatcherService.getInstance();
    await expect(
      svc.deliver({
        endpointId: 'ep1',
        organizationId: orgId,
        event: 'consent.updated',
        url: 'https://example.com/hook',
        secret: 'whsec_x',
        payload: {
          id: 'evt-2',
          event: 'consent.updated',
          created_at: '2026-01-01T00:00:00.000Z',
          organization_id: orgId,
          data: {},
        },
      }),
    ).rejects.toThrow('Webhook HTTP 500');
  });

  it('enqueue retorna 0 sem endpoints', async () => {
    (WebhookEndpoint.find as jest.Mock).mockReturnValue({
      lean: jest.fn().mockResolvedValue([]),
    });
    const svc = WebhookDispatcherService.getInstance();
    const n = await svc.enqueue(orgId, 'session.connected', { status: 'connected' });
    expect(n).toBe(0);
  });
});
