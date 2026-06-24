import type { IInboxDepartment } from '@/models/InboxDepartment';
import { departmentInternalRank, formatInternalRankLabel } from '@/types/inbox-department';

export type InboxDepartmentBadgeFields = {
  departmentName: string;
  departmentMenuKey?: string;
  departmentBadgeLabel: string;
  departmentClientVisible: boolean;
  departmentInternalRank: number;
  departmentInternalRankLabel: string;
};

/** Rótulo e metadados alinhados à página /platform/inbox/setores. */
export function departmentBadgeFieldsFrom(
  dept: Pick<IInboxDepartment, 'name' | 'clientVisible' | 'internalRank'> & { menuKey?: string },
): InboxDepartmentBadgeFields {
  const internalRank = departmentInternalRank(dept);
  const internalRankLabel = formatInternalRankLabel(internalRank);
  const isPublic = dept.clientVisible !== false;

  return {
    departmentName: dept.name,
    departmentMenuKey: isPublic && dept.menuKey ? dept.menuKey : undefined,
    /** Público: nome do setor · Interno: instância (2ª, 3ª…) como em Setores. */
    departmentBadgeLabel: isPublic ? dept.name : internalRankLabel,
    departmentClientVisible: isPublic,
    departmentInternalRank: internalRank,
    departmentInternalRankLabel: internalRankLabel,
  };
}
