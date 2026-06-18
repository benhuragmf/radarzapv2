export type WebChatWidgetPosition = 'left' | 'right';

export type WebChatConversationStatus = 'open' | 'closed';

export type WebChatQueueStatus = 'bot' | 'waiting_human' | 'with_agent';

export type WebChatMessageDirection = 'inbound' | 'outbound' | 'system';

export type WebChatMessageMediaType = 'image' | 'document';

export type WebChatWidgetTheme = 'light' | 'dark';

export interface WebChatWidgetAppearance {
  primaryColor: string;
  position: WebChatWidgetPosition;
  title: string;
  subtitle: string;
  greeting: string;
  askName: boolean;
  askEmail: boolean;
  theme: WebChatWidgetTheme;
}

export const DEFAULT_WEBCHAT_APPEARANCE: WebChatWidgetAppearance = {
  primaryColor: '#2563eb',
  position: 'right',
  title: 'Fale conosco',
  subtitle: 'Respondemos em instantes',
  greeting: 'Olá! Como podemos ajudar?',
  askName: true,
  askEmail: true,
  theme: 'light',
};

export const DEFAULT_WEBCHAT_AUTO_REPLY_MESSAGE =
  'Recebemos sua mensagem! Um atendente responderá em breve.';

export const DEFAULT_WEBCHAT_OUTSIDE_HOURS_MESSAGE =
  'Nosso horário de atendimento é de segunda a sexta, das 9h às 18h. Deixe sua mensagem que retornaremos no próximo horário útil.';

export const DEFAULT_WEBCHAT_PROACTIVE_GREETING_MESSAGE =
  'Olá! Estou por aqui caso precise de ajuda 😊';

export const DEFAULT_WEBCHAT_PROACTIVE_GREETING_DELAY_SECONDS = 30;

export interface WebChatPublicConfig {
  publicKey: string;
  title: string;
  subtitle: string;
  greeting: string;
  primaryColor: string;
  position: WebChatWidgetPosition;
  askName: boolean;
  askEmail: boolean;
  theme: WebChatWidgetTheme;
  isOnline: boolean;
  businessHoursEnabled: boolean;
  outsideHoursMessage: string;
  scheduleSummary?: string;
  proactiveGreetingEnabled: boolean;
  proactiveGreetingMessage: string;
  proactiveGreetingDelaySeconds: number;
}

export interface WebChatVisitorSessionDto {
  conversationId: string;
  status: WebChatConversationStatus;
  queueStatus: WebChatQueueStatus;
  departmentName?: string;
  visitorName?: string;
  visitorEmail?: string;
  messages: WebChatMessageDto[];
}

export interface WebChatMessageDto {
  id: string;
  direction: WebChatMessageDirection;
  body: string;
  createdAt: string;
  senderName?: string;
  mediaType?: WebChatMessageMediaType;
  mediaUrl?: string;
  mediaMime?: string;
  mediaFileName?: string;
}

/** Resposta de POST /messages — mensagem do visitante + respostas automáticas (bot/IA). */
export interface WebChatVisitorSendResult {
  message: WebChatMessageDto;
  replies: WebChatMessageDto[];
}

/** Visitante ao vivo no site (Redis + heartbeat do widget). */
export interface WebChatLiveVisitorDto {
  id: string;
  clientId: string;
  widgetId?: string;
  widgetName?: string;
  conversationId?: string;
  visitorName?: string;
  pageUrl: string;
  pageTitle?: string;
  trafficSource: string;
  referrer?: string;
  city?: string;
  region?: string;
  country?: string;
  chatOpened: boolean;
  chatEverOpened: boolean;
  /** Visitante clicou no balão da saudação proativa (não só no botão 💬). */
  proactiveInviteClicked?: boolean;
  notificationDismissed: boolean;
  lastSeenAt: string;
  onlineSince: string;
}

export interface WebChatConversationDto {
  id: string;
  status: WebChatConversationStatus;
  visitorName?: string;
  visitorEmail?: string;
  pageUrl?: string;
  userAgent?: string;
  createdAt?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  assignedUserId?: string;
  widgetName?: string;
  queueStatus?: WebChatQueueStatus;
  departmentId?: string;
  departmentName?: string;
  suggestedUserId?: string;
  suggestedUserName?: string;
  priorityForMe?: boolean;
  canAccept?: boolean;
  canPull?: boolean;
  assignedUserName?: string;
}
