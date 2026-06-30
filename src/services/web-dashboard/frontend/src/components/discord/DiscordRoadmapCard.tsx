import { Card } from '../ui/Card'
import { Sparkles } from 'lucide-react'

const ROADMAP = [
  { label: 'Status presença do bot no widget embed', effort: 'Baixo' },
] as const

export function DiscordRoadmapCard() {
  return (
    <Card className="mb-4 text-xs">
      <div className="flex items-center gap-2 mb-2">
        <Sparkles size={14} className="text-brand-400" />
        <span className="font-medium text-[var(--rz-text-primary)]">Próximas melhorias</span>
      </div>
      <p className="text-[10px] text-emerald-500/90 mb-2">
        Prioridade média/baixa concluída em 2.17.0–2.17.4 (auditoria, dry-run, multi-regra).
      </p>
      <ul className="space-y-1 text-[var(--rz-text-muted)]">
        {ROADMAP.map(item => (
          <li key={item.label} className="flex justify-between gap-2">
            <span>{item.label}</span>
            <span className="text-[10px] shrink-0 opacity-70">{item.effort}</span>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-[10px] text-[var(--rz-text-muted)]">
        Detalhes em <code className="text-brand-400">docs/DISCORD-MONITORAMENTO.md</code>
      </p>
    </Card>
  )
}
