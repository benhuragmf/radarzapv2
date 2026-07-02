import { Link } from 'react-router-dom'
import { FlaskConical, Bug } from 'lucide-react'

export function AlphaPhaseBadge() {
  const label = 'Fase Alfa: reporte erros e acompanhe regras de testes.'

  return (
    <Link
      to="/fase-alfa"
      className="inline-flex h-8 items-center gap-1.5 border rounded-lg px-2.5 text-xs shrink-0 transition-colors text-amber-300 border-amber-500/40 bg-amber-500/10 hover:bg-amber-500/20"
      title={label}
      aria-label={label}
    >
      <FlaskConical size={13} className="shrink-0" />
      <span className="hidden xl:inline font-medium">Fase Alfa</span>
      <span className="xl:hidden font-medium">Alfa</span>
      <Bug size={12} className="shrink-0 opacity-80" />
    </Link>
  )
}
