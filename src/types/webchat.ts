export type WebChatWidgetPosition = 'left' | 'right';

export type WebChatConversationStatus = 'open' | 'closed';

export type WebChatMessageDirection = 'inbound' | 'outbound' | 'system';

export interface WebChatWidgetAppearance {
  primaryColor: string;
  position: WebChatWidgetPosition;
  title: string;
  subtitle: string;
  greeting: string;
  askName: boolean;
  askEmail: boolean;
}

export const DEFAULT_WEBCHAT_APPEARANCE: WebChatWidgetAppearance = {
  primaryColor: '#2563eb',
  position: 'right',
  title: 'Fale conosco',
  subtitle: 'Respondemos em instantes',
  greeting: 'Olá! Como podemos ajudar?',
  askName: true,
  askEmail: false,
};

export interface WebChatPublicConfig {
  publicKey: string;
  title: string;
  subtitle: string;
  greeting: string;
  primaryColor: string;
  position: WebChatWidgetPosition;
  askName: boolean;
  askEmail: boolean;
}

export interface WebChatMessageDto {
  id: string;
  direction: WebChatMessageDirection;
  body: string;
  createdAt: string;
  senderName?: string;
}

export interface WebChatConversationDto {
  id: string;
  status: WebChatConversationStatus;
  visitorName?: string;
  visitorEmail?: string;
  pageUrl?: string;
  lastMessageAt?: string;
  lastMessagePreview?: string;
  unreadCount?: number;
  assignedUserId?: string;
  widgetName?: string;
}
