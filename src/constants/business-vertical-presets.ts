import { DEFAULT_INBOX_WEEKLY_SCHEDULE } from '@/types/inbox-settings';
import type { BusinessVerticalPreset } from '@/types/business-vertical';
import { mergeVerticalAiPack } from '@/constants/business-vertical-ai-packs';

const WEEKDAY_RETAIL: typeof DEFAULT_INBOX_WEEKLY_SCHEDULE = {
  ...DEFAULT_INBOX_WEEKLY_SCHEDULE,
  saturday: { enabled: true, start: '09:00', end: '14:00' },
};

const WEEKDAY_RESTAURANT: typeof DEFAULT_INBOX_WEEKLY_SCHEDULE = {
  monday: { enabled: true, start: '11:00', end: '23:00' },
  tuesday: { enabled: true, start: '11:00', end: '23:00' },
  wednesday: { enabled: true, start: '11:00', end: '23:00' },
  thursday: { enabled: true, start: '11:00', end: '23:00' },
  friday: { enabled: true, start: '11:00', end: '00:00' },
  saturday: { enabled: true, start: '11:00', end: '00:00' },
  sunday: { enabled: true, start: '11:00', end: '22:00' },
};

const WEEKDAY_CLINIC: typeof DEFAULT_INBOX_WEEKLY_SCHEDULE = {
  ...DEFAULT_INBOX_WEEKLY_SCHEDULE,
  saturday: { enabled: true, start: '08:00', end: '12:00' },
};

/** Catálogo de presets por tipo de comércio (Brasil). */
export const BUSINESS_VERTICAL_PRESETS: BusinessVerticalPreset[] = [
  {
    id: 'varejo_fisico',
    label: 'Loja física / varejo',
    description: 'Produtos, estoque, trocas e horário de funcionamento da loja.',
    icon: 'Store',
    departments: [
      { name: 'Vendas', menuKey: '1', sortOrder: 1, description: 'Produtos e disponibilidade' },
      { name: 'Trocas e devoluções', menuKey: '2', sortOrder: 2, description: 'Troca, defeito ou arrependimento' },
      { name: 'Financeiro', menuKey: '3', sortOrder: 3, description: 'Pagamentos e nota fiscal' },
      { name: 'Atendimento geral', menuKey: '4', sortOrder: 4, description: 'Outras dúvidas' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! Bem-vindo à *{company}*. 🛍️',
      menuIntro: 'Como podemos ajudar?',
      waitingMessage: 'Um vendedor responderá em breve. Enquanto isso, pode informar o produto de interesse.',
      outsideHoursMessage:
        'Nossa loja atende de segunda a sexta das 9h às 18h e sábado das 9h às 14h. Deixe sua mensagem que retornamos no próximo horário.',
      businessHoursEnabled: true,
      schedule: WEEKDAY_RETAIL,
    },
    webChat: {
      contactReasonOptions: [
        'Quero comprar',
        'Disponibilidade de produto',
        'Troca ou devolução',
        'Horário da loja',
        'Outro',
      ],
      appearance: {
        title: 'Fale com a loja',
        subtitle: 'Tire dúvidas sobre produtos e pedidos',
        greeting: 'Olá! Precisa de ajuda para encontrar um produto?',
      },
      proactiveGreetingEnabled: true,
      proactiveGreetingMessage: 'Olá! Posso ajudar a encontrar algum produto? 😊',
    },
    quickRepliesExtra: [
      { code: 'estoque', label: 'Consultar estoque', template: 'Vou verificar a disponibilidade e já retorno, [user].' },
      { code: 'troca', label: 'Política de troca', template: 'Para troca ou devolução, preciso do cupom ou nota fiscal e o produto na embalagem original.' },
    ],
    knowledgeBase: [
      {
        title: 'Horário de funcionamento',
        content: 'Atendimento presencial e pelo chat de segunda a sexta, das 9h às 18h, e sábado das 9h às 14h.',
        category: 'Loja',
        keywords: ['horário', 'funcionamento', 'aberto'],
        showAsQuickReply: true,
        quickReplyLabel: 'Horário',
      },
      {
        title: 'Trocas e devoluções',
        content: 'Trocas em até 7 dias para produtos sem uso, com nota fiscal. Defeitos de fábrica: traga o produto para avaliação.',
        category: 'Pós-venda',
        keywords: ['troca', 'devolução', 'garantia'],
        showAsQuickReply: true,
        quickReplyLabel: 'Trocas',
      },
    ],
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'ecommerce',
    label: 'E-commerce / loja online',
    description: 'Pedidos, rastreio, pagamento e pós-venda digital.',
    icon: 'ShoppingCart',
    departments: [
      { name: 'Vendas online', menuKey: '1', sortOrder: 1, description: 'Novos pedidos e dúvidas' },
      { name: 'Rastreio e entrega', menuKey: '2', sortOrder: 2, description: 'Status do pedido' },
      { name: 'Trocas e devoluções', menuKey: '3', sortOrder: 3, description: 'Pós-venda' },
      { name: 'Financeiro', menuKey: '4', sortOrder: 4, description: 'Pagamento e nota' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! Você está no atendimento *{company}* online. 📦',
      waitingMessage: 'Aguarde um instante — vamos localizar seu pedido ou tirar sua dúvida.',
      outsideHoursMessage:
        'Nosso chat funciona 24h, mas a equipe responde de segunda a sexta, das 9h às 18h. Deixe número do pedido se tiver.',
    },
    webChat: {
      contactReasonOptions: [
        'Status do meu pedido',
        'Quero comprar',
        'Problema na entrega',
        'Troca ou devolução',
        'Outro',
      ],
      appearance: {
        title: 'Atendimento online',
        subtitle: 'Pedidos, rastreio e suporte',
        greeting: 'Olá! Informe o número do pedido se já comprou conosco.',
      },
    },
    quickRepliesExtra: [
      { code: 'rastreio', label: 'Rastreio', template: 'Por favor, envie o número do pedido para eu consultar o rastreio.' },
      { code: 'prazo', label: 'Prazo de entrega', template: 'O prazo varia conforme sua região. Com o CEP consigo estimar para você.' },
    ],
    knowledgeBase: [
      {
        title: 'Como rastrear meu pedido',
        content: 'Acesse Minha Conta no site ou envie o número do pedido aqui no chat. O código de rastreio é enviado por e-mail após o despacho.',
        category: 'Pedidos',
        keywords: ['rastreio', 'pedido', 'entrega'],
        showAsQuickReply: true,
        quickReplyLabel: 'Rastrear pedido',
      },
      {
        title: 'Prazo e frete',
        content: 'O prazo de entrega é calculado no checkout conforme CEP. Pedidos até 14h em dias úteis podem ser despachados no mesmo dia (sujeito a estoque).',
        category: 'Entrega',
        keywords: ['frete', 'prazo', 'envio'],
      },
    ],
    aiPrompt: { collectOrderNumber: true },
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'restaurante',
    label: 'Restaurante / delivery',
    description: 'Pedidos, cardápio, reservas e delivery.',
    icon: 'UtensilsCrossed',
    departments: [
      { name: 'Pedidos', menuKey: '1', sortOrder: 1, description: 'Delivery e retirada' },
      { name: 'Reservas', menuKey: '2', sortOrder: 2, description: 'Mesas e eventos' },
      { name: 'Reclamações', menuKey: '3', sortOrder: 3, description: 'Problemas no pedido' },
      { name: 'Financeiro', menuKey: '4', sortOrder: 4, description: 'Pagamentos' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — faça seu pedido ou tire dúvidas. 🍽️',
      waitingMessage: 'Recebemos sua mensagem! Nossa equipe já vai atender seu pedido.',
      outsideHoursMessage: 'Estamos fora do horário de atendimento. Deixe seu pedido ou mensagem que respondemos quando abrirmos.',
      businessHoursEnabled: true,
      schedule: WEEKDAY_RESTAURANT,
    },
    webChat: {
      contactReasonOptions: ['Fazer pedido', 'Cardápio', 'Status do delivery', 'Reservar mesa', 'Outro'],
      appearance: {
        title: 'Peça aqui',
        subtitle: 'Delivery e retirada',
        greeting: 'Olá! Quer fazer um pedido ou ver o cardápio?',
      },
      proactiveGreetingEnabled: true,
      proactiveGreetingMessage: 'Fome? Posso ajudar com o cardápio ou seu pedido 🍕',
      proactiveGreetingDelaySeconds: 20,
    },
    quickRepliesExtra: [
      { code: 'cardapio', label: 'Cardápio', template: 'Segue nosso cardápio — diga o que deseja pedir!' },
      { code: 'tempo', label: 'Tempo de entrega', template: 'O tempo médio de entrega hoje é de 40 a 60 minutos na sua região.' },
    ],
    knowledgeBase: [
      {
        title: 'Formas de pagamento',
        content: 'Aceitamos Pix, cartão na entrega e dinheiro. No app/site também há pagamento online.',
        category: 'Pedidos',
        keywords: ['pagamento', 'pix', 'cartão'],
        showAsQuickReply: true,
        quickReplyLabel: 'Pagamento',
      },
    ],
    suggestedAttendanceMode: 'robotic',
  },
  {
    id: 'clinica',
    label: 'Clínica / consultório',
    description: 'Agendamentos, convênios e orientações ao paciente.',
    icon: 'Stethoscope',
    departments: [
      { name: 'Agendamentos', menuKey: '1', sortOrder: 1, description: 'Marcar ou remarcar consulta' },
      { name: 'Convênios', menuKey: '2', sortOrder: 2, description: 'Planos aceitos' },
      { name: 'Resultados', menuKey: '3', sortOrder: 3, description: 'Exames e laudos' },
      { name: 'Financeiro', menuKey: '4', sortOrder: 4, description: 'Particular e pagamentos' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — secretaria virtual. 🏥',
      waitingMessage: 'Aguarde, nossa equipe de agendamento responderá em breve.',
      outsideHoursMessage:
        'Atendimento de segunda a sexta das 8h às 18h e sábado das 8h às 12h. Emergências: procure pronto-socorro.',
      businessHoursEnabled: true,
      schedule: WEEKDAY_CLINIC,
    },
    webChat: {
      contactReasonOptions: [
        'Agendar consulta',
        'Remarcar ou cancelar',
        'Convênio / plano',
        'Resultado de exame',
        'Outro',
      ],
      appearance: {
        title: 'Secretaria',
        subtitle: 'Agendamentos e informações',
        greeting: 'Olá! Como posso ajudar? Para agendar, informe nome e convênio.',
        primaryColor: '#0d9488',
      },
    },
    quickRepliesExtra: [
      { code: 'agenda', label: 'Agendar', template: 'Para agendar, preciso do seu nome completo, convênio (ou particular) e preferência de dia/horário.' },
      { code: 'docs', label: 'Documentos', template: 'Traga documento com foto, carteirinha do convênio (se houver) e pedido médico quando aplicável.' },
    ],
    knowledgeBase: [
      {
        title: 'Como agendar consulta',
        content: 'Informe nome, telefone, convênio ou particular e especialidade desejada. Confirmaremos horários disponíveis.',
        category: 'Agendamento',
        keywords: ['agendar', 'consulta', 'marcar'],
        showAsQuickReply: true,
        quickReplyLabel: 'Agendar',
      },
      {
        title: 'Convênios aceitos',
        content: 'Consulte a lista de convênios no site ou informe seu plano aqui para confirmarmos a cobertura.',
        category: 'Convênios',
        keywords: ['convênio', 'plano', 'particular'],
      },
    ],
    aiPrompt: {
      collectCpfCnpj: true,
      agentsGuide:
        'Nunca forneça diagnóstico ou prescrição. Oriente agendamento e documentos. Encaminhe urgências médicas ao pronto-socorro.',
    },
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'escritorio',
    label: 'Escritório (advocacia, contabilidade)',
    description: 'Triagem formal, processos e atendimento confidencial.',
    icon: 'Briefcase',
    departments: [
      { name: 'Novos clientes', menuKey: '1', sortOrder: 1, description: 'Primeiro contato' },
      { name: 'Processos em andamento', menuKey: '2', sortOrder: 2, description: 'Clientes ativos' },
      { name: 'Financeiro', menuKey: '3', sortOrder: 3, description: 'Honorários e boletos' },
      { name: 'Administrativo', menuKey: '4', sortOrder: 4, description: 'Documentos e geral' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá. Você fala com *{company}*.',
      menuIntro: 'Selecione o assunto:',
      waitingMessage: 'Recebemos sua mensagem. Um profissional retornará em horário comercial.',
      outsideHoursMessage:
        'Nosso horário de atendimento é de segunda a sexta, das 8h às 18h. Retornaremos no próximo dia útil.',
      schedule: {
        ...DEFAULT_INBOX_WEEKLY_SCHEDULE,
        monday: { enabled: true, start: '08:00', end: '18:00' },
        tuesday: { enabled: true, start: '08:00', end: '18:00' },
        wednesday: { enabled: true, start: '08:00', end: '18:00' },
        thursday: { enabled: true, start: '08:00', end: '18:00' },
        friday: { enabled: true, start: '08:00', end: '18:00' },
      },
    },
    webChat: {
      contactReasonOptions: [
        'Quero ser cliente',
        'Andamento de processo',
        'Financeiro / honorários',
        'Enviar documentos',
        'Outro',
      ],
      appearance: {
        title: 'Atendimento',
        subtitle: 'Resposta em horário comercial',
        greeting: 'Olá. Descreva brevemente sua demanda (sem dados sensíveis na primeira mensagem).',
        primaryColor: '#1e3a5f',
      },
    },
    aiPrompt: {
      collectCpfCnpj: true,
      agentsGuide:
        'Tom formal e confidencial. Não opine juridicamente nem contabilmente — encaminhe ao profissional responsável.',
    },
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'imobiliaria',
    label: 'Imobiliária',
    description: 'Compra, aluguel, visitas e financiamento.',
    icon: 'Building2',
    departments: [
      { name: 'Comprar', menuKey: '1', sortOrder: 1, description: 'Imóveis à venda' },
      { name: 'Alugar', menuKey: '2', sortOrder: 2, description: 'Locação' },
      { name: 'Financiamento', menuKey: '3', sortOrder: 3, description: 'Crédito e documentação' },
      { name: 'Visitas', menuKey: '4', sortOrder: 4, description: 'Agendar visita' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — imóveis e oportunidades. 🏠',
      waitingMessage: 'Um corretor entrará em contato em breve. Informe bairro ou código do imóvel se tiver.',
    },
    webChat: {
      contactReasonOptions: [
        'Quero comprar',
        'Quero alugar',
        'Agendar visita',
        'Financiamento',
        'Outro',
      ],
      appearance: {
        title: 'Fale com um corretor',
        subtitle: 'Compra, aluguel e visitas',
        greeting: 'Olá! Procura imóvel para comprar ou alugar?',
      },
      proactiveGreetingEnabled: true,
      proactiveGreetingMessage: 'Encontrou algum imóvel no site? Posso ajudar com visita ou simulação.',
    },
    quickRepliesExtra: [
      { code: 'visita', label: 'Agendar visita', template: 'Para agendar visita, informe o código do imóvel e melhor dia/horário.' },
    ],
    knowledgeBase: [
      {
        title: 'Como agendar visita',
        content: 'Informe o código ou link do imóvel, seu nome e telefone. Confirmaremos disponibilidade com o corretor.',
        category: 'Visitas',
        keywords: ['visita', 'agendar', 'imóvel'],
        showAsQuickReply: true,
        quickReplyLabel: 'Visita',
      },
    ],
    aiPrompt: { collectAddress: true },
    suggestedAttendanceMode: 'hybrid',
  },
  {
    id: 'beleza',
    label: 'Salão / estética / barbearia',
    description: 'Agendamentos, serviços e profissionais.',
    icon: 'Scissors',
    departments: [
      { name: 'Agendamentos', menuKey: '1', sortOrder: 1, description: 'Marcar horário' },
      { name: 'Serviços e preços', menuKey: '2', sortOrder: 2, description: 'Tabela e pacotes' },
      { name: 'Produtos', menuKey: '3', sortOrder: 3, description: 'Venda de produtos' },
      { name: 'Reclamações', menuKey: '4', sortOrder: 4, description: 'Feedback' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* ✂️ — agende seu horário.',
      waitingMessage: 'Já já confirmamos seu horário ou tiramos sua dúvida!',
    },
    webChat: {
      contactReasonOptions: ['Agendar horário', 'Preços e serviços', 'Remarcar', 'Pacotes e promoções', 'Outro'],
      appearance: {
        title: 'Agende aqui',
        subtitle: 'Horários e serviços',
        greeting: 'Olá! Qual serviço deseja agendar?',
        primaryColor: '#db2777',
      },
    },
    quickRepliesExtra: [
      { code: 'horario', label: 'Horários', template: 'Temos horários de terça a sábado. Qual serviço e preferência de dia?' },
    ],
    knowledgeBase: [
      {
        title: 'Política de cancelamento',
        content: 'Cancelamentos com até 4h de antecedência. Após esse prazo pode haver cobrança de 50% do serviço.',
        category: 'Agendamento',
        keywords: ['cancelar', 'remarcar', 'horário'],
      },
    ],
    suggestedAttendanceMode: 'robotic',
  },
  {
    id: 'auto_center',
    label: 'Oficina / auto center',
    description: 'Orçamentos, status do veículo e serviços.',
    icon: 'Car',
    departments: [
      { name: 'Orçamentos', menuKey: '1', sortOrder: 1, description: 'Novos serviços' },
      { name: 'Status do veículo', menuKey: '2', sortOrder: 2, description: 'Serviço em andamento' },
      { name: 'Peças', menuKey: '3', sortOrder: 3, description: 'Disponibilidade' },
      { name: 'Financeiro', menuKey: '4', sortOrder: 4, description: 'Pagamento' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — oficina mecânica. 🔧',
      waitingMessage: 'Consultando sua OS — um mecânico ou consultor responderá em breve.',
    },
    webChat: {
      contactReasonOptions: ['Solicitar orçamento', 'Status do meu carro', 'Agendar revisão', 'Guincho / emergência', 'Outro'],
      appearance: {
        title: 'Oficina',
        subtitle: 'Orçamentos e acompanhamento',
        greeting: 'Olá! Informe placa ou número da OS se já deixou o veículo.',
      },
    },
    quickRepliesExtra: [
      { code: 'os', label: 'Consultar OS', template: 'Informe a placa ou número da ordem de serviço para eu verificar o status.' },
    ],
    aiPrompt: { collectOrderNumber: true },
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'educacao',
    label: 'Escola / curso / educação',
    description: 'Matrículas, secretaria e financeiro escolar.',
    icon: 'GraduationCap',
    departments: [
      { name: 'Matrículas', menuKey: '1', sortOrder: 1, description: 'Novos alunos' },
      { name: 'Secretaria', menuKey: '2', sortOrder: 2, description: 'Documentos e calendário' },
      { name: 'Financeiro', menuKey: '3', sortOrder: 3, description: 'Mensalidades' },
      { name: 'Pedagógico', menuKey: '4', sortOrder: 4, description: 'Coordenação' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — secretaria escolar. 📚',
      waitingMessage: 'Nossa equipe responderá em breve. Informe nome do aluno se aplicável.',
    },
    webChat: {
      contactReasonOptions: ['Matrícula', 'Mensalidade', 'Documentos', 'Falar com coordenação', 'Outro'],
      appearance: {
        title: 'Secretaria',
        subtitle: 'Matrículas e informações',
        greeting: 'Olá! Como podemos ajudar você ou seu filho(a)?',
        primaryColor: '#7c3aed',
      },
    },
    knowledgeBase: [
      {
        title: 'Documentos para matrícula',
        content: 'RG, CPF, comprovante de residência, histórico escolar e foto 3x4. Lista completa no site ou presencialmente.',
        category: 'Matrícula',
        keywords: ['matrícula', 'documentos', 'inscrição'],
        showAsQuickReply: true,
        quickReplyLabel: 'Matrícula',
      },
    ],
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'servicos',
    label: 'Prestador de serviços',
    description: 'Orçamentos, visitas técnicas e emergências.',
    icon: 'Wrench',
    departments: [
      { name: 'Orçamentos', menuKey: '1', sortOrder: 1, description: 'Novos serviços' },
      { name: 'Agendamentos', menuKey: '2', sortOrder: 2, description: 'Visita técnica' },
      { name: 'Emergências', menuKey: '3', sortOrder: 3, description: 'Urgências' },
      { name: 'Financeiro', menuKey: '4', sortOrder: 4, description: 'Pagamentos' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! *{company}* — como podemos ajudar?',
      waitingMessage: 'Recebemos sua solicitação. Retornaremos com orçamento ou horário de visita.',
    },
    webChat: {
      contactReasonOptions: ['Pedir orçamento', 'Agendar visita', 'Emergência', 'Acompanhar serviço', 'Outro'],
      appearance: {
        title: 'Solicite um orçamento',
        subtitle: 'Resposta rápida',
        greeting: 'Olá! Descreva o serviço necessário e seu bairro/cidade.',
      },
    },
    quickRepliesExtra: [
      { code: 'orc', label: 'Orçamento', template: 'Para orçamento, descreva o serviço, endereço (bairro) e melhor horário para visita.' },
    ],
    aiPrompt: { collectAddress: true },
    suggestedAttendanceMode: 'basic_triage',
  },
  {
    id: 'outro',
    label: 'Outro / personalizado',
    description: 'Mantém setores genéricos com textos neutros — ajuste depois no painel.',
    icon: 'LayoutGrid',
    departments: [
      { name: 'Comercial', menuKey: '1', sortOrder: 1, description: 'Vendas e propostas' },
      { name: 'Financeiro', menuKey: '2', sortOrder: 2, description: 'Cobranças e pagamentos' },
      { name: 'Suporte', menuKey: '3', sortOrder: 3, description: 'Dúvidas' },
      { name: 'Geral', menuKey: '4', sortOrder: 4, description: 'Atendimento geral' },
    ],
    inbox: {
      welcomeWithCompany: 'Olá! Bem-vindo ao atendimento *{company}*.',
      welcomeGeneric: 'Olá! Bem-vindo ao nosso atendimento.',
    },
    webChat: {
      contactReasonOptions: ['Quero saber preços', 'Quero contratar', 'Preciso de suporte', 'Outro'],
    },
    suggestedAttendanceMode: 'disabled',
  },
];

export function getBusinessVerticalPreset(id: string): BusinessVerticalPreset | undefined {
  const base = BUSINESS_VERTICAL_PRESETS.find(p => p.id === id);
  if (!base) return undefined;
  return mergeVerticalAiPack(base);
}

export function listBusinessVerticalPresetsPublic(): Array<
  Pick<BusinessVerticalPreset, 'id' | 'label' | 'description' | 'icon' | 'suggestedAttendanceMode'>
> {
  return BUSINESS_VERTICAL_PRESETS.map(({ id, label, description, icon, suggestedAttendanceMode }) => ({
    id,
    label,
    description,
    icon,
    suggestedAttendanceMode,
  }));
}
