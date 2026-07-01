import mongoose from 'mongoose';
import { Destination } from '@/models/Destination';
import {
  evaluateWebChatCrmCompleteness,
  type WebChatCrmCompleteness,
} from '@/utils/webchat-crm-completeness.util';

type WebChatRowCrmInput = {
  channel?: string;
  visitorPhone?: string;
  visitorIntake?: Record<string, string>;
  destinationId?: string;
};

export async function attachWebChatCrmCompletenessToRows<T extends WebChatRowCrmInput>(
  clientId: string,
  rows: T[],
): Promise<Array<T & WebChatCrmCompleteness>> {
  const destIds = [
    ...new Set(rows.map(r => r.destinationId).filter((id): id is string => Boolean(id))),
  ];
  const destById = new Map<string, { crmRegistrationStatus?: string }>();

  if (destIds.length > 0) {
    const dests = await Destination.find({
      clientId: new mongoose.Types.ObjectId(clientId),
      _id: { $in: destIds.map(id => new mongoose.Types.ObjectId(id)) },
    })
      .select('crmRegistrationStatus')
      .lean();
    for (const d of dests) {
      destById.set(String(d._id), { crmRegistrationStatus: d.crmRegistrationStatus });
    }
  }

  return rows.map(row => {
    if (row.channel !== 'webchat_site') {
      return { ...row, crmIncomplete: false, crmIncompleteHint: '' };
    }
    const dest = row.destinationId ? destById.get(row.destinationId) : undefined;
    return {
      ...row,
      ...evaluateWebChatCrmCompleteness({
        visitorPhone: row.visitorPhone,
        visitorIntake: row.visitorIntake,
        destinationId: row.destinationId,
        crmRegistrationStatus: dest?.crmRegistrationStatus,
      }),
    };
  });
}
