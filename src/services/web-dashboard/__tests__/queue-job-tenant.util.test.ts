import {
  extractJobClientId,
  jobBelongsToClient,
  sanitizeFailedJob,
} from '../queue-job-tenant.util';

describe('queue-job-tenant.util (AH-R02)', () => {
  it('extractJobClientId lê clientId do payload', () => {
    expect(extractJobClientId({ clientId: 'abc123' })).toBe('abc123');
    expect(extractJobClientId({ foo: 1 })).toBeUndefined();
    expect(extractJobClientId(null)).toBeUndefined();
  });

  it('jobBelongsToClient compara tenant', () => {
    expect(jobBelongsToClient({ clientId: 't1' }, 't1')).toBe(true);
    expect(jobBelongsToClient({ clientId: 't1' }, 't2')).toBe(false);
    expect(jobBelongsToClient({}, 't1')).toBe(false);
  });

  it('sanitizeFailedJob não inclui data bruto', () => {
    const row = sanitizeFailedJob(
      {
        id: '99',
        name: 'send-message',
        failedReason: 'timeout',
        timestamp: 1,
        data: { clientId: 't1', phone: '5511999999999', secret: 'x' },
      },
      'whatsapp-sending',
      { includeClientId: true },
    );
    expect(row).toMatchObject({
      id: '99',
      queue: 'whatsapp-sending',
      clientId: 't1',
    });
    expect(row as Record<string, unknown>).not.toHaveProperty('data');
    expect(row as Record<string, unknown>).not.toHaveProperty('phone');
  });

  it('sanitizeFailedJob omite clientId para tenant', () => {
    const row = sanitizeFailedJob(
      { id: 1, name: 'x', data: { clientId: 't1' } },
      'q',
      { includeClientId: false },
    );
    expect(row.clientId).toBeUndefined();
  });
});
