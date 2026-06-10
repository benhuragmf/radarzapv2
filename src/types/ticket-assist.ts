/** Contexto resumido do ticket para IA / auto-resolve. */
export interface TicketBriefForAssist {
  ticketRef: string;
  status: string;
  displayStatusLabel: string;
  subject?: string;
  recentClientReplies: string[];
  recentTeamComments: string[];
  contextBlock: string;
}
