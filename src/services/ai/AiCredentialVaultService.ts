import { encryptField, decryptField } from '@/utils/field-encryption';

export class AiCredentialVaultService {
  private static instance: AiCredentialVaultService;

  static getInstance(): AiCredentialVaultService {
    if (!this.instance) this.instance = new AiCredentialVaultService();
    return this.instance;
  }

  encryptApiKey(plain: string): string {
    return encryptField(plain.trim());
  }

  decryptApiKey(stored?: string | null): string | null {
    if (!stored?.trim()) return null;
    return decryptField(stored);
  }

  maskApiKey(plain?: string | null): string | null {
    if (!plain?.trim()) return null;
    const t = plain.trim();
    if (t.length <= 8) return '••••••••';
    return `${t.slice(0, 4)}••••${t.slice(-4)}`;
  }

  hasKey(stored?: string | null): boolean {
    return Boolean(stored?.trim());
  }
}
