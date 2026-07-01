import { isProduction } from '@/config/environment';

const LOCAL_DEV_BACKUP_MESSAGE =
  'Backup automático Mongo roda apenas na VPS (cron + scripts shell). Em desenvolvimento local você pode editar a política, mas nenhum dump é executado neste ambiente.';

/** Cron/scripts de backup só existem na VPS em produção. */
export function isSystemBackupAutomationAvailable(): boolean {
  return isProduction();
}

export function systemBackupLocalDevMessage(): string | null {
  return isSystemBackupAutomationAvailable() ? null : LOCAL_DEV_BACKUP_MESSAGE;
}
