import express from 'express';
import request from 'supertest';
import mongoose from 'mongoose';
import { ConsentStatus } from '@/types/consent';
import {
  RadarGamerInboundService,
  type RadarGamerInboundRequest,
} from '@/services/integrations/radargamer-inbound.service';
import { createRadarGamerInboundRouter } from '@/services/integrations/radargamer-inbound.routes';

const CLIENT_ID = new mongoose.Types.ObjectId().toString();
const NOW = new Date('2026-06-30T12:00:00.000Z');

function acceptedDestination() {
  return {
    type: 'contact',
    identifier: '+5511999999999',
    isActive: true,
    consent: { granted: true },
    consentStatus: ConsentStatus.ACCEPTED,
  } as any;
}

function buildDeps(overrides: Record<string, unknown> = {}) {
  const queueManager = {
    addJob: jest.fn().mockResolvedValue({ id: 'job-1' }),
  };
  const redisManager = {
    isConnected: jest.fn(() => true),
    setIfNotExists: jest.fn().mockResolvedValue(true),
    increment: jest.fn().mockResolvedValue(1),
    ttl: jest.fn().mockResolvedValue(60),
  };
  const destinationModel = {
    findByIdentifier: jest.fn().mockResolvedValue(acceptedDestination()),
  };
  const env = {
    RADARCHAT_API_TOKEN: 'secret-token',
    RADARCHAT_RADARGAMER_CLIENT_ID: CLIENT_ID,
    RADARCHAT_RADARGAMER_RATE_LIMIT_PER_MINUTE: '30',
    ...(overrides.env as Record<string, string> | undefined),
  };

  return {
    queueManager,
    redisManager,
    destinationModel,
    env,
    now: () => NOW,
    randomUUID: () => 'corr-fixed',
    ...overrides,
  };
}

function service(overrides: Record<string, unknown> = {}) {
  return new RadarGamerInboundService(buildDeps(overrides) as any);
}

function headers(overrides: Record<string, string | undefined> = {}) {
  return {
    authorization: 'Bearer secret-token',
    source: 'radargamer',
    idempotencyKey: 'evt-1',
    requestId: 'req-1',
    ...overrides,
  };
}

function payload(overrides: Partial<RadarGamerInboundRequest> = {}): RadarGamerInboundRequest {
  return {
    recipientPhone: '+5511999999999',
    templateKey: 'radargamer.price_alert',
    variables: {
      message: 'Preco caiu',
      game: 'Example Game',
    },
    sourceEventId: 'evt-1',
    sourceUserId: 'user-1',
    sourceGuildId: 'guild-1',
    priority: 'high',
    metadata: {
      source: 'radargamer',
      channel: 'whatsapp',
    },
    ...overrides,
  };
}

describe('RadarGamerInboundService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('accepts authenticated payload and enqueues WhatsApp job', async () => {
    const deps = buildDeps();
    const svc = new RadarGamerInboundService(deps as any);

    const result = await svc.acceptMessage(payload(), headers());

    expect(result).toMatchObject({
      accepted: true,
      status: 'queued',
      queuedAt: NOW.toISOString(),
      correlationId: 'req-1',
    });
    expect(deps.destinationModel.findByIdentifier).toHaveBeenCalledWith(
      '+5511999999999',
      expect.any(mongoose.Types.ObjectId),
    );
    expect(deps.queueManager.addJob).toHaveBeenCalledWith(
      'whatsapp-sending',
      'send-message',
      expect.objectContaining({
        clientId: CLIENT_ID,
        destination: '+5511999999999',
        messageId: result.messageId,
        templateName: 'radargamer.price_alert',
        consentOrigin: 'campaign',
        sendKind: 'marketing',
      }),
      expect.objectContaining({ priority: 8, attempts: 3 }),
    );
    const queuedData = deps.queueManager.addJob.mock.calls[0][2];
    expect(queuedData.content.text).toContain('Preco caiu');
    expect(queuedData.content.text).toContain('Example Game');
  });

  it('rejects missing or invalid auth', async () => {
    await expect(
      service().acceptMessage(payload(), headers({ authorization: undefined })),
    ).rejects.toMatchObject({ status: 401, code: 'AUTH_REQUIRED' });

    await expect(
      service().acceptMessage(payload(), headers({ authorization: 'Bearer wrong' })),
    ).rejects.toMatchObject({ status: 401, code: 'AUTH_INVALID' });
  });

  it('rejects invalid payload', async () => {
    await expect(
      service().acceptMessage(payload({ recipientPhone: '' }), headers()),
    ).rejects.toMatchObject({ status: 400, code: 'RECIPIENT_PHONE_REQUIRED' });

    await expect(
      service().acceptMessage(payload({ recipientPhone: 'abc' }), headers()),
    ).rejects.toMatchObject({ status: 422, code: 'INVALID_PHONE' });
  });

  it('rejects duplicate idempotency key', async () => {
    const deps = buildDeps({
      redisManager: {
        isConnected: jest.fn(() => true),
        setIfNotExists: jest.fn().mockResolvedValue(false),
        increment: jest.fn().mockResolvedValue(1),
        ttl: jest.fn().mockResolvedValue(60),
      },
    });

    await expect(
      new RadarGamerInboundService(deps as any).acceptMessage(payload(), headers()),
    ).rejects.toMatchObject({ status: 409, code: 'DUPLICATE_IDEMPOTENCY_KEY' });
    expect(deps.queueManager.addJob).not.toHaveBeenCalled();
  });

  it('rejects missing template and invalid template variables', async () => {
    await expect(
      service().acceptMessage(payload({ templateKey: 'radargamer.unknown' }), headers()),
    ).rejects.toMatchObject({ status: 404, code: 'TEMPLATE_NOT_FOUND' });

    await expect(
      service().acceptMessage(payload({ variables: { game: 'Example Game' } }), headers()),
    ).rejects.toMatchObject({ status: 422, code: 'TEMPLATE_VARIABLES_INVALID' });
  });

  it('rejects recipient without opt-in', async () => {
    const deps = buildDeps({
      destinationModel: {
        findByIdentifier: jest.fn().mockResolvedValue({
          ...acceptedDestination(),
          consent: { granted: false },
          consentStatus: ConsentStatus.MANUALLY_BLOCKED,
        }),
      },
    });

    await expect(
      new RadarGamerInboundService(deps as any).acceptMessage(payload(), headers()),
    ).rejects.toMatchObject({ status: 422, code: 'RECIPIENT_OPT_IN_REQUIRED' });
  });

  it('returns 429 with rate limit metadata', async () => {
    const deps = buildDeps({
      env: {
        RADARCHAT_API_TOKEN: 'secret-token',
        RADARCHAT_RADARGAMER_CLIENT_ID: CLIENT_ID,
        RADARCHAT_RADARGAMER_RATE_LIMIT_PER_MINUTE: '1',
      },
      redisManager: {
        isConnected: jest.fn(() => true),
        setIfNotExists: jest.fn().mockResolvedValue(true),
        increment: jest.fn().mockResolvedValue(2),
        ttl: jest.fn().mockResolvedValue(55),
      },
    });

    await expect(
      new RadarGamerInboundService(deps as any).acceptMessage(payload(), headers()),
    ).rejects.toMatchObject({
      status: 429,
      code: 'RADARGAMER_RATE_LIMIT',
      details: { rateLimit: { remaining: 0 } },
    });
  });

  it('returns 503 when enqueue fails', async () => {
    const deps = buildDeps({
      queueManager: {
        addJob: jest.fn().mockRejectedValue(new Error('redis down')),
      },
    });

    await expect(
      new RadarGamerInboundService(deps as any).acceptMessage(payload(), headers()),
    ).rejects.toMatchObject({ status: 503, code: 'QUEUE_UNAVAILABLE' });
  });

  it('supports QA no-real-send mode without adding queue job', async () => {
    const deps = buildDeps({
      env: {
        RADARCHAT_API_TOKEN: 'secret-token',
        RADARCHAT_RADARGAMER_CLIENT_ID: CLIENT_ID,
        RADARCHAT_INTEGRATION_QA_NO_SEND: 'true',
      },
    });
    const svc = new RadarGamerInboundService(deps as any);

    const result = await svc.acceptMessage(payload(), headers());

    expect(result.status).toBe('qa_no_real_send');
    expect(deps.queueManager.addJob).not.toHaveBeenCalled();
  });
});

describe('RadarGamer inbound route redaction', () => {
  it('does not echo token, phone or message body in auth errors', async () => {
    const svc = service();
    const app = express();
    app.use(express.json());
    app.use('/api/integrations/radargamer', createRadarGamerInboundRouter(svc));

    const res = await request(app)
      .post('/api/integrations/radargamer/messages')
      .set('Authorization', 'Bearer wrong-secret-token')
      .set('X-Source', 'radargamer')
      .send(payload());

    const responseText = JSON.stringify(res.body);
    expect(res.status).toBe(401);
    expect(responseText).not.toContain('wrong-secret-token');
    expect(responseText).not.toContain('+5511999999999');
    expect(responseText).not.toContain('Preco caiu');
  });
});

