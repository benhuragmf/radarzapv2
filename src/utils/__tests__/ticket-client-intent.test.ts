import {
  classifyTicketClientIntent,
  ticketIntentBlocksAppend,
  ticketIntentNeedsAssist,
  ticketIntentShouldTryResolve,
} from '../ticket-client-intent';

describe('classifyTicketClientIntent', () => {
  it('classifica consulta de status', () => {
    expect(classifyTicketClientIntent('Gostaria de saber o status dele?')).toBe('status_inquiry');
    expect(classifyTicketClientIntent('qual o andamento do chamado?')).toBe('status_inquiry');
    expect(classifyTicketClientIntent('quando a equipe vai responder?')).toBe('status_inquiry');
  });

  it('classifica recusa do cliente', () => {
    expect(classifyTicketClientIntent('não obrigado')).toBe('decline');
    expect(classifyTicketClientIntent('nao, valeu')).toBe('decline');
  });

  it('classifica seleção de ticket', () => {
    expect(classifyTicketClientIntent('TK-5NP8CT')).toBe('select_ref');
  });

  it('classifica complemento factual', () => {
    expect(classifyTicketClientIntent('8185-5858')).toBe('append_data');
    expect(classifyTicketClientIntent('Meu endereço mudou para Rua X 123')).toBe('append_data');
  });

  it('classifica relato de problema persistente', () => {
    expect(classifyTicketClientIntent('O problema ainda não foi resolvido')).toBe('problem_report');
    expect(classifyTicketClientIntent('Avisar que voltou a falhar')).toBe('problem_report');
  });

  it('classifica pergunta genérica', () => {
    expect(classifyTicketClientIntent('Como faço para acompanhar?')).toBe('question');
  });
});

describe('ticketIntent helpers', () => {
  it('bloqueia append para status, recusa e perguntas', () => {
    expect(ticketIntentBlocksAppend('status_inquiry')).toBe(true);
    expect(ticketIntentBlocksAppend('decline')).toBe(true);
    expect(ticketIntentBlocksAppend('question')).toBe(true);
    expect(ticketIntentBlocksAppend('select_ref')).toBe(true);
    expect(ticketIntentBlocksAppend('append_data')).toBe(false);
    expect(ticketIntentBlocksAppend('problem_report')).toBe(false);
  });

  it('tenta resolver perguntas e relatos', () => {
    expect(ticketIntentShouldTryResolve('question')).toBe(true);
    expect(ticketIntentShouldTryResolve('problem_report')).toBe(true);
    expect(ticketIntentShouldTryResolve('status_inquiry')).toBe(false);
  });

  it('dispara assist para status, recusa e perguntas', () => {
    expect(ticketIntentNeedsAssist('status_inquiry')).toBe(true);
    expect(ticketIntentNeedsAssist('decline')).toBe(true);
    expect(ticketIntentNeedsAssist('question')).toBe(true);
    expect(ticketIntentNeedsAssist('append_data')).toBe(false);
  });
});
