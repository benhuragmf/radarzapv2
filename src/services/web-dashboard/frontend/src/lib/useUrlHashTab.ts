import { useCallback, useEffect, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

export type UrlHashTabOptions<T extends string> = {
  /** Sinônimos no hash (ex.: qualidade → quality). */
  aliases?: Record<string, T>
  /** Aba padrão sem `#` na URL. Default true. */
  omitHashForDefault?: boolean
}

export function resolveUrlHashTab<T extends string>(
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

/** Sincroniza abas com `location.hash` — padrão `/rota#aba` (como Configurações). */
export function useUrlHashTab<T extends string>(
  allowed: readonly T[],
  defaultTab: T,
  options?: UrlHashTabOptions<T>,
): [T, (tab: T) => void] {
  const { pathname, hash } = useLocation()
  const navigate = useNavigate()
  const omitDefault = options?.omitHashForDefault !== false

  const readTab = useCallback(
    () => resolveUrlHashTab(hash, allowed, defaultTab, options?.aliases),
    [hash, allowed, defaultTab, options?.aliases],
  )

  const [tab, setTabState] = useState<T>(readTab)

  useEffect(() => {
    const next = readTab()
    setTabState(prev => (prev === next ? prev : next))
  }, [readTab])

  const setTab = useCallback(
    (next: T) => {
      setTabState(next)
      const nextHash =
        omitDefault && next === defaultTab ? '' : `#${next}`
      const current = hash || ''
      if (current === nextHash) return
      navigate(
        { pathname, hash: nextHash || undefined },
        { replace: true },
      )
    },
    [navigate, pathname, hash, defaultTab, omitDefault],
  )

  return [tab, setTab]
}

/** Redireciona `?legacyParam=` → `#hash` (compatibilidade). */
export function useLegacyQueryTabRedirect(
  queryValue: string | null,
  isValid: (value: string) => boolean,
  hashId: string,
): void {
  const { pathname, hash, search } = useLocation()
  const navigate = useNavigate()

  useEffect(() => {
    if (!queryValue || !isValid(queryValue) || hash) return
    const params = new URLSearchParams(search)
    params.delete('tab')
    const nextSearch = params.toString()
    navigate(
      {
        pathname,
        hash: `#${hashId || queryValue}`,
        search: nextSearch ? `?${nextSearch}` : '',
      },
      { replace: true },
    )
  }, [queryValue, hash, pathname, search, navigate, isValid, hashId])
}
