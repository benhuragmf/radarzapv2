import { Bot, MessageCircle, ShieldCheck } from 'lucide-react'
import { AuthBrand } from './AuthBrand'

const HIGHLIGHTS = [
  {
    icon: MessageCircle,
    title: 'WhatsApp + WebChat',
    text: 'Inbox unificado, filas e supervisão em tempo real.',
  },
  {
    icon: Bot,
    title: 'IA integrada',
    text: 'Triagem, base de conhecimento e encaminhamento inteligente.',
  },
  {
    icon: ShieldCheck,
    title: 'Seguro e brasileiro',
    text: 'LGPD nativo, equipe com papéis e auditoria operacional.',
  },
] as const

export function AuthHero() {
  return (
    <aside className="rz-auth-hero">
      <div className="rz-auth-hero-inner">
        <AuthBrand subtitle="Plataforma de atendimento" />

        <div className="rz-auth-hero-copy">
          <h1 className="rz-auth-hero-title">
            Atendimento omnichannel
            <span className="rz-auth-hero-accent"> com IA</span>
          </h1>
          <p className="rz-auth-hero-lead">
            Centralize WhatsApp, chat do site, tickets e equipe em um painel feito para escalar sem perder o controle.
          </p>
        </div>

        <ul className="rz-auth-highlights">
          {HIGHLIGHTS.map(item => (
            <li key={item.title} className="rz-auth-highlight">
              <span className="rz-auth-highlight-icon">
                <item.icon size={18} strokeWidth={2} aria-hidden />
              </span>
              <span>
                <strong>{item.title}</strong>
                <span>{item.text}</span>
              </span>
            </li>
          ))}
        </ul>
      </div>
    </aside>
  )
}
