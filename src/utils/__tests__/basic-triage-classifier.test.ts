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
  });

  it('match por nome de setor', () => {
    const r = classifyLocal('quero falar com o financeiro', depts);
    expect(r.suggestedMenuKey).toBe('2');
    expect(r.confidence).toBeGreaterThan(0.8);
  });

  it('pedido de humano não roteia imediatamente se abaixo do threshold custom', () => {
    const r = classifyLocal('falar com atendente');
    expect(r.intent).toBe('human_request');
    expect(shouldRouteByClassification(r, 0.9)).toBe(false);
    expect(shouldRouteByClassification(r, BASIC_TRIAGE_DEFAULT_CONFIDENCE_THRESHOLD)).toBe(true);
  });

  it('texto vago fica unknown', () => {
    expect(classifyLocal('ok').intent).toBe('unknown');
  });

  it('gera pergunta de esclarecimento', () => {
    expect(buildBasicTriageClarifyReply('finance')).toMatch(/financeira/i);
  });
});
