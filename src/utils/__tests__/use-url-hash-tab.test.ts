// Espelho da lógica do hook (frontend) — evita import cross-package no Jest raiz.
function resolveUrlHashTab<T extends string>(
  hash: string,
  allowed: readonly T[],
  defaultTab: T,
  aliases?: Record<string, T>,
): T {
  const raw = hash.replace(/^#/, '').trim().toLowerCase()
  if (!raw) return defaultTab
  const aliased = aliases?.[raw]
  if (aliased) return aliased
  return (allowed as readonly string[]).includes(raw) ? (raw as T) : defaultTab
}

describe('resolveUrlHashTab', () => {
  const tabs = ['geral', 'empresa', 'coleta'] as const

  it('usa default sem hash', () => {
    expect(resolveUrlHashTab('', tabs, 'geral')).toBe('geral')
  })

  it('resolve hash válido', () => {
    expect(resolveUrlHashTab('#empresa', tabs, 'geral')).toBe('empresa')
  })

  it('resolve alias', () => {
    expect(
      resolveUrlHashTab('#qualidade', tabs, 'geral', { qualidade: 'coleta' }),
    ).toBe('coleta')
  })
})
