/**
 * Evita spam de logs repetidos (ex.: Redis/Mongo offline em loop de reconexão).
 */
export class LogThrottle {
  private lastLoggedAt = new Map<string, number>();
  private suppressedSinceLog = new Map<string, number>();

  constructor(private readonly cooldownMs = 15_000) {}

  /**
   * @returns ok=true para emitir o log; suppressed = quantas ocorrências foram omitidas desde o último log
   */
  shouldLog(key: string): { ok: boolean; suppressed?: number } {
    const now = Date.now();
    const last = this.lastLoggedAt.get(key) ?? 0;

    if (now - last < this.cooldownMs) {
      this.suppressedSinceLog.set(key, (this.suppressedSinceLog.get(key) ?? 0) + 1);
      return { ok: false };
    }

    const suppressed = this.suppressedSinceLog.get(key) ?? 0;
    this.suppressedSinceLog.set(key, 0);
    this.lastLoggedAt.set(key, now);

    return suppressed > 0 ? { ok: true, suppressed } : { ok: true };
  }

  suffix(key: string): string {
    const n = this.suppressedSinceLog.get(key);
    if (!n) return '';
    return ` (+${n} omitidos)`;
  }
}
