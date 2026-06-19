export type WebChatAppearancePreset = {
  primaryColor: string
  position: 'left' | 'right'
  title: string
  subtitle: string
  greeting: string
  askName: boolean
  askPhone: boolean
  askContactReason: boolean
  contactReasonOptions: string[]
  askEmail: boolean
  theme: 'light' | 'dark'
}

export const DEFAULT_CONTACT_REASON_OPTIONS = [
  'Quero saber preços',
  'Quero contratar',
  'Preciso de suporte',
  'Dúvida sobre planos',
  'Outro',
]

export type WebChatPreviewTemplate = {
  id: string
  name: string
  description: string
  bestFor: string
  path: string
  thumbClass: string
  accentColor: string
  tags: string[]
  premium?: boolean
  /** Destaques exibidos nos cards premium */
  highlights?: string[]
  appearance: WebChatAppearancePreset
}

export const WEBCHAT_PREVIEW_TEMPLATES: WebChatPreviewTemplate[] = [
  {
    id: 'classic',
    name: 'Clássico',
    description: 'Visual limpo e confiável para lojas, clínicas e serviços locais.',
    bestFor: 'E-commerce, saúde e atendimento geral',
    path: '/webchat/preview-classic.html',
    thumbClass: 'bg-gradient-to-br from-slate-50 via-blue-50/80 to-white',
    accentColor: '#3b82f6',
    tags: ['Corporativo', 'Claro'],
    appearance: {
      primaryColor: '#2563eb',
      position: 'right',
      title: 'Fale conosco',
      subtitle: 'Respondemos em instantes',
      greeting: 'Olá! Como podemos ajudar você hoje?',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: false,
      theme: 'light',
    },
  },
  {
    id: 'tech',
    name: 'Tecnológico',
    description: 'Tema escuro com grid e terminal — transmite suporte técnico e SaaS.',
    bestFor: 'TI, software, infraestrutura e N1/N2',
    path: '/webchat/preview-tech.html',
    thumbClass: 'bg-gradient-to-br from-slate-950 via-cyan-950/90 to-indigo-950',
    accentColor: '#22d3ee',
    tags: ['Dark', 'Suporte TI'],
    appearance: {
      primaryColor: '#06b6d4',
      position: 'right',
      title: 'Suporte técnico',
      subtitle: 'Especialistas online · resposta ágil',
      greeting: 'Olá! Descreva o problema ou dúvida técnica que vamos ajudar.',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: false,
      theme: 'dark',
    },
  },
  {
    id: 'saas',
    name: 'SaaS',
    description: 'Gradiente vibrante roxo/rosa para startups e produtos digitais.',
    bestFor: 'Plataformas, apps e assinaturas',
    path: '/webchat/preview-saas.html',
    thumbClass: 'bg-gradient-to-br from-violet-600 via-purple-600 to-fuchsia-600',
    accentColor: '#e879f9',
    tags: ['Startup', 'Vibrante'],
    appearance: {
      primaryColor: '#7c3aed',
      position: 'right',
      title: 'Chat ao vivo',
      subtitle: 'Tire dúvidas sobre a plataforma',
      greeting: 'Oi! Em que podemos ajudar com sua conta ou plano?',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: false,
      theme: 'light',
    },
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Tipografia elegante e muito espaço em branco — discreto e clean.',
    bestFor: 'Portfólios, consultorias e marcas enxutas',
    path: '/webchat/preview-minimal.html',
    thumbClass: 'bg-zinc-50',
    accentColor: '#71717a',
    tags: ['Clean', 'Simples'],
    appearance: {
      primaryColor: '#18181b',
      position: 'right',
      title: 'Conversa',
      subtitle: 'Estamos aqui',
      greeting: 'Olá — como posso ajudar?',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: false,
      theme: 'light',
    },
  },
  {
    id: 'luxe',
    name: 'Luxe',
    description:
      'Landing completa estilo concierge — champagne, serifas e detalhes dourados para marcas de altíssimo padrão.',
    bestFor: 'Hotéis 5★, joalherias, imóveis de luxo e lifestyle',
    path: '/webchat/preview-luxe.html',
    thumbClass: 'bg-[#faf6f0]',
    accentColor: '#b8956a',
    tags: ['Concierge', 'Editorial'],
    premium: true,
    highlights: [
      'Landing multi-seção com hero editorial e depoimentos',
      'Tipografia Cormorant + paleta champagne/dourado',
      'Widget “Concierge” com saudação personalizada',
      'Grid de serviços, CTA e bloco de status ao vivo',
    ],
    appearance: {
      primaryColor: '#9a7b4f',
      position: 'right',
      title: 'Concierge',
      subtitle: 'Atendimento personalizado',
      greeting: 'Bem-vindo. Como podemos tornar sua experiência ainda melhor hoje?',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: true,
      theme: 'light',
    },
  },
  {
    id: 'obsidian',
    name: 'Obsidian',
    description:
      'Experiência executiva dark com ouro — autoridade, confidencialidade e métricas para B2B premium.',
    bestFor: 'Advocacia, private banking, consultoria e M&A',
    path: '/webchat/preview-obsidian.html',
    thumbClass: 'bg-[#070b14]',
    accentColor: '#d4a853',
    tags: ['Executivo', 'Confidencial'],
    premium: true,
    highlights: [
      'Visual dark com grain, glow dourado e glass panels',
      'Métricas, áreas de atuação e selos de compliance',
      'Widget tema escuro “Assessoria exclusiva”',
      'Tipografia Libre Baskerville — tom institucional',
    ],
    appearance: {
      primaryColor: '#c9a962',
      position: 'right',
      title: 'Assessoria exclusiva',
      subtitle: 'Confidencial · resposta prioritária',
      greeting:
        'Olá. Nossa equipe está disponível para atendê-lo com a discrição que seu caso exige.',
      askName: true,
      askPhone: true,
      askContactReason: true,
      contactReasonOptions: [...DEFAULT_CONTACT_REASON_OPTIONS],
      askEmail: true,
      theme: 'dark',
    },
  },
]

export const WEBCHAT_STANDARD_TEMPLATES = WEBCHAT_PREVIEW_TEMPLATES.filter(t => !t.premium)
export const WEBCHAT_PREMIUM_TEMPLATES = WEBCHAT_PREVIEW_TEMPLATES.filter(t => t.premium)

export function webChatPreviewUrl(
  templatePath: string,
  publicKey: string,
  cacheBust?: number,
): string {
  const q = new URLSearchParams({ key: publicKey })
  if (cacheBust) q.set('_', String(cacheBust))
  return `${templatePath}?${q.toString()}`
}

export function findWebChatPreviewTemplate(id: string): WebChatPreviewTemplate | undefined {
  return WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === id)
}
