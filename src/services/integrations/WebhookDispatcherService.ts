import crypto from 'crypto';
import mongoose from 'mongoose';
import { QueueManager } from '@/cache/QueueManager';
import { config } from '@/config/environment';
import { WebhookEndpoint, type WebhookEvent } from '@/models/WebhookEndpoint';
import { buildWebhookSignatureHeader } from '@/utils/webhook-signature';
import { decryptField } from '@/utils/field-encryption';
import { createServiceLogger } from '@/utils/logger';

export const WEBHOOK_QUEUE = 'notifications';
export const WEBHOOK_JOB = 'webhook-deliver';

export interface WebhookEnvelope {
  id: string;
  event: WebhookEvent;
  created_at: string;
  organization_id: string;
  data: Record<string, unknown>;
}

export interface WebhookDeliveryJob {
  endpointId: string;
  organizationId: string;
  event: WebhookEvent;
  url: string;
  secret: string;
  payload: WebhookEnvelope;
}

export class WebhookDispatcherService {
  private static instance: WebhookDispatcherService;
  private readonly logger = createServiceLogger('WebhookDispatcher');
  private readonly queueManager = QueueManager.getInstance();
  private initialized = false;

  static getInstance(): WebhookDispatcherService {
    if (!WebhookDispatcherService.instance) {
      WebhookDispatcherService.instance = new WebhookDispatcherService();
    }
    return WebhookDispatcherService.instance;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    await this.queueManager.registerProcessor(
      WEBHOOK_QUEUE,
      async job => {
        if (job.name !== WEBHOOK_JOB) {
          return { skipped: true, jobName: job.name };
        }
        return this.deliver(job.data as WebhookDeliveryJob);
      },
      5,
    );

    this.initialized = true;
    this.logger.info('Webhook dispatcher registrado na fila notifications');
  }

  /** Enfileira entrega para todos os endpoints ativos da org que assinam o evento. */
  emit(organizationId: string, event: WebhookEvent, data: Record<string, unknown>): void {
    void this.enqueue(organizationId, event, data).catch(err => {
      this.logger.warn('Falha ao enfileirar webhook', {
        organizationId,
        event,
        error: (err as Error).message,
      });
    });
  }

  async enqueue(
    organizationId: string,
    event: WebhookEvent,
    data: Record<string, unknown>,
  ): Promise<number> {
    if (!mongoose.Types.ObjectId.isValid(organizationId)) return 0;

    const orgOid = new mongoose.Types.ObjectId(organizationId);
    const endpoints = await WebhookEndpoint.find({
      organizationId: orgOid,
      active: true,
      events: event,
    }).lean();

    if (endpoints.length === 0) return 0;

    const payload: WebhookEnvelope = {
      id: crypto.randomUUID(),
      event,
      created_at: new Date().toISOString(),
      organization_id: organizationId,
      data,
    };

    for (const ep of endpoints) {
      await this.queueManager.addJob(
        WEBHOOK_QUEUE,
        WEBHOOK_JOB,
        {
          endpointId: String(ep._id),
          organizationId,
          event,
          url: ep.url,
          secret: decryptField(ep.secret),
          payload,
        } satisfies WebhookDeliveryJob,
        {
          attempts: config.WEBHOOK.MAX_RETRIES,
          backoff: { type: 'exponential', delay: config.WEBHOOK.RETRY_DELAY_MS },
          removeOnComplete: 200,
          removeOnFail: 100,
        },
      );
    }

    return endpoints.length;
  }

  /** Entrega HTTP — lança erro para BullMQ retentar. */
  async deliver(job: WebhookDeliveryJob): Promise<{ status: number }> {
    const rawBody = JSON.stringify(job.payload);
    const signature = buildWebhookSignatureHeader(job.secret, rawBody);
    const timeoutMs = config.WEBHOOK.TIMEOUT_MS;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    let httpStatus = 0;
    try {
      const res = await fetch(job.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': 'RadarZap-Webhook/1.0',
          'X-RadarZap-Signature': signature,
          'X-RadarZap-Event': job.event,
          'X-RadarZap-Delivery-Id': job.payload.id,
        },
        body: rawBody,
        signal: controller.signal,
      });
      httpStatus = res.status;

      await WebhookEndpoint.updateOne(
        { _id: job.endpointId },
        { lastDeliveryAt: new Date(), lastDeliveryStatus: httpStatus },
      );

      if (httpStatus < 200 || httpStatus >= 300) {
        throw new Error(`Webhook HTTP ${httpStatus} — ${job.url}`);
      }

      this.logger.debug('Webhook entregue', {
        event: job.event,
        endpointId: job.endpointId,
        status: httpStatus,
      });

      return { status: httpStatus };
    } catch (err) {
      await WebhookEndpoint.updateOne(
        { _id: job.endpointId },
        {
          lastDeliveryAt: new Date(),
          lastDeliveryStatus: httpStatus || 0,
        },
      );
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
}
