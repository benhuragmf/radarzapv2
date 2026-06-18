import {
  isVagueHumanTransferRequest,
  resolveWebChatShouldEscalate,
  rewritePrematureTransferReply,
  textLooksLikeWebChatInquiry,
  textLooksLikeWebChatProblem,
} from '../webchat-ai-triage.util';

describe('webchat-ai-triage.util', () => {
  it('detecta pedido vago de suporte', () => {
    expect(isVagueHumanTransferRequest('gostaria de falar com suporte tecnico')).toBe(true);
    expect(
      isVagueHumanTransferRequest('meus rastreadores pararam de funcionar'),
    ).toBe(false);
  });

  it('detecta problema concreto', () => {
    expect(textLooksLikeWebChatProblem('meus rastreador parou de funcionar')).toBe(true);
    expect(textLooksLikeWebChatProblem('oi')).toBe(false);
  });

  it('detecta dúvida comercial concreta', () => {
    const msg =
      'Você tem alguns produtos a venda gostaria de saber se tem alguma promoção';
    expect(textLooksLikeWebChatInquiry(msg)).toBe(true);
    expect(textLooksLikeWebChatProblem(msg)).toBe(false);
  });

  it('nao escala em pedido vago de transferencia', () => {
    expect(
      resolveWebChatShouldEscalate({
        clientText: 'quero falar com suporte tecnico',
        modelWantsEscalate: true,
        modelReply: 'Vou te encaminhar para o suporte.',
        messages: [{ direction: 'inbound', body: 'quero falar com suporte tecnico' }],
      }),
    ).toBe(false);
  });

  it('nao escala comercial na primeira mensagem mesmo se IA prometer transferencia', () => {
    const msg =
      'Você tem alguns produtos a venda gostaria de saber se tem alguma promoção';
    expect(
      resolveWebChatShouldEscalate({
        clientText: msg,
        modelWantsEscalate: true,
        modelReply:
          'Para te ajudar com as promoções, vou te encaminhar para o nosso setor Comercial.',
        messages: [{ direction: 'inbound', body: msg }],
      }),
    ).toBe(false);
  });

  it('reescreve resposta com promessa prematura de transferencia comercial', () => {
    const msg =
      'Você tem alguns produtos a venda gostaria de saber se tem alguma promoção';
    expect(rewritePrematureTransferReply(msg, 'teste')).toMatch(/produto ou serviço/i);
    expect(rewritePrematureTransferReply(msg, 'teste')).not.toMatch(/encaminhar/i);
  });

  it('escala quando problema ja foi descrito e cliente insiste', () => {
    expect(
      resolveWebChatShouldEscalate({
        clientText: 'ainda preciso falar com atendente',
        modelWantsEscalate: false,
        modelReply: 'Tente reiniciar o equipamento.',
        messages: [
          { direction: 'inbound', body: 'rastreador parou de funcionar' },
          {
            direction: 'outbound',
            body: 'Isso ajudou a resolver? Se ainda precisar falar com um atendente humano, é só me avisar.',
          },
          { direction: 'inbound', body: 'ainda preciso falar com atendente' },
        ],
      }),
    ).toBe(true);
  });
});
