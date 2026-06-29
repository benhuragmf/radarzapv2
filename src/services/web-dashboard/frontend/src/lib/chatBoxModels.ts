import type { WebChatAppearancePreset } from './webchatPreviewTemplates'

export type ChatBoxTier = 'free' | 'premium'
export type ChatBoxFormat =
  | 'compact'
  | 'mini'
  | 'mobile-first'
  | 'floating'
  | 'corporate'
  | 'ai'
  | 'workplace'

export type ChatBoxModelStatus = 'active' | 'planned'

export interface ChatBoxDimensions {
  previewWidth: number
  previewHeight: number
  widgetWidth: number
  widgetHeight: number
  headerHeight: number
  inputHeight: number
  borderRadius: number
}

export interface ChatBoxThemeTokens {
  primary: string
  primaryHover?: string
  headerBg: string
  accent?: string
  background: string
  surface: string
  border: string
  text: string
  muted: string
  isDark?: boolean
}

export interface ChatBoxPreviewData {
  headerTitle: string
  headerSubtitle?: string
  headerStatus?: string
  messages?: Array<{ role: 'user' | 'bot'; text: string }>
  introLines?: string[]
  primaryCta?: string
  chips?: string[]
  quickActions?: string[]
  actionRows?: string[]
  faqItems?: string[]
  faqTitle?: string
  infoLine?: string
  searchPlaceholder?: string
  tiles?: string[]
  suggestionsTitle?: string
  suggestionsSubtitle?: string
  suggestions?: string[]
  footer?: string
  inputPlaceholder: string
  showBottomNav?: boolean
  showFloatingBubble?: boolean
  showAttachment?: boolean
  variant: string
}

export interface ChatBoxModel {
  id: string
  name: string
  tier: ChatBoxTier
  category: 'chat_box'
  format: ChatBoxFormat
  status: ChatBoxModelStatus
  description: string
  tags: string[]
  bestFor?: string
  dimensions: ChatBoxDimensions
  theme: ChatBoxThemeTokens
  preview: ChatBoxPreviewData
  features: string[]
  isPremium: boolean
  isNew?: boolean
  appearance: WebChatAppearancePreset
}

export const CHATBOX_FORMAT_TOKENS = {
  compact: {
    widgetWidth: 360,
    widgetHeight: 560,
    headerHeight: 64,
    inputHeight: 56,
    padding: 16,
    borderRadius: 18,
  },
  mini: {
    widgetWidth: 320,
    widgetHeight: 460,
    headerHeight: 56,
    inputHeight: 52,
    padding: 14,
    borderRadius: 20,
  },
  corporate: {
    widgetWidth: 380,
    widgetHeight: 620,
    headerHeight: 72,
    inputHeight: 58,
    padding: 18,
    borderRadius: 22,
  },
  floating: {
    bubbleSize: 64,
    widgetWidth: 340,
    widgetHeight: 520,
    headerHeight: 58,
    inputHeight: 54,
    borderRadius: 24,
  },
} as const

/** Reservados para coleção futura — não exibir como cards ativos. */
export const CHATBOX_RESERVED_MODEL_IDS = [
  'office-chat',
  'helpdesk-mini',
  'radarzap-compact',
  'radarzap-mini',
] as const

export const CHATBOX_RESERVED_MODELS: Array<{ id: string; name: string; status: 'planned' }> = [
  { id: 'office-chat', name: 'Office Chat', status: 'planned' },
  { id: 'helpdesk-mini', name: 'Helpdesk Mini', status: 'planned' },
  { id: 'radarzap-compact', name: 'Radar Chat Compact', status: 'planned' },
  { id: 'radarzap-mini', name: 'Radar Chat Mini', status: 'planned' },
]

const baseAppearance = (
  id: string,
  partial: Partial<WebChatAppearancePreset> & Pick<WebChatAppearancePreset, 'primaryColor' | 'title' | 'subtitle' | 'greeting'>,
): WebChatAppearancePreset => ({
  primaryColor: partial.primaryColor,
  position: 'right',
  title: partial.title,
  subtitle: partial.subtitle,
  greeting: partial.greeting,
  askName: true,
  askPhone: true,
  askContactReason: true,
  contactReasonOptions: partial.contactReasonOptions ?? [
    'Quero saber preços',
    'Quero contratar',
    'Preciso de suporte',
    'Dúvida sobre planos',
    'Outro',
  ],
  askEmail: false,
  theme: partial.theme ?? 'light',
  chatLayout: partial.chatLayout ?? 'classic',
})

export const CHATBOX_MODELS: ChatBoxModel[] = [
  {
    id: 'blue-compact',
    name: 'Blue Compact',
    tier: 'free',
    category: 'chat_box',
    format: 'compact',
    status: 'active',
    description:
      'Widget compacto e vibrante com CTAs de alto impacto para engajar e converter.',
    tags: ['Free', 'CTA', 'Azul', 'Rápido'],
    bestFor: 'Sites com foco em conversão e engajamento rápido',
    dimensions: {
      previewWidth: 250,
      previewHeight: 360,
      widgetWidth: 360,
      widgetHeight: 540,
      headerHeight: 64,
      inputHeight: 56,
      borderRadius: 18,
    },
    theme: {
      primary: '#2563EB',
      primaryHover: '#1D4ED8',
      headerBg: 'linear-gradient(135deg, #2563EB, #1E40AF)',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      border: '#DBEAFE',
      text: '#0F172A',
      muted: '#64748B',
    },
    preview: {
      variant: 'blue-compact',
      headerTitle: 'Radar Chat',
      headerStatus: 'Online agora',
      introLines: ['Como podemos ajudar?', 'Respostas rápidas para você.'],
      primaryCta: 'Nova conversa',
      chips: ['Perguntas', 'Status', 'Falar com time'],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    features: ['CTA principal', 'Chips rápidos', 'Header degradê azul'],
    isPremium: false,
    appearance: baseAppearance('blue-compact', {
      primaryColor: '#2563EB',
      title: 'Radar Chat',
      subtitle: 'Online agora',
      greeting: 'Como podemos ajudar? Respostas rápidas para você.',
      theme: 'light',
    }),
  },
  {
    id: 'small-chat',
    name: 'Small Chat',
    tier: 'free',
    category: 'chat_box',
    format: 'mini',
    status: 'active',
    description: 'Chat minimalista e leve para conversas rápidas, com o essencial à vista.',
    tags: ['Free', 'Minimalista', 'Leve', 'Simples'],
    bestFor: 'Sites que precisam de widget discreto',
    dimensions: {
      previewWidth: 230,
      previewHeight: 320,
      widgetWidth: 320,
      widgetHeight: 460,
      headerHeight: 56,
      inputHeight: 52,
      borderRadius: 20,
    },
    theme: {
      primary: '#14B8A6',
      headerBg: '#CCFBF1',
      accent: '#0F766E',
      background: '#FFFFFF',
      surface: '#F0FDFA',
      border: '#99F6E4',
      text: '#0F172A',
      muted: '#64748B',
    },
    preview: {
      variant: 'small-chat',
      headerTitle: 'Radar Chat',
      headerStatus: 'Online agora',
      introLines: ['Olá! 👋', 'Como posso ajudar você hoje?'],
      quickActions: ['Tenho uma dúvida', 'Quero saber mais', 'Falar com um atendente'],
      inputPlaceholder: 'Digite sua mensagem...',
    },
    features: ['Ultra leve', 'Três opções diretas', 'Visual teal suave'],
    isPremium: false,
    appearance: baseAppearance('small-chat', {
      primaryColor: '#14B8A6',
      title: 'Radar Chat',
      subtitle: 'Online agora',
      greeting: 'Olá! Como posso ajudar você hoje?',
      theme: 'light',
    }),
  },
  {
    id: 'clean-support',
    name: 'Clean Support',
    tier: 'free',
    category: 'chat_box',
    format: 'compact',
    status: 'active',
    description:
      'Design limpo e elegante para suporte direto, com foco em clareza e experiência premium.',
    tags: ['Free', 'Clean', 'FAQ', 'Claro'],
    bestFor: 'Suporte com FAQ visível',
    dimensions: {
      previewWidth: 250,
      previewHeight: 360,
      widgetWidth: 360,
      widgetHeight: 540,
      headerHeight: 60,
      inputHeight: 56,
      borderRadius: 20,
    },
    theme: {
      primary: '#7C3AED',
      headerBg: '#EDE9FE',
      background: '#FFFFFF',
      surface: '#FAFAFA',
      border: '#DDD6FE',
      text: '#111827',
      muted: '#6B7280',
    },
    preview: {
      variant: 'clean-support',
      headerTitle: 'Clean Support',
      headerSubtitle: 'Suporte rápido e humano',
      messages: [
        { role: 'user', text: 'Olá! Preciso de ajuda para acessar minha conta.' },
        {
          role: 'bot',
          text: 'Olá! Vamos te ajudar com isso. Pode me dizer qual problema você está enfrentando?',
        },
      ],
      faqTitle: 'Perguntas frequentes',
      faqItems: [
        'Como redefinir minha senha',
        'Problemas para fazer login',
        'Atualizar dados da conta',
      ],
      infoLine: 'Tempo médio de resposta: 2 min',
      primaryCta: 'Iniciar conversa',
      inputPlaceholder: 'Digite sua mensagem...',
    },
    features: ['FAQ integrado', 'Conversa exemplo', 'Visual lilás clean'],
    isPremium: false,
    appearance: baseAppearance('clean-support', {
      primaryColor: '#7C3AED',
      title: 'Clean Support',
      subtitle: 'Suporte rápido e humano',
      greeting: 'Olá! Vamos te ajudar. Como podemos ajudar hoje?',
      theme: 'light',
    }),
  },
  {
    id: 'support-lite',
    name: 'Support Lite',
    tier: 'free',
    category: 'chat_box',
    format: 'compact',
    status: 'active',
    description: 'Widget enxuto e eficiente com foco em agilidade e simplicidade.',
    tags: ['Free', 'Leve', 'Suporte', 'Rápido'],
    bestFor: 'Suporte simples em sites pequenos',
    dimensions: {
      previewWidth: 240,
      previewHeight: 340,
      widgetWidth: 340,
      widgetHeight: 500,
      headerHeight: 54,
      inputHeight: 52,
      borderRadius: 18,
    },
    theme: {
      primary: '#6D28D9',
      accent: '#8B5CF6',
      headerBg: '#F5F3FF',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      border: '#E5E7EB',
      text: '#111827',
      muted: '#6B7280',
    },
    preview: {
      variant: 'support-lite',
      headerTitle: 'Support Lite',
      introLines: ['Olá! Como podemos ajudar?', 'Respostas rápidas e sem complicação.'],
      searchPlaceholder: 'Buscar ajuda rápida...',
      quickActions: ['Abrir chamado', 'Ver status', 'Base de conhecimento'],
      infoLine: 'Médio tempo de resposta: 2min',
      inputPlaceholder: 'Digite sua mensagem...',
    },
    features: ['Busca rápida', 'Ações enxutas', 'Roxo discreto'],
    isPremium: false,
    appearance: baseAppearance('support-lite', {
      primaryColor: '#6D28D9',
      title: 'Support Lite',
      subtitle: 'Respostas rápidas e sem complicação',
      greeting: 'Olá! Como podemos ajudar?',
      theme: 'light',
    }),
  },
  {
    id: 'pocket-chat',
    name: 'Pocket Chat',
    tier: 'free',
    category: 'chat_box',
    format: 'mobile-first',
    status: 'active',
    description: 'Ultra-compacto e mobile-first, perfeito para qualquer dispositivo.',
    tags: ['Free', 'Mobile', 'Compacto', 'Dark'],
    bestFor: 'Mobile-first e telas estreitas',
    dimensions: {
      previewWidth: 210,
      previewHeight: 370,
      widgetWidth: 300,
      widgetHeight: 560,
      headerHeight: 52,
      inputHeight: 48,
      borderRadius: 18,
    },
    theme: {
      primary: '#2563EB',
      headerBg: '#0F172A',
      background: '#020617',
      surface: '#0F172A',
      border: '#1E293B',
      text: '#E5E7EB',
      muted: '#94A3B8',
      isDark: true,
    },
    preview: {
      variant: 'pocket-chat',
      headerTitle: 'Chat',
      headerStatus: 'Online',
      introLines: ['Oi! Precisa de ajuda?', 'Respondemos rapidinho.'],
      chips: ['Dúvida', 'Suporte', 'Preços'],
      inputPlaceholder: 'Fale algo...',
      showBottomNav: true,
    },
    features: ['Nav inferior', 'Dark mobile', 'Chips compactos'],
    isPremium: false,
    appearance: baseAppearance('pocket-chat', {
      primaryColor: '#2563EB',
      title: 'Chat',
      subtitle: 'Online',
      greeting: 'Oi! Precisa de ajuda? Respondemos rapidinho.',
      theme: 'dark',
    }),
  },
  {
    id: 'compact-pro',
    name: 'Compact Pro',
    tier: 'premium',
    category: 'chat_box',
    format: 'corporate',
    status: 'active',
    description: 'Widget corporativo premium com ações estruturadas e foco em eficiência.',
    tags: ['Premium', 'Corporativo', 'Conversão', 'Seguro'],
    bestFor: 'B2B e suporte corporativo estruturado',
    dimensions: {
      previewWidth: 270,
      previewHeight: 390,
      widgetWidth: 380,
      widgetHeight: 620,
      headerHeight: 74,
      inputHeight: 58,
      borderRadius: 22,
    },
    theme: {
      primary: '#1D4ED8',
      headerBg: 'linear-gradient(135deg, #2563EB, #1E3A8A)',
      accent: '#60A5FA',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      border: '#BFDBFE',
      text: '#0F172A',
      muted: '#64748B',
    },
    preview: {
      variant: 'compact-pro',
      headerTitle: 'Compact Pro',
      headerSubtitle: 'Suporte corporativo inteligente',
      headerStatus: 'Online',
      messages: [
        { role: 'user', text: 'Olá! Preciso de ajuda para integrar o Radar Chat ao nosso CRM.' },
        {
          role: 'bot',
          text: 'Olá! 👋 Vamos te ajudar com isso. Escolha uma opção abaixo para continuarmos.',
        },
      ],
      actionRows: [
        'Falar com um especialista',
        'Soluções e serviços',
        'Abrir um ticket',
        'Perguntas frequentes (FAQ)',
      ],
      footer: 'Ambiente seguro e confidencial',
      inputPlaceholder: 'Digite sua mensagem...',
      showAttachment: true,
    },
    features: ['Ações estruturadas', 'Footer segurança', 'Anexo no input'],
    isPremium: true,
    appearance: baseAppearance('compact-pro', {
      primaryColor: '#1D4ED8',
      title: 'Compact Pro',
      subtitle: 'Suporte corporativo inteligente',
      greeting: 'Olá! Escolha uma opção abaixo para continuarmos.',
      theme: 'light',
    }),
  },
  {
    id: 'smart-mini',
    name: 'Smart Mini',
    tier: 'premium',
    category: 'chat_box',
    format: 'ai',
    status: 'active',
    description: 'Assistente inteligente com sugestões contextuais e respostas instantâneas.',
    tags: ['Premium', 'IA', 'Sugestões', 'Inteligente'],
    bestFor: 'Experiência com IA e sugestões contextuais',
    dimensions: {
      previewWidth: 270,
      previewHeight: 390,
      widgetWidth: 370,
      widgetHeight: 600,
      headerHeight: 70,
      inputHeight: 56,
      borderRadius: 22,
    },
    theme: {
      primary: '#7C3AED',
      headerBg: '#0F172A',
      accent: '#A78BFA',
      background: '#FFFFFF',
      surface: '#F5F3FF',
      border: '#DDD6FE',
      text: '#0F172A',
      muted: '#6B7280',
    },
    preview: {
      variant: 'smart-mini',
      headerTitle: 'Smart Mini',
      headerSubtitle: 'Seu assistente inteligente',
      headerStatus: 'IA ativa',
      messages: [
        { role: 'user', text: 'Como posso integrar o Radar Chat com nossa plataforma?' },
        {
          role: 'bot',
          text: 'Você pode integrar o Radar Chat via API REST. Nossa documentação inclui exemplos para facilitar.',
        },
      ],
      suggestionsTitle: 'Sugestões para você',
      suggestionsSubtitle: 'Com base na sua pergunta, selecione uma opção para continuar.',
      suggestions: ['Resumir conteúdo', 'Integrar via API', 'Quais são os planos?'],
      footer: 'IA segura e confiável • Respostas em segundos',
      inputPlaceholder: 'Digite sua mensagem...',
    },
    features: ['Card de sugestões IA', 'Header dark', 'Footer IA'],
    isPremium: true,
    appearance: baseAppearance('smart-mini', {
      primaryColor: '#7C3AED',
      title: 'Smart Mini',
      subtitle: 'Seu assistente inteligente',
      greeting: 'Como posso ajudar? Selecione uma sugestão ou digite sua mensagem.',
      theme: 'light',
      chatLayout: 'copilot',
    }),
  },
  {
    id: 'workplace-mini',
    name: 'Workplace Mini',
    tier: 'premium',
    category: 'chat_box',
    format: 'workplace',
    status: 'active',
    description: 'Ideal para ambientes internos com atalhos para políticas e recursos da equipe.',
    tags: ['Premium', 'Interno', 'RH', 'Equipe'],
    bestFor: 'Portal do colaborador e suporte interno',
    dimensions: {
      previewWidth: 270,
      previewHeight: 390,
      widgetWidth: 380,
      widgetHeight: 620,
      headerHeight: 72,
      inputHeight: 56,
      borderRadius: 22,
    },
    theme: {
      primary: '#0F766E',
      headerBg: 'linear-gradient(135deg, #0F766E, #0E7490)',
      accent: '#14B8A6',
      background: '#FFFFFF',
      surface: '#F0FDFA',
      border: '#99F6E4',
      text: '#0F172A',
      muted: '#64748B',
    },
    preview: {
      variant: 'workplace-mini',
      headerTitle: 'Workplace Mini',
      headerSubtitle: 'Suporte interno da sua equipe',
      messages: [
        { role: 'user', text: 'Olá! Preciso entender como solicitar acesso ao sistema interno.' },
        {
          role: 'bot',
          text: 'Olá! Posso te ajudar com isso. Aqui estão algumas opções que podem te ajudar:',
        },
      ],
      tiles: ['Políticas internas', 'TI e acessos', 'Recursos humanos', 'Guias e processos'],
      infoLine: 'Dica: Digite sua dúvida para uma resposta rápida.',
      footer: 'Conversa interna · Visível apenas para a equipe',
      inputPlaceholder: 'Digite sua mensagem...',
      showAttachment: true,
    },
    features: ['Grid 2×2 interno', 'Teal workplace', 'Badge interno'],
    isPremium: true,
    isNew: true,
    appearance: baseAppearance('workplace-mini', {
      primaryColor: '#0F766E',
      title: 'Workplace Mini',
      subtitle: 'Suporte interno da sua equipe',
      greeting: 'Olá! Posso te ajudar com políticas, TI, RH e processos.',
      theme: 'light',
    }),
  },
  {
    id: 'mini-corporate',
    name: 'Mini Corporate',
    tier: 'premium',
    category: 'chat_box',
    format: 'corporate',
    status: 'active',
    description:
      'Widget corporativo e seguro com acesso a portal, abertura de chamados e confiança reforçada.',
    tags: ['Premium', 'B2B', 'Seguro', 'Portal'],
    bestFor: 'Financeiro, jurídico, consultoria e SaaS B2B',
    dimensions: {
      previewWidth: 270,
      previewHeight: 390,
      widgetWidth: 390,
      widgetHeight: 620,
      headerHeight: 72,
      inputHeight: 58,
      borderRadius: 20,
    },
    theme: {
      primary: '#1E3A8A',
      headerBg: '#0B1220',
      accent: '#3B82F6',
      background: '#FFFFFF',
      surface: '#F8FAFC',
      border: '#CBD5E1',
      text: '#0F172A',
      muted: '#64748B',
    },
    preview: {
      variant: 'mini-corporate',
      headerTitle: 'Mini Corporate',
      headerSubtitle: 'Suporte corporativo • Resposta rápida e segura',
      messages: [
        { role: 'user', text: 'Olá, preciso de ajuda com o acesso ao portal do cliente.' },
        {
          role: 'bot',
          text: 'Olá! Estou aqui para ajudar. Selecione uma das opções abaixo para continuarmos.',
        },
      ],
      actionRows: ['Abrir chamado', 'Portal do cliente', 'Ambiente seguro', 'Dados protegidos'],
      infoLine: 'Conexão segura e criptografada',
      footer: 'Protegido por criptografia de ponta a ponta',
      inputPlaceholder: 'Escreva sua mensagem...',
      showAttachment: true,
    },
    features: ['Visual navy seguro', 'Ícones de confiança', 'Portal + chamados'],
    isPremium: true,
    appearance: baseAppearance('mini-corporate', {
      primaryColor: '#1E3A8A',
      title: 'Mini Corporate',
      subtitle: 'Suporte corporativo • Resposta rápida e segura',
      greeting: 'Olá! Selecione uma opção abaixo para continuarmos.',
      theme: 'light',
    }),
  },
  {
    id: 'floating-mini',
    name: 'Floating Mini',
    tier: 'premium',
    category: 'chat_box',
    format: 'floating',
    status: 'active',
    description:
      'Widget flutuante com efeito glassmorphism, translúcido e sofisticado com brilho suave.',
    tags: ['Premium', 'Glass', 'Flutuante', 'Moderno'],
    bestFor: 'Experiência moderna com bolha flutuante',
    dimensions: {
      previewWidth: 260,
      previewHeight: 380,
      widgetWidth: 340,
      widgetHeight: 520,
      headerHeight: 58,
      inputHeight: 54,
      borderRadius: 24,
    },
    theme: {
      primary: '#8B5CF6',
      accent: '#EC4899',
      headerBg: 'rgba(15, 23, 42, 0.72)',
      background: 'rgba(15, 23, 42, 0.72)',
      surface: 'rgba(255, 255, 255, 0.08)',
      border: 'rgba(255, 255, 255, 0.16)',
      text: '#F8FAFC',
      muted: '#CBD5E1',
      isDark: true,
    },
    preview: {
      variant: 'floating-mini',
      headerTitle: 'Floating Mini',
      headerStatus: 'Online',
      introLines: ['Olá! 👋 Como podemos te ajudar hoje?'],
      chips: ['Começar agora', 'Preços e planos', 'Dúvidas frequentes', 'Falar com especialista'],
      footer: 'Experiência moderna e flutuante',
      inputPlaceholder: 'Digite sua dúvida...',
      showFloatingBubble: true,
    },
    features: ['Glassmorphism', 'Bolha + expandido', 'Gradiente vibrante'],
    isPremium: true,
    isNew: true,
    appearance: baseAppearance('floating-mini', {
      primaryColor: '#8B5CF6',
      title: 'Floating Mini',
      subtitle: 'Online',
      greeting: 'Olá! Como podemos te ajudar hoje?',
      theme: 'dark',
    }),
  },
]

export const CHATBOX_FREE_MODELS = CHATBOX_MODELS.filter(m => m.tier === 'free' && m.status === 'active')
export const CHATBOX_PREMIUM_MODELS = CHATBOX_MODELS.filter(
  m => m.tier === 'premium' && m.status === 'active',
)

export function chatBoxPreviewTemplateId(modelId: string): string {
  return `chatbox-${modelId}`
}

export function parseChatBoxModelId(previewTemplateId?: string | null): string | null {
  if (!previewTemplateId?.startsWith('chatbox-')) return null
  return previewTemplateId.slice('chatbox-'.length)
}

export function findChatBoxModel(id: string): ChatBoxModel | undefined {
  return CHATBOX_MODELS.find(m => m.id === id)
}

export function chatBoxModelToAppearance(model: ChatBoxModel): WebChatAppearancePreset {
  return { ...model.appearance }
}

/** Planos com acesso aos modelos premium de chat box. */
export function canUsePremiumChatBoxModels(plan?: string | null): boolean {
  if (!plan) return false
  const p = plan.toLowerCase()
  return p === 'pro' || p === 'enterprise' || p === 'starter'
}
