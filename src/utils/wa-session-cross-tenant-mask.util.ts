/** Mascara campos sensíveis de sessão WA de outro tenant na listagem global admin. */
export function maskCrossTenantWaSession<T extends {
  clientId: string;
  qrCode?: string;
  phoneNumber?: string;
  profilePictureUrl?: string;
  wuid?: string;
}>(entry: T, viewerClientId: string): T {
  if (entry.clientId === viewerClientId) return entry;
  return {
    ...entry,
    qrCode: undefined,
    phoneNumber: entry.phoneNumber ? maskWaPhoneForAdmin(entry.phoneNumber) : undefined,
    profilePictureUrl: undefined,
    wuid: undefined,
  };
}

function maskWaPhoneForAdmin(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length <= 4) return '****';
  return `****${digits.slice(-4)}`;
}
