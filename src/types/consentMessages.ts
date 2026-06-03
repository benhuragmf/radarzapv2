/** Textos de consentimento LGPD no WhatsApp (personalizados por organização). */

export interface ConsentMessages {
  request: string;
  accepted: string;
  refused: string;
  optOutConfirm: string;
  optOutConfirmed: string;
  optOutCancelled: string;
  resubscribe: string;
  optOutPendingHint: string;
}

function companyTitle(name?: string | null): string {
  const n = name?.trim();
  return n && n.length > 0 ? `*${n}*` : '*Empresa*';
}

function companyPlain(name?: string | null): string {
  const n = name?.trim();
  return n && n.length > 0 ? n : 'a empresa';
}

/**
 * Mensagens padronizadas com nome da organização (cadastro em Configurações / Organization.name).
 */
export function buildConsentMessages(companyName?: string | null): ConsentMessages {
  const title = companyTitle(companyName);
  const plain = companyPlain(companyName);

  return {
    request: `${title}
*Comunicações via WhatsApp*

${plain} solicita sua autorização para enviar mensagens neste número.

*Como responder:*
• *1* ou *aceito* — autorizo o recebimento
• *2* ou *recuso* — não autorizo

Seus dados são tratados conforme a LGPD. Você pode revogar o consentimento a qualquer momento.`,

    accepted: `${title}
*Consentimento confirmado*

Você autorizou o recebimento de mensagens de ${plain} neste WhatsApp.

_Para cancelar a inscrição, envie *sair* a qualquer momento._`,

    refused: `${title}
*Solicitação registrada*

Você optou por não receber mensagens de ${plain} neste canal.

_Obrigado pela resposta._`,

    optOutConfirm: `${title}
*Cancelar inscrição*

Confirma que *não* deseja mais receber mensagens de ${plain}?

• *Confirmar cancelamento:* responda *sair* ou *sim*
• *Manter inscrição:* responda *não* ou *continuar*`,

    optOutConfirmed: `${title}
*Inscrição cancelada*

Você não receberá mais mensagens de ${plain} neste WhatsApp.

_Para voltar a receber, envie *entrar* ou *aceitar*._`,

    optOutCancelled: `${title}
*Inscrição mantida*

Você continuará recebendo mensagens de ${plain}.`,

    resubscribe: `${title}
*Inscrição reativada*

Você voltou a receber mensagens de ${plain}.

_Para cancelar novamente, envie *sair*._`,

    optOutPendingHint: `${title}
Para confirmar o cancelamento: *sair* ou *sim*.
Para manter a inscrição: *não* ou *continuar*.`,
  };
}
