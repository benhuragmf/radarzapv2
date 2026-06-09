import nodemailer from 'nodemailer';
import { config } from '@/config/environment';
import { createServiceLogger } from '@/utils/logger';

const logger = createServiceLogger('EmailService');

export type EmailTransport = 'resend' | 'smtp' | 'console' | 'none';

export interface SendEmailPayload {
  to: string;
  subject: string;
  text: string;
  html: string;
}

export interface SendEmailResult {
  ok: boolean;
  transport: EmailTransport;
  error?: string;
}

export class EmailService {
  private static instance: EmailService;

  static getInstance(): EmailService {
    if (!EmailService.instance) EmailService.instance = new EmailService();
    return EmailService.instance;
  }

  getTransport(): EmailTransport {
    if (config.MAIL.RESEND_API_KEY) return 'resend';
    if (config.MAIL.SMTP_HOST) return 'smtp';
    if (config.NODE_ENV === 'development') return 'console';
    return 'none';
  }

  isConfigured(): boolean {
    return this.getTransport() !== 'none';
  }

  async send(payload: SendEmailPayload): Promise<SendEmailResult> {
    const transport = this.getTransport();
    const to = payload.to.trim().toLowerCase();
    if (!to) return { ok: false, transport: 'none', error: 'Destinatário vazio' };

    try {
      if (transport === 'resend') {
        await this.sendViaResend(to, payload);
        return { ok: true, transport };
      }
      if (transport === 'smtp') {
        await this.sendViaSmtp(to, payload);
        return { ok: true, transport };
      }
      if (transport === 'console') {
        logger.info('E-mail (dev — transporte não configurado)', {
          to,
          subject: payload.subject,
          preview: payload.text.slice(0, 400),
        });
        return { ok: true, transport };
      }
      return {
        ok: false,
        transport,
        error: 'E-mail não configurado (defina RESEND_API_KEY ou SMTP_HOST)',
      };
    } catch (err) {
      const error = (err as Error).message || 'Falha ao enviar e-mail';
      logger.warn('Falha ao enviar e-mail', { to, transport, error });
      return { ok: false, transport, error };
    }
  }

  private async sendViaResend(to: string, payload: SendEmailPayload): Promise<void> {
    const apiKey = config.MAIL.RESEND_API_KEY;
    const from = config.MAIL.FROM;
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [to],
        subject: payload.subject,
        html: payload.html,
        text: payload.text,
      }),
    });
    if (!res.ok) {
      const body = await res.text().catch(() => '');
      throw new Error(`Resend HTTP ${res.status}: ${body.slice(0, 200)}`);
    }
  }

  private async sendViaSmtp(to: string, payload: SendEmailPayload): Promise<void> {
    const transporter = nodemailer.createTransport({
      host: config.MAIL.SMTP_HOST,
      port: config.MAIL.SMTP_PORT,
      secure: config.MAIL.SMTP_SECURE,
      auth:
        config.MAIL.SMTP_USER && config.MAIL.SMTP_PASS
          ? { user: config.MAIL.SMTP_USER, pass: config.MAIL.SMTP_PASS }
          : undefined,
    });
    await transporter.sendMail({
      from: config.MAIL.FROM,
      to,
      subject: payload.subject,
      text: payload.text,
      html: payload.html,
    });
  }
}
