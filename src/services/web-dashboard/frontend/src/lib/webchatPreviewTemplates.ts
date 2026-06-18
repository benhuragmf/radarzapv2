export type WebChatAppearancePreset = {
  primaryColor: string
  position: 'left' | 'right'
  title: string
  subtitle: string
  greeting: string
  askName: boolean
  askEmail: boolean
  theme: 'light' | 'dark'
}

export type WebChatPreviewTemplate = {
  id: string
  name: string
  description: string
  /** Caminho da página HTML de preview (servida em /webchat/...) */
  path: string
  /** Classes Tailwind para miniatura no painel */
  thumbClass: string
  /** Tags curtas para o card */
  tags: string[]
  appearance: WebChatAppearancePreset
}

export const WEBCHAT_PREVIEW_TEMPLATES: WebChatPreviewTemplate[] = [
  {
    id: 'classic',
    name: 'Clássico',
    description: 'Página clara e corporativa — lojas, clínicas e serviços gerais.',
    path: '/webchat/preview-classic.html',
    thumbClass: 'bg-gradient-to-br from-slate-100 via-indigo-50 to-white',
    tags: ['Corporativo', 'Claro'],
    appearance: {
      primaryColor: '#2563eb',
      position: 'right',
      title: 'Fale conosco',
      subtitle: 'Respondemos em instantes',
      greeting: 'Olá! Como podemos ajudar?',
      askName: true,
      askEmail: true,
      theme: 'light',
    },
  },
  {
    id: 'tech',
    name: 'Tecnológico',
    description: 'Visual escuro com grid e terminal — SaaS, TI e suporte técnico.',
    path: '/webchat/preview-tech.html',
    thumbClass: 'bg-gradient-to-br from-cyan-950 via-slate-900 to-indigo-950',
    tags: ['Dark', 'Suporte TI'],
    appearance: {
      primaryColor: '#06b6d4',
      position: 'right',
      title: 'Suporte técnico',
      subtitle: 'Especialistas online · resposta ágil',
      greeting: 'Olá! Descreva o problema ou dúvida técnica que vamos ajudar.',
      askName: true,
      askEmail: true,
      theme: 'dark',
    },
  },
  {
    id: 'saas',
    name: 'SaaS',
    description: 'Gradiente roxo/rosa — startups e produtos digitais.',
    path: '/webchat/preview-saas.html',
    thumbClass: 'bg-gradient-to-br from-indigo-600 via-violet-600 to-pink-600',
    tags: ['Startup', 'Vibrante'],
    appearance: {
      primaryColor: '#7c3aed',
      position: 'right',
      title: 'Chat ao vivo',
      subtitle: 'Tire dúvidas sobre a plataforma',
      greeting: 'Oi! Em que podemos ajudar com sua conta ou plano?',
      askName: true,
      askEmail: false,
      theme: 'light',
    },
  },
  {
    id: 'minimal',
    name: 'Minimalista',
    description: 'Muito espaço em branco — portfólios e marcas enxutas.',
    path: '/webchat/preview-minimal.html',
    thumbClass: 'bg-white border border-zinc-200',
    tags: ['Clean', 'Simples'],
    appearance: {
      primaryColor: '#18181b',
      position: 'right',
      title: 'Conversa',
      subtitle: 'Estamos aqui',
      greeting: 'Olá — como posso ajudar?',
      askName: true,
      askEmail: false,
      theme: 'light',
    },
  },
]

export function webChatPreviewUrl(templatePath: string, publicKey: string): string {
  const q = new URLSearchParams({ key: publicKey })
  return `${templatePath}?${q.toString()}`
}

export function findWebChatPreviewTemplate(id: string): WebChatPreviewTemplate | undefined {
  return WEBCHAT_PREVIEW_TEMPLATES.find(t => t.id === id)
}
