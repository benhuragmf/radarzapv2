import { config } from '@/config/environment';
import { isDegradedBootAllowed } from '../infra-boot.util';

describe('infra-boot.util', () => {
  const origEnv = config.NODE_ENV;
  const origDegraded = config.INFRA.DEGRADED_BOOT;

  afterEach(() => {
    config.NODE_ENV = origEnv;
    config.INFRA.DEGRADED_BOOT = origDegraded;
  });

  it('permite degradado em development por padrão', () => {
    config.NODE_ENV = 'development';
    config.INFRA.DEGRADED_BOOT = false;
    expect(isDegradedBootAllowed()).toBe(true);
  });

  it('bloqueia degradado em production sem flag', () => {
    config.NODE_ENV = 'production';
    config.INFRA.DEGRADED_BOOT = false;
    expect(isDegradedBootAllowed()).toBe(false);
  });

  it('INFRA_DEGRADED_BOOT=true habilita em qualquer NODE_ENV (validado no validateConfig prod)', () => {
    config.NODE_ENV = 'production';
    config.INFRA.DEGRADED_BOOT = true;
    expect(isDegradedBootAllowed()).toBe(true);
  });
});
