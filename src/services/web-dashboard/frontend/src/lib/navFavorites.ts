import { useCallback, useEffect, useState } from 'react'
import type { AuthUser } from './auth'
import type { NavEntry, NavLink, NavMode } from './navConfig'

const STORAGE_KEY = 'rz-nav-favorites'
const MAX_FAVORITES = 8

type FavoritesStore = Record<string, string[]>

function storageKey(user: AuthUser, mode: NavMode): string {
  const org = user.organizationId ?? 'no-org'
  return `${org}:${user.userId}:${mode}`
}

function readStore(): FavoritesStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as FavoritesStore
    return parsed && typeof parsed === 'object' ? parsed : {}
  } catch {
    return {}
  }
}

function writeStore(store: FavoritesStore) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(store))
}

export function collectNavLinks(entries: NavEntry[]): NavLink[] {
  const out: NavLink[] = []
  for (const entry of entries) {
    if (entry.kind === 'link') out.push(entry)
    else if (entry.kind === 'group') out.push(...entry.children)
  }
  return out
}

export function findNavLinkById(entries: NavEntry[], id: string): NavLink | undefined {
  return collectNavLinks(entries).find(l => l.id === id)
}

export function quickAccessInsertIndex(entries: NavEntry[]): number | null {
  const firstSectionIdx = entries.findIndex(e => e.kind === 'section')
  if (firstSectionIdx === -1) return null

  for (let i = firstSectionIdx + 1; i < entries.length; i++) {
    if (entries[i].kind === 'section') return i
  }
  return entries.length
}

export function useNavFavorites(user: AuthUser, mode: NavMode) {
  const key = storageKey(user, mode)

  const [favoriteIds, setFavoriteIds] = useState<string[]>(() => readStore()[key] ?? [])

  useEffect(() => {
    setFavoriteIds(readStore()[key] ?? [])
  }, [key])

  const persist = useCallback(
    (ids: string[]) => {
      const store = readStore()
      if (ids.length) store[key] = ids
      else delete store[key]
      writeStore(store)
      setFavoriteIds(ids)
    },
    [key],
  )

  const isFavorite = useCallback((id: string) => favoriteIds.includes(id), [favoriteIds])

  const toggleFavorite = useCallback(
    (id: string) => {
      setFavoriteIds(prev => {
        const has = prev.includes(id)
        let next: string[]
        if (has) {
          next = prev.filter(x => x !== id)
        } else if (prev.length >= MAX_FAVORITES) {
          next = [...prev.slice(1), id]
        } else {
          next = [...prev, id]
        }
        const store = readStore()
        if (next.length) store[key] = next
        else delete store[key]
        writeStore(store)
        return next
      })
    },
    [key],
  )

  const pruneInvalid = useCallback(
    (validIds: Set<string>) => {
      setFavoriteIds(prev => {
        const next = prev.filter(id => validIds.has(id))
        if (next.length === prev.length) return prev
        persist(next)
        return next
      })
    },
    [persist],
  )

  return { favoriteIds, isFavorite, toggleFavorite, pruneInvalid, maxFavorites: MAX_FAVORITES }
}
