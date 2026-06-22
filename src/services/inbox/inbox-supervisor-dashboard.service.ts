import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxMessage } from '@/models/InboxMessage';
import { WebChatConversation } from '@/models/WebChatConversation';
import { WebChatMessage } from '@/models/WebChatMessage';
import { InboxConversationStatus } from '@/types/inbox';
import { InboxService } from '@/services/inbox/InboxService';
import { WebChatService } from '@/services/webchat/WebChatService';
import { toWebChatInboxId } from '@/services/webchat/webchat-inbox-bridge';
import { User } from '@/models/User';
import {
  getAgentPresence,
  resolveAgentActivity,
} from '@/services/inbox/inbox-agent-presence';
import type {
  SupervisorActiveConversation,
  SupervisorAgentRow,
  SupervisorDashboardPayload,
} from '@/types/inbox-supervisor';

const PERIOD_DAYS = 7;

type AgentMetricsInternal = SupervisorAgentRow['metrics'] & {
  _handle?: number[];
  _pull?: number[];
  _csat?: number[];
};

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function secBetween(a?: Date | string, b?: Date | string): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return diff > 0 ? Math.round(diff / 1000) : null;
}

function elapsedSec(from?: Date | string): number | undefined {
  if (!from) return undefined;
  const diff = Date.now() - new Date(from).getTime();
  return diff > 0 ? Math.round(diff / 1000) : 0;
}

type SupervisorHelpInfo = {
  at: string;
  preview: string;
  authorName?: string;
};

async function loadSupervisorHelpMap(
  clientOid: mongoose.Types.ObjectId,
  waIds: mongoose.Types.ObjectId[],
  wcIds: mongoose.Types.ObjectId[],
): Promise<Map<string, SupervisorHelpInfo>> {
  const map = new Map<string, SupervisorHelpInfo>();
  const waAuthorByConv = new Map<string, string>();

  if (waIds.length) {
    const msgs = await InboxMessage.find({
      clientId: clientOid,
      conversationId: { $in: waIds },
      direction: 'internal',
      body: /@supervisor/i,
    })
      .sort({ createdAt: -1 })
      .select('conversationId body createdAt authorUserId')
      .lean();

    for (const m of msgs) {
      const id = String(m.conversationId);
      if (map.has(id)) continue;
      if (m.authorUserId) waAuthorByConv.set(id, String(m.authorUserId));
      map.set(id, {
        at: (m.createdAt ?? new Date()).toISOString(),
        preview: m.body.slice(0, 120),
      });
    }
  }

  if (wcIds.length) {
    const msgs = await WebChatMessage.find({
      clientId: clientOid,
      conversationId: { $in: wcIds },
      direction: 'internal',
      body: /@supervisor/i,
    })
      .sort({ createdAt: -1 })
      .select('conversationId body createdAt senderName')
      .lean();

    for (const m of msgs) {
      const id = toWebChatInboxId(String(m.conversationId));
      if (map.has(id)) continue;
      map.set(id, {
        at: (m.createdAt ?? new Date()).toISOString(),
        preview: m.body.slice(0, 120),
        authorName: m.senderName?.trim() || undefined,
      });
    }
  }

  const waAuthorIds = [...new Set(waAuthorByConv.values())];
  if (waAuthorIds.length) {
    const authors = await User.find({ _id: { $in: waAuthorIds } })
      .select('displayName email')
      .lean();
    const authorMap = new Map(
      authors.map(a => [
        String(a._id),
        a.displayName?.trim() || a.email?.split('@')[0] || 'Equipe',
      ]),
    );
    for (const [convId, authorId] of waAuthorByConv.entries()) {
      const info = map.get(convId);
      if (!info) continue;
      info.authorName = authorMap.get(authorId);
    }
  }

  return map;
}

function applySupervisorHelp(
  conv: SupervisorActiveConversation,
  helpMap: Map<string, SupervisorHelpInfo>,
): SupervisorActiveConversation {
  const help = helpMap.get(conv.id);
  if (!help) return conv;
  return {
    ...conv,
    supervisorHelpAt: help.at,
    supervisorHelpPreview: help.preview,
    supervisorHelpAuthor: help.authorName,
  };
}

export class InboxSupervisorDashboardService {
  private static instance: InboxSupervisorDashboardService;

  static getInstance(): InboxSupervisorDashboardService {
    if (!InboxSupervisorDashboardService.instance) {
      InboxSupervisorDashboardService.instance = new InboxSupervisorDashboardService();
    }
    return InboxSupervisorDashboardService.instance;
  }

  async buildDashboard(clientId: string, supervisorUserId: string): Promise<SupervisorDashboardPayload> {
    const inbox = InboxService.getInstance();
    await inbox.listSupervisorQueue(clientId, supervisorUserId);

    const periodFrom = new Date(Date.now() - PERIOD_DAYS * 24 * 60 * 60 * 1000);
    const clientOid = new mongoose.Types.ObjectId(clientId);

    const [team, waActive, waQueue, wcRows, metricsRows, wcMetricsRows] = await Promise.all([
      inbox.listTeamMembersForAssignment(clientId),
      InboxConversation.find({
        clientId: clientOid,
        status: InboxConversationStatus.IN_PROGRESS,
      })
        .sort({ lastMessageAt: -1 })
        .limit(200)
        .lean(),
      InboxConversation.find({
        clientId: clientOid,
        status: { $in: [InboxConversationStatus.WAITING_QUEUE, InboxConversationStatus.BOT_TRIAGE] },
      })
        .sort({ lastMessageAt: -1 })
        .limit(200)
        .lean(),
      WebChatService.getInstance().listForInbox(clientId, supervisorUserId, {}),
      InboxConversation.find({
        clientId: clientOid,
        updatedAt: { $gte: periodFrom },
        assignedUserId: { $exists: true, $ne: null },
      })
        .select(
          'assignedUserId acceptedAt resolvedAt queueEnteredAt suggestedAt csatScore csatAssignedUserId status',
        )
        .lean(),
      WebChatConversation.find({
        clientId: clientOid,
        updatedAt: { $gte: periodFrom },
        assignedUserId: { $exists: true, $ne: null },
      })
        .select('assignedUserId queueEnteredAt escalatedAt suggestedAt status updatedAt')
        .lean(),
    ]);

    const agentNameById = new Map(team.filter(t => t.userId).map(t => [t.userId!, t.displayName]));

    const waActiveMapped = this.mapWaRows(waActive, agentNameById, 'in_progress');
    const waQueueMapped = this.mapWaRows(waQueue, agentNameById);
    const wcActiveMapped = wcRows.filter(r => r.status === 'in_progress').map(r => this.mapWcRow(r));
    const wcQueueMapped = wcRows
      .filter(r => r.status === 'waiting_queue' || r.status === 'bot_triage')
      .map(r => this.mapWcRow(r));

    const helpMap = await loadSupervisorHelpMap(
      clientOid,
      waActive.map(r => r._id),
      wcActiveMapped.map(r => {
        const raw = r.id.startsWith('wc:') ? r.id.slice(3) : r.id;
        return new mongoose.Types.ObjectId(raw);
      }),
    );

    const activeConversations = [...waActiveMapped, ...wcActiveMapped]
      .map(c => applySupervisorHelp(c, helpMap))
      .sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );
    const queue = [...waQueueMapped, ...wcQueueMapped].sort(
      (a, b) => new Date(b.lastMessageAt).getTime() - new Date(a.lastMessageAt).getTime(),
    );

    const activeByAgent = new Map<string, SupervisorActiveConversation[]>();
    for (const conv of activeConversations) {
      if (!conv.assignedUserId) continue;
      const list = activeByAgent.get(conv.assignedUserId) ?? [];
      list.push(conv);
      activeByAgent.set(conv.assignedUserId, list);
    }

    const metricsByAgent = this.buildAgentMetrics(metricsRows, wcMetricsRows);

    const agents: SupervisorAgentRow[] = team
      .filter(m => m.linked && m.userId)
      .map(m => {
        const userId = m.userId!;
        const presence = getAgentPresence(clientId, userId);
        const actives = (activeByAgent.get(userId) ?? []).map(c => applySupervisorHelp(c, helpMap));
        const { activity, label } = resolveAgentActivity(presence, actives.length);
        const metrics = metricsByAgent.get(userId) ?? {
          periodDays: PERIOD_DAYS,
          conversationsHandled: 0,
          avgHandleTimeSec: null,
          avgPullTimeSec: null,
          avgCsatScore: null,
          csatCount: 0,
        };
        return {
          userId,
          displayName: m.displayName,
          email: m.email,
          whatsappPhone: m.whatsappPhone,
          linked: m.linked,
          online: presence.online,
          availableForQueue: presence.availableForQueue,
          operationalStatus: presence.operationalStatus,
          statusLabel: presence.statusLabel,
          activity,
          activityLabel: label,
          currentRoute: presence.route,
          viewingConversationId: presence.viewingConversationId ?? undefined,
          activeCount: actives.length,
          activeConversations: actives,
          metrics,
        };
      })
      .sort((a, b) => {
        if (a.online !== b.online) return a.online ? -1 : 1;
        if (b.activeCount !== a.activeCount) return b.activeCount - a.activeCount;
        return a.displayName.localeCompare(b.displayName, 'pt-BR');
      });

    const allHandle = agents.flatMap(a =>
      a.metrics.avgHandleTimeSec != null ? [a.metrics.avgHandleTimeSec] : [],
    );
    const allPull = agents.flatMap(a =>
      a.metrics.avgPullTimeSec != null ? [a.metrics.avgPullTimeSec] : [],
    );
    const csatScores = agents.flatMap(a =>
      a.metrics.avgCsatScore != null && a.metrics.csatCount > 0 ? [a.metrics.avgCsatScore] : [],
    );

    const helpRequestCount = activeConversations.filter(c => c.supervisorHelpAt).length;

    return {
      generatedAt: new Date().toISOString(),
      periodDays: PERIOD_DAYS,
      summary: {
        queueCount: queue.filter(c => c.status === 'waiting_queue').length,
        triageCount: queue.filter(c => c.status === 'bot_triage').length,
        activeCount: activeConversations.length,
        onlineAgents: agents.filter(a => a.availableForQueue).length,
        priorityCount: queue.filter(c => c.suggestedAt).length,
        avgHandleTimeSec: avg(allHandle),
        avgPullTimeSec: avg(allPull),
        avgCsatScore: avg(csatScores),
        helpRequestCount,
      },
      agents,
      activeConversations,
      queue,
    };
  }

  private buildAgentMetrics(
    waRows: Array<{
      assignedUserId?: mongoose.Types.ObjectId;
      acceptedAt?: Date;
      resolvedAt?: Date;
      queueEnteredAt?: Date;
      suggestedAt?: Date;
      csatScore?: number;
      csatAssignedUserId?: mongoose.Types.ObjectId;
      status: string;
    }>,
    wcRows: Array<{
      assignedUserId?: string;
      queueEnteredAt?: Date;
      escalatedAt?: Date;
      suggestedAt?: Date;
      status?: string;
      updatedAt?: Date;
    }>,
  ): Map<string, SupervisorAgentRow['metrics']> {
    const map = new Map<string, AgentMetricsInternal>();

    const ensure = (uid: string): AgentMetricsInternal => {
      if (!map.has(uid)) {
        map.set(uid, {
          periodDays: PERIOD_DAYS,
          conversationsHandled: 0,
          avgHandleTimeSec: null,
          avgPullTimeSec: null,
          avgCsatScore: null,
          csatCount: 0,
        });
      }
      return map.get(uid)!;
    };

    for (const c of waRows) {
      if (!c.assignedUserId) continue;
      const uid = String(c.assignedUserId);
      const row = ensure(uid);
      if (
        c.status === InboxConversationStatus.IN_PROGRESS ||
        c.status === InboxConversationStatus.RESOLVED ||
        c.status === InboxConversationStatus.CLOSED
      ) {
        row.conversationsHandled += 1;
      }
      const handle = secBetween(c.acceptedAt, c.resolvedAt ?? undefined);
      if (handle != null) {
        row._handle = [...(row._handle ?? []), handle];
      } else if (c.status === InboxConversationStatus.IN_PROGRESS && c.acceptedAt) {
        const live = elapsedSec(c.acceptedAt);
        if (live != null) row._handle = [...(row._handle ?? []), live];
      }
      const pull = secBetween(c.queueEnteredAt ?? c.suggestedAt, c.acceptedAt);
      if (pull != null) row._pull = [...(row._pull ?? []), pull];
      if (c.csatScore && c.csatAssignedUserId && String(c.csatAssignedUserId) === uid) {
        row._csat = [...(row._csat ?? []), c.csatScore];
      }
    }

    for (const wc of wcRows) {
      if (!wc.assignedUserId) continue;
      const uid = String(wc.assignedUserId);
      const row = ensure(uid);
      row.conversationsHandled += 1;
      const queueStart = wc.queueEnteredAt ?? wc.escalatedAt;
      const assignStart = wc.suggestedAt ?? queueStart;
      const pull = secBetween(queueStart, assignStart) ?? elapsedSec(queueStart);
      if (pull != null) row._pull = [...(row._pull ?? []), pull];
      const handleStart = assignStart ?? queueStart;
      if (wc.status === 'closed' && handleStart && wc.updatedAt) {
        const handle = secBetween(handleStart, wc.updatedAt);
        if (handle != null) row._handle = [...(row._handle ?? []), handle];
      } else if (wc.status === 'open' && handleStart) {
        const live = elapsedSec(handleStart);
        if (live != null) row._handle = [...(row._handle ?? []), live];
      }
    }

    const out = new Map<string, SupervisorAgentRow['metrics']>();
    for (const [uid, row] of map.entries()) {
      out.set(uid, {
        periodDays: row.periodDays,
        conversationsHandled: row.conversationsHandled,
        avgHandleTimeSec: avg(row._handle ?? []),
        avgPullTimeSec: avg(row._pull ?? []),
        csatCount: (row._csat ?? []).length,
        avgCsatScore: avg(row._csat ?? []),
      });
    }
    return out;
  }

  private mapWaRows(
    rows: Array<{
      _id: mongoose.Types.ObjectId;
      contactName: string;
      contactIdentifier: string;
      status: string;
      channel?: string;
      assignedUserId?: mongoose.Types.ObjectId;
      suggestedUserId?: mongoose.Types.ObjectId;
      suggestedAt?: Date;
      acceptedAt?: Date;
      queueEnteredAt?: Date;
      lastMessageAt?: Date;
      ticketRef?: string;
    }>,
    agentNameById: Map<string, string>,
    forceStatus?: string,
  ): SupervisorActiveConversation[] {
    return rows.map(r => {
      const assignedId = r.assignedUserId ? String(r.assignedUserId) : undefined;
      const suggestedId = r.suggestedUserId ? String(r.suggestedUserId) : undefined;
      const status = forceStatus ?? r.status;
      return {
        id: String(r._id),
        channel: (r.channel as SupervisorActiveConversation['channel']) ?? 'whatsapp_qr',
        contactName: r.contactName,
        contactIdentifier: r.contactIdentifier,
        status,
        assignedUserId: assignedId,
        assignedUserName: assignedId ? agentNameById.get(assignedId) : undefined,
        suggestedUserName: suggestedId ? agentNameById.get(suggestedId) : undefined,
        suggestedAt: r.suggestedAt?.toISOString(),
        lastMessageAt: (r.lastMessageAt ?? new Date()).toISOString(),
        handleTimeSec: status === 'in_progress' ? elapsedSec(r.acceptedAt) : undefined,
        queueWaitSec: elapsedSec(r.queueEnteredAt ?? r.suggestedAt),
        ticketRef: r.ticketRef?.trim() || undefined,
      };
    });
  }

  private mapWcRow(r: {
    _id: string;
    contactName: string;
    contactIdentifier: string;
    status: string;
    departmentName?: string;
    widgetName?: string;
    assignedUserId?: string;
    assignedUserName?: string;
    suggestedUserName?: string;
    suggestedAt?: string;
    pullTimeoutSeconds?: number;
    whatsappBridgeActive?: boolean;
    lastMessageAt: string;
    lastMessagePreview?: string;
    ticketRef?: string;
  }): SupervisorActiveConversation {
    return {
      id: r._id,
      channel: 'webchat_site',
      contactName: r.contactName,
      contactIdentifier: r.contactIdentifier,
      status: r.status,
      departmentName: r.departmentName,
      widgetName: r.widgetName,
      assignedUserId: r.assignedUserId,
      assignedUserName: r.assignedUserName,
      suggestedUserName: r.suggestedUserName,
      suggestedAt: r.suggestedAt,
      pullTimeoutSeconds: r.pullTimeoutSeconds,
      whatsappBridgeActive: r.whatsappBridgeActive,
      lastMessageAt: r.lastMessageAt,
      lastMessagePreview: r.lastMessagePreview,
      handleTimeSec:
        r.status === 'in_progress' ? elapsedSec(r.suggestedAt ?? r.lastMessageAt) : undefined,
      queueWaitSec: r.status === 'waiting_queue' ? elapsedSec(r.suggestedAt) : undefined,
      ticketRef: r.ticketRef,
    };
  }
}
