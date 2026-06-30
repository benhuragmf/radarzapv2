import type { DiscordEventPayload } from '@/types/discord-monitor';
import { buildRodape } from '@/utils/discord-wa-format';
import type { DiscordWaPayload } from '@/utils/discord-wa-variables';

const TRIGGER_ACTION_LABEL: Record<string, string> = {
  message_edit: 'editou uma mensagem',
  message_reaction: 'reagiu a uma mensagem',
  voice_join: 'entrou na chamada',
  voice_leave: 'saiu da chamada',
  member_join: 'entrou no servidor',
  member_leave: 'saiu do servidor',
  member_kick: 'foi removido',
  member_ban: 'foi banido',
};

export function buildDiscordEventWhatsAppVariables(
  event: DiscordEventPayload,
  senderLabel?: string,
): DiscordWaPayload {
  const now = new Date(event.timestamp);
  const data = now.toLocaleDateString('pt-BR');
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const acao = TRIGGER_ACTION_LABEL[event.trigger] ?? event.trigger;
  const canalVoz = event.channelName ? `#${event.channelName.replace(/^#/, '')}` : '';
  const moderador = event.moderatorName ?? '';

  const corpoParts: string[] = [];
  if (event.trigger === 'message_edit') {
    corpoParts.push(`✏️ *${event.userName}* ${acao}`);
    if (event.messagePreview) corpoParts.push(event.messagePreview);
    if (event.previousContent) corpoParts.push(`_Antes:_ ${event.previousContent}`);
  } else if (event.trigger === 'message_reaction') {
    corpoParts.push(`${event.emoji ?? '👍'} *${event.userName}* ${acao}`);
    if (event.messagePreview) corpoParts.push(event.messagePreview);
  } else if (event.trigger.startsWith('voice_')) {
    corpoParts.push(`🔊 *${event.userName}* ${acao}`);
    if (canalVoz) corpoParts.push(`Canal: ${canalVoz}`);
    if (event.memberCount != null) corpoParts.push(`👥 ${event.memberCount} na chamada`);
  } else {
    corpoParts.push(`👤 *${event.userName}* ${acao}`);
    if (moderador) corpoParts.push(`Por: *${moderador}*`);
    if (event.reason) corpoParts.push(`Motivo: ${event.reason}`);
    if (event.memberCount != null) corpoParts.push(`Membros no servidor: ${event.memberCount}`);
  }

  const corpo = corpoParts.join('\n');
  const titulo =
    event.trigger === 'message_edit' || event.trigger === 'message_reaction'
      ? `Canal — ${event.guildName}`
      : event.trigger.startsWith('voice_')
      ? `Chamada de voz — ${event.guildName}`
      : `Servidor — ${event.guildName}`;

  const rodape = buildRodape(
    {
      guildName: event.guildName,
      channelName: event.channelName,
      radarzapSenderLabel: senderLabel,
    } as Parameters<typeof buildRodape>[0],
    data,
    hora,
  );

  const variables: Record<string, string> = {
    titulo,
    corpo,
    conteudo: corpo,
    mensagem: corpo,
    mensagem_curta: `${event.userName} ${acao}`,
    usuario: event.userName,
    usuario_id: event.userId,
    usuario_tag: event.userTag,
    canal_voz: canalVoz,
    canal: event.channelName,
    canal_hash: canalVoz,
    servidor: event.guildName,
    acao,
    moderador,
    motivo: event.reason ?? '',
    emoji: event.emoji ?? '',
    mensagem_id: event.messageId ?? '',
    mensagem_preview: event.messagePreview ?? '',
    conteudo_anterior: event.previousContent ?? '',
    membros_no_canal: event.memberCount != null ? String(event.memberCount) : '',
    data,
    hora,
    rodape,
    autor: senderLabel ?? 'Radar Chat',
    link_bloco: '',
    link_principal: '',
    link: '',
    imagem: '',
    imagens_extra: '',
    opcoes_botoes: '',
    anexos: '',
  };

  return { variables, extraImages: [] };
}

/** Template padrão por tipo de evento */
export function defaultEventTemplate(trigger: string): string {
  if (trigger === 'message_edit') return 'dw-message-edit';
  if (trigger === 'message_reaction') return 'dw-message-reaction';
  if (trigger === 'voice_join') return 'dw-voice-join';
  if (trigger === 'voice_leave') return 'dw-voice-leave';
  if (trigger === 'member_join') return 'dw-member-join';
  if (trigger === 'member_leave') return 'dw-member-leave';
  if (trigger === 'member_kick') return 'dw-member-kick';
  if (trigger === 'member_ban') return 'dw-member-ban';
  return 'dw-padrao';
}
