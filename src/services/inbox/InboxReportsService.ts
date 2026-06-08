import mongoose from 'mongoose';
import { InboxConversation } from '@/models/InboxConversation';
import { InboxMessage } from '@/models/InboxMessage';
import { InboxDepartment } from '@/models/InboxDepartment';
import { User } from '@/models/User';
import { InboxConversationStatus } from '@/types/inbox';

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

function secBetween(a?: Date | string, b?: Date | string): number | null {
  if (!a || !b) return null;
  const diff = new Date(b).getTime() - new Date(a).getTime();
  return diff > 0 ? Math.round(diff / 1000) : null;
}

export class InboxReportsService {
  private static instance: InboxReportsService;

  static getInstance(): InboxReportsService {
    if (!InboxReportsService.instance) InboxReportsService.instance = new InboxReportsService();
    return InboxReportsService.instance;
  }

  async buildReport(clientId: string, from: Date, to: Date) {
    const clientOid = new mongoose.Types.ObjectId(clientId);
    const conversations = await InboxConversation.find({
      clientId: clientOid,
      createdAt: { $gte: from, $lte: to },
    }).lean();

    const convIds = conversations.map(c => c._id);
    const outbound = await InboxMessage.find({
      clientId: clientOid,
      conversationId: { $in: convIds },
      direction: 'outbound',
      authorUserId: { $exists: true },
    })
      .sort({ createdAt: 1 })
      .lean();

    const firstOutboundByConv = new Map<string, Date>();
    for (const m of outbound) {
      const cid = String(m.conversationId);
      if (!firstOutboundByConv.has(cid)) {
        firstOutboundByConv.set(cid, m.createdAt);
      }
    }

    const queueTimes: number[] = [];
    const firstResponseTimes: number[] = [];
    const resolutionTimes: number[] = [];

    const byDept = new Map<string, { name: string; count: number; queue: number[]; resolution: number[] }>();
    const byAgent = new Map<string, { name: string; count: number; firstResponse: number[]; resolution: number[] }>();

    const depts = await InboxDepartment.find({ clientId: clientOid }).lean();
    const deptName = new Map(depts.map(d => [String(d._id), d.name]));

    const agentIds = [
      ...new Set(
        conversations
          .flatMap(c => [c.assignedUserId?.toString(), c.suggestedUserId?.toString()])
          .filter(Boolean) as string[],
      ),
    ];
    const users = await User.find({ _id: { $in: agentIds } }).select('displayName email').lean();
    const agentName = new Map(
      users.map(u => [String(u._id), u.displayName?.trim() || u.email?.split('@')[0] || 'Atendente']),
    );

    for (const c of conversations) {
      const queueStart = c.queueEnteredAt ?? c.createdAt;
      const accepted = c.acceptedAt;
      const firstOut = firstOutboundByConv.get(String(c._id));
      const resolved = c.resolvedAt;

      const qt = secBetween(queueStart, accepted);
      if (qt != null) queueTimes.push(qt);

      const fr = secBetween(queueStart, firstOut);
      if (fr != null) firstResponseTimes.push(fr);

      const rt = secBetween(c.createdAt, resolved);
      if (rt != null) resolutionTimes.push(rt);

      if (c.departmentId) {
        const did = String(c.departmentId);
        const row = byDept.get(did) ?? {
          name: deptName.get(did) ?? 'Setor',
          count: 0,
          queue: [],
          resolution: [],
        };
        row.count += 1;
        if (qt != null) row.queue.push(qt);
        if (rt != null) row.resolution.push(rt);
        byDept.set(did, row);
      }

      if (c.assignedUserId) {
        const uid = String(c.assignedUserId);
        const row = byAgent.get(uid) ?? {
          name: agentName.get(uid) ?? 'Atendente',
          count: 0,
          firstResponse: [],
          resolution: [],
        };
        row.count += 1;
        if (fr != null) row.firstResponse.push(fr);
        if (rt != null) row.resolution.push(rt);
        byAgent.set(uid, row);
      }
    }

    const statusCounts = conversations.reduce(
      (acc, c) => {
        acc[c.status] = (acc[c.status] ?? 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      summary: {
        totalConversations: conversations.length,
        resolvedCount: statusCounts[InboxConversationStatus.RESOLVED] ?? 0,
        inProgressCount: statusCounts[InboxConversationStatus.IN_PROGRESS] ?? 0,
        waitingCount: statusCounts[InboxConversationStatus.WAITING_QUEUE] ?? 0,
        avgQueueTimeSec: avg(queueTimes),
        avgFirstResponseTimeSec: avg(firstResponseTimes),
        avgResolutionTimeSec: avg(resolutionTimes),
      },
      byDepartment: [...byDept.entries()].map(([departmentId, row]) => ({
        departmentId,
        departmentName: row.name,
        conversations: row.count,
        avgQueueTimeSec: avg(row.queue),
        avgResolutionTimeSec: avg(row.resolution),
      })),
      byAgent: [...byAgent.entries()].map(([userId, row]) => ({
        userId,
        agentName: row.name,
        conversations: row.count,
        avgFirstResponseTimeSec: avg(row.firstResponse),
        avgResolutionTimeSec: avg(row.resolution),
      })),
    };
  }
}
