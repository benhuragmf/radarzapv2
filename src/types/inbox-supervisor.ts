import type { AgentOperationalStatus } from './agent-presence';
import type { ContactClassification } from './contact-classification';

export type SupervisorAgentActivity =
  | 'offline'
  | 'idle'
  | 'inbox'
  | 'supervisor'
  | 'other_page'
  | 'in_chat';

export type SupervisorActiveConversation = {
  id: string;
  channel: 'whatsapp_qr' | 'whatsapp_cloud' | 'webchat_site';
  contactName: string;
  contactIdentifier: string;
  status: string;
  departmentName?: string;
  widgetName?: string;
  assignedUserId?: string;
  assignedUserName?: string;
  suggestedUserName?: string;
  suggestedAt?: string;
  pullTimeoutSeconds?: number;
  whatsappBridgeActive?: boolean;
  lastMessageAt: string;
  lastMessagePreview?: string;
  handleTimeSec?: number;
  queueWaitSec?: number;
  ticketRef?: string;
  /** Último pedido de ajuda via @supervisor no chat interno. */
  supervisorHelpAt?: string;
  supervisorHelpPreview?: string;
  supervisorHelpAuthor?: string;
  /** Classificação CRM do contato vinculado (quando há `destinationId`). */
  contactClassification?: ContactClassification;
};

export type SupervisorAgentRow = {
  userId: string;
  displayName: string;
  email?: string;
  whatsappPhone?: string;
  linked: boolean;
  online: boolean;
  availableForQueue: boolean;
  operationalStatus: AgentOperationalStatus;
  statusLabel: string;
  activity: SupervisorAgentActivity;
  activityLabel: string;
  currentRoute?: string;
  viewingConversationId?: string;
  activeCount: number;
  activeConversations: SupervisorActiveConversation[];
  metrics: {
    periodDays: number;
    conversationsHandled: number;
    avgHandleTimeSec: number | null;
    avgPullTimeSec: number | null;
    avgCsatScore: number | null;
    csatCount: number;
  };
};

export type SupervisorDashboardPayload = {
  generatedAt: string;
  periodDays: number;
  summary: {
    queueCount: number;
    triageCount: number;
    activeCount: number;
    onlineAgents: number;
    priorityCount: number;
    avgHandleTimeSec: number | null;
    avgPullTimeSec: number | null;
    avgCsatScore: number | null;
    helpRequestCount: number;
  };
  agents: SupervisorAgentRow[];
  activeConversations: SupervisorActiveConversation[];
  queue: SupervisorActiveConversation[];
};
