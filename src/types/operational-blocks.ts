/** Módulo afetado por um bloqueio operacional. */
export type OperationalBlockModule =
  | 'billing'
  | 'ai'
  | 'whatsapp'
  | 'config'
  | 'attendance';

export type OperationalBlockSeverity = 'critical' | 'warning';

export interface OperationalBlock {
  id: string;
  module: OperationalBlockModule;
  moduleLabel: string;
  title: string;
  reason: string;
  href?: string;
  severity: OperationalBlockSeverity;
  /** Só dono/admin com billing:view deve ver no painel. */
  ownerOnly?: boolean;
}

export interface OperationalBlocksSnapshot {
  hasBlocks: boolean;
  criticalCount: number;
  warningCount: number;
  blocks: OperationalBlock[];
  checkedAt: string;
}

export const OPERATIONAL_BLOCK_MODULE_LABELS: Record<OperationalBlockModule, string> = {
  billing: 'Planos e cobrança',
  ai: 'IA Atendimento',
  whatsapp: 'WhatsApp',
  config: 'Configuração',
  attendance: 'Atendimento',
};
