import { Cap } from '@/auth/rbac/capabilities';
import {
  assertStatusAllowed,
  filterHeartbeatOperationalStatus,
  selectableStatusesForCapabilities,
} from '../inbox-agent-presence-api';

describe('inbox-agent-presence-api', () => {
  const attendantCaps = [Cap.INBOX_REPLY, Cap.INBOX_VIEW];
  const supervisorCaps = [...attendantCaps, Cap.INBOX_SUPERVISE];

  it('supervisor pode selecionar supervisor_online', () => {
    expect(selectableStatusesForCapabilities(supervisorCaps)).toContain('supervisor_online');
    expect(() => assertStatusAllowed('supervisor_online', supervisorCaps)).not.toThrow();
  });

  it('atendente comum não pode usar supervisor_online', () => {
    expect(selectableStatusesForCapabilities(attendantCaps)).not.toContain('supervisor_online');
    expect(() => assertStatusAllowed('supervisor_online', attendantCaps)).toThrow(
      'Este status é exclusivo para supervisores e administradores.',
    );
  });

  it('filterHeartbeatOperationalStatus bloqueia status proibido', () => {
    expect(
      filterHeartbeatOperationalStatus('supervisor_online', attendantCaps),
    ).toBeUndefined();
    expect(filterHeartbeatOperationalStatus('online', attendantCaps)).toBe('online');
  });
});
