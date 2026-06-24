export type DeptMenuSlice = {
  _id: unknown;
  menuKey: string;
  clientVisible?: boolean;
  isActive?: boolean;
  sortOrder?: number;
  createdAt?: Date;
};

export function isActiveDepartment(d: Pick<DeptMenuSlice, 'isActive'>): boolean {
  return d.isActive !== false;
}

export function isPublicNumericMenuKey(menuKey: string): boolean {
  return /^\d+$/.test(menuKey.trim());
}

export function isInternalMenuKey(menuKey: string): boolean {
  return /^i\d+$/i.test(menuKey.trim());
}

export function isOffMenuKey(menuKey: string): boolean {
  return /^o\d+$/i.test(menuKey.trim());
}

/** Interno com menu numérico, inativo com menu público, ou públicos ativos fora de 1..n. */
export function departmentMenuKeysNeedRepair(depts: DeptMenuSlice[]): boolean {
  const active = depts.filter(isActiveDepartment);
  const inactive = depts.filter(d => !isActiveDepartment(d));

  if (inactive.some(d => isPublicNumericMenuKey(d.menuKey))) return true;

  const publicActive = active.filter(d => d.clientVisible !== false);
  const internalActive = active.filter(d => d.clientVisible === false);

  if (internalActive.some(d => isPublicNumericMenuKey(d.menuKey))) return true;
  if (internalActive.some(d => !isInternalMenuKey(d.menuKey))) return true;
  if (publicActive.some(d => !isPublicNumericMenuKey(d.menuKey))) return true;

  const sortedPublic = sortDepartments(publicActive);
  for (let i = 0; i < sortedPublic.length; i++) {
    if (sortedPublic[i].menuKey !== String(i + 1)) return true;
  }

  const sortedInternal = sortDepartments(internalActive);
  for (let i = 0; i < sortedInternal.length; i++) {
    if (sortedInternal[i].menuKey.toLowerCase() !== `i${i + 1}`) return true;
  }

  return false;
}

export function sortDepartments<T extends DeptMenuSlice>(depts: T[]): T[] {
  return [...depts].sort((a, b) => {
    const order = (a.sortOrder ?? 0) - (b.sortOrder ?? 0);
    if (order !== 0) return order;
    const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
    const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
    return aCreated - bCreated;
  });
}

/** Próxima tecla pública — só setores ativos e visíveis ao cliente. */
export function nextPublicMenuKeyFrom(
  depts: Array<{ menuKey: string; clientVisible?: boolean; isActive?: boolean; _id?: unknown }>,
  excludeId?: string,
): string {
  const nums = depts
    .filter(isActiveDepartment)
    .filter(d => d.clientVisible !== false)
    .filter(d => !excludeId || String(d._id) !== excludeId)
    .map(d => parseInt(d.menuKey, 10))
    .filter(n => !Number.isNaN(n) && n > 0);
  return String((nums.length ? Math.max(...nums) : 0) + 1);
}

/** Próxima tecla interna i1, i2… — só setores internos ativos. */
export function nextInternalMenuKeyFrom(
  depts: Array<{ menuKey: string; clientVisible?: boolean; isActive?: boolean; _id?: unknown }>,
  excludeId?: string,
): string {
  const nums = depts
    .filter(isActiveDepartment)
    .filter(d => d.clientVisible === false)
    .filter(d => !excludeId || String(d._id) !== excludeId)
    .map(d => /^i(\d+)$/i.exec(d.menuKey)?.[1])
    .filter(Boolean)
    .map(n => parseInt(n!, 10));
  return `i${(nums.length ? Math.max(...nums) : 0) + 1}`;
}

export function buildRepairedMenuKeyPlan(depts: DeptMenuSlice[]): Map<string, string> {
  const plan = new Map<string, string>();
  const active = depts.filter(isActiveDepartment);
  const inactive = sortDepartments(depts.filter(d => !isActiveDepartment(d)));

  const publicActive = sortDepartments(active.filter(d => d.clientVisible !== false));
  const internalActive = sortDepartments(active.filter(d => d.clientVisible === false));

  publicActive.forEach((d, i) => plan.set(String(d._id), String(i + 1)));
  internalActive.forEach((d, i) => plan.set(String(d._id), `i${i + 1}`));
  inactive.forEach((d, i) => plan.set(String(d._id), `o${i + 1}`));

  return plan;
}
