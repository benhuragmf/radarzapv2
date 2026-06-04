import mongoose from 'mongoose';
import { SystemLog } from '@/models';

export type PipelineStage =
  | 'capture'
  | 'skip'
  | 'queue'
  | 'render'
  | 'send'
  | 'send_ok'
  | 'send_fail'
  | 'error';

const STAGE_LABEL: Record<PipelineStage, string> = {
  capture: 'CAPTURE',
  skip: 'SKIP',
  queue: 'QUEUE',
  render: 'RENDER',
  send: 'SEND',
  send_ok: 'SEND OK',
  send_fail: 'SEND FAIL',
  error: 'ERROR',
};

export interface PipelineLogMeta {
  messageId?: string;
  channelId?: string;
  clientId?: string;
  traceId?: string;
  captureKind?: string;
  template?: string;
  destination?: string;
  delay?: number;
  hasLink?: boolean;
  hasRodape?: boolean;
  hasImage?: boolean;
  chars?: number;
  captionLen?: number;
  followUpLen?: number;
  reason?: string;
  error?: string;
  preview?: string;
  streamer?: string;
  streamLink?: string;
  linkKind?: string;
  linkFinal?: string;
  channelStaggerMs?: number;
  weakCaption?: boolean;
  [key: string]: unknown;
}

/**
 * Logs estruturados do pipeline Discord → WhatsApp (painel /discord/logs).
 */
export async function logPipeline(
  service: string,
  stage: PipelineStage,
  detail: string,
  meta: PipelineLogMeta = {},
  clientId?: mongoose.Types.ObjectId | string,
  traceId?: string
): Promise<void> {
  const label = STAGE_LABEL[stage];
  const message = `${label}: ${detail}`;
  const level =
    stage === 'error' || stage === 'send_fail' ? 'error' : stage === 'skip' ? 'warn' : 'info';

  const clientOid =
    clientId && mongoose.Types.ObjectId.isValid(String(clientId))
      ? new mongoose.Types.ObjectId(String(clientId))
      : undefined;

  try {
    await SystemLog.createLog(
      level,
      service,
      message,
      { ...meta, stage, pipeline: 'discord-wa' },
      clientOid,
      traceId ?? meta.traceId
    );
  } catch {
    /* não bloquear envio */
  }
}
