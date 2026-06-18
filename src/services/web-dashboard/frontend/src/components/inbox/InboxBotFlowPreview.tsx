import { Bot } from 'lucide-react'
import type { ReactNode } from 'react'

interface Props {
  welcomeText: string
  menuIntro: string
  menuFooter: string
  queueMessage: string
  departmentOptions?: string[]
}

export function InboxBotFlowPreview({
  welcomeText,
  menuIntro,
  menuFooter,
  queueMessage,
  departmentOptions = ['1 — Vendas', '2 — Suporte', '3 — Financeiro'],
}: Props) {
  const welcome = welcomeText.trim() || 'Olá! Bem-vindo ao atendimento.'
  const intro = menuIntro.trim() || 'Escolha uma opção:'
  const footer = menuFooter.trim()
  const queue = queueMessage.trim() || 'Você entrou na fila. Aguarde um momento.'

  return (
    <div className="rounded-xl border border-[var(--rz-border)] bg-[#0b141a] overflow-hidden shadow-lg">
      <div className="flex items-center gap-2 px-4 py-3 bg-[#1f2c34] border-b border-[#2a3942]">
        <div className="w-9 h-9 rounded-full bg-emerald-600/30 flex items-center justify-center">
          <Bot size={18} className="text-emerald-400" />
        </div>
        <div>
          <p className="text-sm font-medium text-[#e9edef]">RadarZap</p>
          <p className="text-[11px] text-emerald-400">Atendimento automático</p>
        </div>
      </div>

      <div className="p-4 space-y-3 min-h-[280px] bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNDAiIGhlaWdodD0iNDAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGRlZnM+PHBhdHRlcm4gaWQ9ImEiIHdpZHRoPSI0MCIgaGVpZ2h0PSI0MCIgcGF0dGVyblVuaXRzPSJ1c2VyU3BhY2VPblVzZSI+PHBhdGggZD0iTTAgNDBoNDBWNHoiIGZpbGw9IiMwYjE0MWEiLz48cGF0aCBkPSJNMCAwaDQwdjQwSDB6IiBmaWxsPSIjMGIxNDFhIi8+PC9wYXR0ZXJuPjwvZGVmcz48cmVjdCB3aWR0aD0iMTAwJSIgaGVpZ2h0PSIxMDAlIiBmaWxsPSJ1cmwoI2EpIi8+PC9zdmc+')]">
        <Bubble align="left">{welcome}</Bubble>
        <Bubble align="left">
          {intro}
          {'\n\n'}
          {departmentOptions.map((opt, i) => (
            <span key={opt}>
              {opt}
              {i < departmentOptions.length - 1 ? '\n' : ''}
            </span>
          ))}
          {footer ? `\n\n${footer}` : ''}
        </Bubble>
        <Bubble align="right">2</Bubble>
        <Bubble align="left">{queue}</Bubble>
        <p className="text-[10px] text-center text-[#8696a0] pt-2">
          Prévia visual — o fluxo real depende dos setores cadastrados.
        </p>
      </div>
    </div>
  )
}

function Bubble({ children, align }: { children: ReactNode; align: 'left' | 'right' }) {
  return (
    <div className={`flex ${align === 'right' ? 'justify-end' : 'justify-start'}`}>
      <div
        className={`max-w-[85%] rounded-lg px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap ${
          align === 'right'
            ? 'bg-[#005c4b] text-[#e9edef] rounded-tr-none'
            : 'bg-[#1f2c34] text-[#e9edef] rounded-tl-none'
        }`}
      >
        {children}
      </div>
    </div>
  )
}
