import {
  BASIC_TRIAGE_DEFAULT_CONFIDENCE_THRESHOLD,
  buildBasicTriageClarifyReply,
  classifyLocal,
  shouldRouteByClassification,
} from '../basic-triage-classifier';

describe('basic-triage-classifier', () => {
  const depts = [
    { name: 'Comercial', menuKey: '1' },
    { name: 'Financeiro', menuKey: '2' },
    { name: 'Suporte', menuKey: '3' },
    { name: 'Geral', menuKey: '4' },
  ];

  it('detecta saudação', () => {
    expect(classifyLocal('oi').intent).toBe('greeting');
    expect(classifyLocal('Bom dia!').confidence).toBeGreaterThan(0.9);
    expect(classifyLocal('Ola bom diua').intent).toBe('greeting');
    expect(classifyLocal('oi tudo bem').intent).toBe('greeting');
    expect(classifyLocal('ola bom dia').intent).toBe('greeting');
  });

  it('classifica financeiro', () => {
    const r = classifyLocal('preciso da segunda via do boleto');
    expect(r.intent).toBe('finance');
    expect(r.suggestedMenuKey).toBe('2');
    expect(shouldRouteByClassification(r)).toBe(true);
  });

  it('classifica comercial', () => {
    const r = classifyLocal('quero saber o preço do plano premium');
    expect(r.intent).toBe('commercial');
    expect(r.suggestedMenuKey).toBe('1');
  });

  it('classifica suporte técnico', () => {
    const r = classifyLocal('meu rastreador não conecta no aplicativo');
    expect(r.intent).toBe('support');
    expect(r.suggestedMenuKey).toBe('3');
    expect(shouldRouteByClassification(r)).toBe(false);
    expect(shouldRouteByClassification(r, 0.7)).toBe(true);
  });

  it('match por nome de setor', () => {
    const r = classifyLocal('quero falar com o financeiro', depts);
    expect(r.suggestedMenuKey).toBe('2');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('pedido de humano roteia com threshold padrão', () => {
    const r = classifyLocal('falar com atendente');
    expect(r.intent).toBe('human_request');
    expect(shouldRouteByClassification(r)).toBe(true);
  });

  it('classifica ticket_status', () => {
    const r = classifyLocal('quero ver o status do meu chamado TK-ABC123');
    expect(r.intent).toBe('ticket_status');
    expect(shouldRouteByClassification(r)).toBe(false);
  });

  it('classifica reclamação', () => {
    const r = classifyLocal('quero fazer uma reclamação sobre o atendimento');
    expect(r.intent).toBe('complaint');
    expect(r.confidence).toBeGreaterThanOrEqual(0.75);
  });

  it('classifica parceria', () => {
    const r = classifyLocal('tenho interesse em parceria de revenda');
    expect(r.intent).toBe('partnership');
  });

  it('texto vago fica unknown', () => {
    expect(classifyLocal('ok').intent).toBe('unknown');
  });

  it('gera pergunta de esclarecimento', () => {
    expect(buildBasicTriageClarifyReply('finance')).toMatch(/financeira/i);
  });
});
