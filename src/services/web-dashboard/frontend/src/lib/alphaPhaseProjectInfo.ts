export type RoadmapItemStatus = 'live' | 'in_progress' | 'planned';

export interface AlphaPhaseRoadmapItem {
  id: string;
  title: string;
  description: string;
  status: RoadmapItemStatus;
}

export const ALPHA_PHASE_CURRENT_MODULES = [
  'Inbox unificado (WhatsApp + WebChat)',
  'Chamados (TK), CSAT e supervisão',
  'IA de atendimento (triagem, KB e handoff)',
  'WebChat embed com modelos de chat box',
  'Leads, formulários e segmentação de contatos',
  'Campanhas, automações e integrações API',
  'WhatsApp via Baileys (sessão + QR)',
] as const;

export const ALPHA_PHASE_ROADMAP: AlphaPhaseRoadmapItem[] = [
  {
    id: 'wa-cloud-api',
    title: 'Web API oficial do WhatsApp',
    description: 'Camada Cloud API da Meta para produção, compliance e escalabilidade.',
    status: 'planned',
  },
  {
    id: 'instagram-chatbox',
    title: 'Integração com chat box do Instagram',
    description: 'Atendimento omnichannel com inbox unificado para Direct do Instagram.',
    status: 'planned',
  },
  {
    id: 'facebook-chatbox',
    title: 'Integração com chat box do Facebook',
    description: 'Messenger integrado ao mesmo fluxo de fila, IA e supervisão.',
    status: 'planned',
  },
  {
    id: 'telegram',
    title: 'Integração com Telegram',
    description: 'Canal Telegram conectado ao Radar Chat para testes e operação assistida.',
    status: 'planned',
  },
];

export function roadmapStatusLabel(status: RoadmapItemStatus): string {
  switch (status) {
    case 'live':
      return 'Disponível';
    case 'in_progress':
      return 'Em andamento';
    default:
      return 'Próximo passo';
  }
}
