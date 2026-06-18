/** Ajuda das abas — espelho de BLUEPRINT_ADMIN_TAB_HELP (só UI admin). */

export const BLUEPRINT_ADMIN_TAB_HELP: Record<
  string,
  { title: string; purpose: string; tips: string[] }
> = {
  identity: {
    title: 'IDENTITY — Quem é o assistente',
    purpose: 'Persona, tom e regras de nome/saudação. Aplicado a todos os tenants.',
    tips: [
      'Use {agentName} e {companyName} — são substituídos automaticamente.',
      'Diferencie WhatsApp (confirmar nome) de chat do site (nome já veio no formulário).',
      'Mantenha curto: cada linha extra consome tokens em todo atendimento.',
    ],
  },
  soul: {
    title: 'SOUL — Missão e fluxo',
    purpose: 'Comportamento central: resolver antes de escalar, não inventar, uma pergunta por vez.',
    tips: [
      'O fluxo SKILLS → KNOWLEDGE → MEMORY deve estar explícito aqui.',
      'Pedidos vagos de setor devem virar pergunta de detalhe, não transferência.',
    ],
  },
  agents: {
    title: 'AGENTS — Orquestração',
    purpose: 'Quando triar setor, abrir ticket, escalar ou só responder.',
    tips: [
      'shouldEscalate=true só após tentativa de ajuda ou urgência real.',
      'departmentMenuKey deve bater com os setores cadastrados pelo tenant.',
    ],
  },
  tools: {
    title: 'TOOLS — JSON de resposta',
    purpose: 'Liga campos do JSON (shouldEscalate, collectedName…) ao comportamento esperado.',
    tips: [
      'Reforce: não prometer transferência no reply sem shouldEscalate=true.',
      'Compatível com Gemini e OpenAI no mesmo formato.',
    ],
  },
  memory: {
    title: 'MEMORY — Guia para memórias do tenant',
    purpose: 'Instrução de como usar fatos curtos que o cliente cadastra na aba Memória.',
    tips: ['Não duplicar conteúdo de SKILLS ou KNOWLEDGE — só o papel de cada bloco.'],
  },
  skills: {
    title: 'SKILLS — Guia para skills do tenant',
    purpose: 'Prioridade das receitas passo a passo cadastradas pelo cliente.',
    tips: ['Skills têm prioridade sobre KNOWLEDGE em problemas técnicos.'],
  },
  knowledge: {
    title: 'KNOWLEDGE — Guia para base do tenant',
    purpose: 'Como usar FAQ oficial; evitar invenção de preços e políticas.',
    tips: ['Comercial e promoções: responder pela base antes de encaminhar.'],
  },
  final: {
    title: 'Regra final',
    purpose: 'Fechamento do prompt: prioridade resolver > ticket > humano.',
    tips: ['Última coisa que o modelo lê antes do JSON — seja direto.'],
  },
  greetings: {
    title: 'Saudações automáticas',
    purpose: 'Padrão global de saudações — tenants podem sobrescrever em Inbox → IA → Geral.',
    tips: [
      'Cliente conhecido: confirmação leve + como posso ajudar.',
      'Cliente novo: pedir só o nome (problema vem na sequência).',
      'Cada tenant pode personalizar; vazio no tenant usa estes textos.',
    ],
  },
}
