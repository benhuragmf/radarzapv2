import mongoose from 'mongoose';
import { config } from '@/config/environment';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxTicket } from '@/models/InboxTicket';
import { WebChatConversation } from '@/models/WebChatConversation';
import { InboxConversationStatus } from '@/types/inbox';
import { WhatsAppService } from '@/services/whatsapp/WhatsAppService';

const TRIAGE_STALE_MINUTES = 15;
const BRIDGE_STALE_HOURS = 24;
const CSAT_PENDING_WARN = 50;
const UNREAD_TICKET_WARN = 20;

export interface AttendanceHealthSnapshot {
  healthy: boolean;
  pilotMode: boolean;
  checkedAt: string;
  metrics: {
    triageStaleCount: number;
    csatPendingCount: number;
    unreadTicketCount: number;
    activeBridgeCount: number;
    staleBridgeCount: number;
    whatsappConnected: boolean;
    whatsappSessionHealthy: boolean;
  };
  issues: string[];
}

export async function buildAttendanceHealth(clientId: string): Promise<AttendanceHealthSnapshot> {
  const oid = new mongoose.Types.ObjectId(clientId);
  const now = new Date();
  const triageCutoff = new Date(now.getTime() - TRIAGE_STALE_MINUTES * 60_000);
  const bridgeCutoff = new Date(now.getTime() - BRIDGE_STALE_HOURS * 60 * 60_000);

  const [
    triageStaleCount,
    csatPendingCount,
    unreadTicketCount,
    activeBridgeCount,
    staleBridgeCount,
    waHealth,
  ] = await Promise.all([
    InboxConversation.countDocuments({
      clientId: oid,
      status: InboxConversationStatus.BOT_TRIAGE,
      lastMessageAt: { $lt: triageCutoff },
    }),
    InboxConversation.countDocuments({
      clientId: oid,
      csatPending: true,
    }),
    InboxTicket.countDocuments({
      clientId: oid,
      status: { $in: ['open', 'in_progress', 'client_replied'] },
      unreadClientReply: true,
    }),
    WebChatConversation.countDocuments({
      clientId: oid,
      whatsappBridgeActive: true,
      status: 'open',
    }),
    WebChatConversation.countDocuments({
      clientId: oid,
      whatsappBridgeActive: true,
      status: 'open',
      whatsappBridgeActivatedAt: { $lt: bridgeCutoff },
    }),
    WhatsAppService.getInstance().monitorSessionHealth(clientId),
  ]);

  const issues: string[] = [];
  if (triageStaleCount > 0) {
    issues.push(`${triageStaleCount} conversa(s) em triagem há mais de ${TRIAGE_STALE_MINUTES} min`);
  }
  if (csatPendingCount >= CSAT_PENDING_WARN) {
    issues.push(`${csatPendingCount} CSAT pendente(s) — acima do limite ${CSAT_PENDING_WARN}`);
  }
  if (unreadTicketCount >= UNREAD_TICKET_WARN) {
    issues.push(`${unreadTicketCount} ticket(s) com resposta do cliente não lida`);
  }
  if (staleBridgeCount > 0) {
    issues.push(`${staleBridgeCount} bridge(s) WA ativo(s) há mais de ${BRIDGE_STALE_HOURS}h`);
  }
  if (!waHealth.details.connected) {
    issues.push('Sessão WhatsApp desconectada');
  } else if (!waHealth.healthy) {
    issues.push('Sessão WhatsApp inativa ou stale');
  }

  return {
    healthy: issues.length === 0,
    pilotMode: config.PILOT?.ENABLED === true,
    checkedAt: now.toISOString(),
    metrics: {
      triageStaleCount,
      csatPendingCount,
      unreadTicketCount,
      activeBridgeCount,
      staleBridgeCount,
      whatsappConnected: waHealth.details.connected,
      whatsappSessionHealthy: waHealth.healthy,
    },
    issues,
  };
}
