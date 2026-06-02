import { createContext, useContext } from 'react'
import type { NavMode } from './navConfig'

export const NavModeContext = createContext<NavMode>('platform')

export function useNavMode() {
  return useContext(NavModeContext)
}
