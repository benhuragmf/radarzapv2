import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('AlertNotification');

export class AlertNotificationService {
  private static instance: AlertNotificationService;

  static getInstance(): AlertNotificationService {
    if (!AlertNotificationService.instance) {
      AlertNotificationService.instance = new AlertNotificationService();
    }
    return AlertNotificationService.instance;
  }

  async notifySlack(text: string): Promise<void> {
    const url = process.env.ALERT_SLACK_WEBHOOK_URL?.trim();
    if (!url) return;

    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text }),
      });
      if (!res.ok) {
        logger.warn('Slack alert failed', { status: res.status });
      }
    } catch (err) {
      logger.warn('Slack alert error', { err: (err as Error).message });
    }
  }

  async whatsAppDisconnected(clientId: string, reason?: string): Promise<void> {
    const msg = `:warning: *RadarZap* — WhatsApp desconectado\n• Empresa: \`${clientId}\`${reason ? `\n• Motivo: ${reason}` : ''}`;
    await this.notifySlack(msg);
  }
}
