import mongoose from 'mongoose';
import type { IDestination } from '@/models/Destination';
import { Destination } from '@/models/Destination';
import type { InboxMenuContext } from '@/types/inbox-menu-context';

export async function setContactMenuContext(
  destinationId: mongoose.Types.ObjectId,
  context: InboxMenuContext,
): Promise<void> {
  await Destination.updateOne(
    { _id: destinationId },
    { $set: { lastMenuContext: context, lastMenuSentAt: new Date() } },
  );
}

export function readContactMenuContext(dest: IDestination): {
  lastMenuContext?: InboxMenuContext;
  lastMenuSentAt?: Date;
} {
  return {
    lastMenuContext: dest.lastMenuContext,
    lastMenuSentAt: dest.lastMenuSentAt,
  };
}
