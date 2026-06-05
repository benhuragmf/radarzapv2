import { Card } from '../ui/Card'
import { Construction } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  title: string
  description: string
  phase?: string
  children?: ReactNode
}

/** Páginas da área Plataforma (campanhas, modelos, relatórios tenant) */
export function PlatformPage({ title, description, phase = 'MVP', children }: Props) {
  if (children) {
    return (
      <div className="space-y-5 max-w-4xl">
        <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
        {children}
      </div>
    )
  }

  return (
    <div className="space-y-5 max-w-2xl">
      <Card className="flex items-start gap-4 border-gray-700/80 bg-gray-900/50">
        <Construction size={28} className="text-brand-500 shrink-0 mt-0.5" />
        <div>
          <h2 className="text-lg font-semibold text-white">{title}</h2>
          <p className="text-sm text-gray-400 mt-2 leading-relaxed">{description}</p>
          <p className="text-xs text-gray-500 mt-3">
            Fase planejada: <span className="text-brand-400">{phase}</span>
            {' · '}
            Ver <code className="text-gray-400">docs/MENUS-SISTEMA.md</code>
          </p>
        </div>
      </Card>
    </div>
  )
}
