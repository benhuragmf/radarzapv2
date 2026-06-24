import {
  departmentMenuKeysNeedRepair,
  buildRepairedMenuKeyPlan,
  nextInternalMenuKeyFrom,
  nextPublicMenuKeyFrom,
} from '@/services/inbox/inbox-department-menu-key.util';

describe('inbox-department-menu-key.util', () => {
  const oid = (n: number) => ({ _id: `id${n}` }) as { _id: string };

  describe('nextPublicMenuKeyFrom', () => {
    it('ignora setores internos com menu numérico errado', () => {
      const key = nextPublicMenuKeyFrom([
        { ...oid(1), menuKey: '1', clientVisible: true, isActive: true },
        { ...oid(2), menuKey: '2', clientVisible: true, isActive: true },
        { ...oid(3), menuKey: '3', clientVisible: true, isActive: true },
        { ...oid(4), menuKey: '4', clientVisible: true, isActive: true },
        { ...oid(5), menuKey: '5', clientVisible: false, isActive: true },
      ]);
      expect(key).toBe('5');
    });

    it('ignora setores inativos que ainda têm menu numérico', () => {
      const key = nextPublicMenuKeyFrom([
        { ...oid(1), menuKey: '1', clientVisible: true, isActive: true },
        { ...oid(2), menuKey: '2', clientVisible: true, isActive: true },
        { ...oid(3), menuKey: '3', clientVisible: true, isActive: true },
        { ...oid(4), menuKey: '4', clientVisible: true, isActive: true },
        { ...oid(5), menuKey: '5', clientVisible: true, isActive: false },
      ]);
      expect(key).toBe('5');
    });
  });

  describe('departmentMenuKeysNeedRepair', () => {
    it('detecta inativo com menu numérico público', () => {
      expect(
        departmentMenuKeysNeedRepair([
          { ...oid(1), menuKey: '1', clientVisible: true, isActive: true, sortOrder: 1 },
          { ...oid(2), menuKey: '5', clientVisible: true, isActive: false, sortOrder: 2 },
          { ...oid(3), menuKey: '6', clientVisible: true, isActive: true, sortOrder: 3 },
        ]),
      ).toBe(true);
    });

    it('recompacta ativos e libera inativos para o1', () => {
      const depts = [
        { ...oid(1), menuKey: '1', clientVisible: true, isActive: true, sortOrder: 1 },
        { ...oid(2), menuKey: '2', clientVisible: true, isActive: true, sortOrder: 2 },
        { ...oid(3), menuKey: '5', clientVisible: true, isActive: false, sortOrder: 3 },
        { ...oid(4), menuKey: 'i1', clientVisible: false, isActive: true, sortOrder: 4 },
        { ...oid(5), menuKey: '6', clientVisible: true, isActive: true, sortOrder: 5 },
      ];
      const plan = buildRepairedMenuKeyPlan(depts);
      expect(plan.get('id1')).toBe('1');
      expect(plan.get('id2')).toBe('2');
      expect(plan.get('id3')).toBe('o1');
      expect(plan.get('id4')).toBe('i1');
      expect(plan.get('id5')).toBe('3');
    });
  });

  describe('nextInternalMenuKeyFrom', () => {
    it('só conta internos ativos', () => {
      expect(
        nextInternalMenuKeyFrom([
          { ...oid(1), menuKey: '1', clientVisible: true, isActive: true },
          { ...oid(2), menuKey: 'i1', clientVisible: false, isActive: true },
        ]),
      ).toBe('i2');
    });
  });
});
