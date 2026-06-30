import type { IDestination } from '@/models/Destination';

/** Contato legado (v2.17.16) gravava em `deliveryAddress`. */
type DestinationWithLegacyAddress = IDestination & { deliveryAddress?: string };

/** Endereço completo do contato (cadastro CRM), independente de entrega. */
export function resolveContactAddress(
  dest: Pick<IDestination, 'address'> | DestinationWithLegacyAddress,
): string | undefined {
  const current = dest.address?.trim();
  if (current) return current;
  const legacy = (dest as DestinationWithLegacyAddress).deliveryAddress?.trim();
  return legacy || undefined;
}
