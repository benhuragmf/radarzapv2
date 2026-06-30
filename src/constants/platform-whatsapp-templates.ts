/**
 * Catálogo oficial Plataforma → WhatsApp (prefixo pw-*).
 * Envios manuais, campanhas, aniversários, lembretes.
 */

export type PlatformWhatsAppKind =
  | 'birthday'
  | 'informative'
  | 'promo'
  | 'reminder'
  | 'custom'
  | 'auto';

export interface PlatformWhatsAppTemplateDef {
  name: string;
  platformKind: PlatformWhatsAppKind;
  label: string;
  description: string;
  content: string;
  variables: string[];
}

/** Variáveis documentadas para o painel e render */
export const PLATFORM_WA_VARIABLE_DOCS: Record<string, string> = {
  nome: 'Nome completo do contato ou destinatário',
  primeiro_nome: 'Primeiro nome do contato',
  empresa: 'Nome da empresa / organização no Radar Chat',
  aniversario: 'Data de aniversário (ex.: 15/03)',
  idade: 'Idade em anos (quando disponível)',
  mensagem: 'Corpo principal da mensagem (ou texto extra no modelo)',
  titulo: 'Título ou assunto da campanha',
  link: 'URL principal (site, cupom, formulário)',
  link_bloco: 'Link formatado (🔗 URL)',
  data: 'Data local (pt-BR)',
  hora: 'Hora local',
  timestamp: 'Data/hora ISO do envio',
  rodape: 'Rodapé padrão: empresa • data hora',
  autor: 'Quem envia (usuário ou marca da conta)',
  saudacao: 'Bom dia / Boa tarde / Boa noite (hora atual)',
  dia_semana: 'Dia da semana por extenso',
  mes: 'Mês atual por extenso',
  ano: 'Ano atual (4 dígitos)',
  telefone: 'Telefone do contato (mascarado ou E.164)',
  email: 'E-mail do contato (quando cadastrado)',
  desconto: 'Percentual ou texto de desconto',
  preco: 'Preço ou valor da oferta',
  validade: 'Validade da promo ou do cupom',
  evento: 'Nome do evento ou compromisso',
  local: 'Local do evento ou loja',
  cupom: 'Código promocional',
  grupos: 'Tags ou segmentos do contato',
};

export const PLATFORM_WHATSAPP_TEMPLATES: PlatformWhatsAppTemplateDef[] = [
  {
    name: 'pw-padrao',
    platformKind: 'auto',
    label: 'Padrão (campanha geral)',
    description: 'Formato genérico para qualquer envio da plataforma.',
    content: `📢 *{titulo}*

{mensagem}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'mensagem', 'link_bloco', 'rodape'],
  },
  {
    name: 'pw-aniversario',
    platformKind: 'birthday',
    label: 'Aniversário completo',
    description: 'Parabéns com nome, empresa e data de aniversário.',
    content: `🎂 *Feliz aniversário, {nome}!*

A equipe *{empresa}* deseja um dia incrível!

🎈 Aniversário: {aniversario}
{mensagem}

_{rodape}_`,
    variables: ['nome', 'empresa', 'aniversario', 'mensagem', 'rodape'],
  },
  {
    name: 'pw-aniversario-curto',
    platformKind: 'birthday',
    label: 'Aniversário curto',
    description: 'Mensagem rápida de parabéns.',
    content: `🎉 Parabéns, *{nome}*! 🎂

{mensagem}

— *{empresa}*`,
    variables: ['nome', 'mensagem', 'empresa'],
  },
  {
    name: 'pw-informativo',
    platformKind: 'informative',
    label: 'Informativo',
    description: 'Avisos, novidades e comunicados gerais.',
    content: `ℹ️ *{titulo}*

{mensagem}

_{rodape}_`,
    variables: ['titulo', 'mensagem', 'rodape'],
  },
  {
    name: 'pw-informativo-link',
    platformKind: 'informative',
    label: 'Informativo com link',
    description: 'Comunicado com call-to-action e URL.',
    content: `ℹ️ *{titulo}*

{mensagem}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'mensagem', 'link_bloco', 'rodape'],
  },
  {
    name: 'pw-promo',
    platformKind: 'promo',
    label: 'Promoção',
    description: 'Ofertas com preço, desconto e cupom.',
    content: `🏷️ *{titulo}*

{mensagem}

💰 {preco}
📉 {desconto}
🎟️ Cupom: *{cupom}*

{link_bloco}
⏳ Válido até: {validade}

_{rodape}_`,
    variables: [
      'titulo', 'mensagem', 'preco', 'desconto', 'cupom',
      'link_bloco', 'validade', 'rodape',
    ],
  },
  {
    name: 'pw-promo-flash',
    platformKind: 'promo',
    label: 'Promo relâmpago',
    description: 'Oferta urgente com validade curta.',
    content: `⚡ *PROMO RELÂMPAGO*

*{titulo}*

{mensagem}

{desconto} — {preco}

{link_bloco}

⏰ Até {validade}

_{rodape}_`,
    variables: ['titulo', 'mensagem', 'desconto', 'preco', 'link_bloco', 'validade', 'rodape'],
  },
  {
    name: 'pw-lembrete',
    platformKind: 'reminder',
    label: 'Lembrete',
    description: 'Lembrete simples com data e hora.',
    content: `🔔 *Lembrete*

Olá, *{nome}*!

{mensagem}

📅 {data} às {hora}

_{rodape}_`,
    variables: ['nome', 'mensagem', 'data', 'hora', 'rodape'],
  },
  {
    name: 'pw-lembrete-evento',
    platformKind: 'reminder',
    label: 'Lembrete de evento',
    description: 'Evento com local e horário.',
    content: `📅 *{evento}*

{mensagem}

📍 {local}
🕐 {data} — {hora}

{link_bloco}

_{rodape}_`,
    variables: ['evento', 'mensagem', 'local', 'data', 'hora', 'link_bloco', 'rodape'],
  },
  {
    name: 'pw-agradecimento',
    platformKind: 'informative',
    label: 'Agradecimento',
    description: 'Pós-compra ou pós-atendimento.',
    content: `🙏 *Obrigado, {nome}!*

{mensagem}

— *{empresa}*
_{rodape}_`,
    variables: ['nome', 'mensagem', 'empresa', 'rodape'],
  },
  {
    name: 'pw-convite',
    platformKind: 'informative',
    label: 'Convite',
    description: 'Convite para evento, live ou reunião.',
    content: `✉️ *Convite — {titulo}*

Olá, *{nome}*!

{mensagem}

📅 {data} • {hora}
📍 {local}

{link_bloco}

_{rodape}_`,
    variables: [
      'titulo', 'nome', 'mensagem', 'data', 'hora', 'local', 'link_bloco', 'rodape',
    ],
  },
  {
    name: 'pw-personalizado',
    platformKind: 'custom',
    label: 'Personalizado (base)',
    description: 'Estrutura mínima para copiar e adaptar.',
    content: `{mensagem}

_{rodape}_`,
    variables: ['mensagem', 'rodape'],
  },
];

export const PLATFORM_CATALOG_NAMES = new Set(
  PLATFORM_WHATSAPP_TEMPLATES.map(t => t.name),
);

export function isPlatformCatalogName(name: string): boolean {
  return PLATFORM_CATALOG_NAMES.has(name) || name.startsWith('pw-');
}

/** Renderiza do catálogo em código (não depende do Mongo desatualizado). */
export function renderPlatformCatalogTemplate(
  templateName: string,
  variables: Record<string, string>,
): string | null {
  const def = PLATFORM_WHATSAPP_TEMPLATES.find(
    t => t.name === templateName,
  );
  if (!def) return null;

  let rendered = def.content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }
  rendered = rendered.replace(/\{[^}]+\}/g, '');
  return rendered
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Variáveis de exemplo para pré-visualização no painel */
export const PLATFORM_WA_SAMPLE_VARS: Record<string, string> = {
  nome: 'Maria Silva',
  primeiro_nome: 'Maria',
  empresa: 'Radar Gamer',
  aniversario: '15/03',
  idade: '32',
  mensagem: 'Conteúdo da sua campanha ou aviso aqui.',
  titulo: 'Novidade da semana',
  link: 'https://exemplo.com/oferta',
  link_bloco: '🔗 https://exemplo.com/oferta',
  data: '04/06/2026',
  hora: '14:30',
  timestamp: '2026-06-04T14:30:00.000Z',
  rodape: 'Radar Gamer • 04/06/2026 14:30',
  autor: 'Equipe Marketing',
  saudacao: 'Boa tarde',
  dia_semana: 'quinta-feira',
  mes: 'junho',
  ano: '2026',
  telefone: '+55 11 99999-0000',
  email: 'maria@exemplo.com',
  desconto: '30% OFF',
  preco: 'R$ 49,90',
  validade: '10/06/2026',
  evento: 'Live especial',
  local: 'Canal oficial',
  cupom: 'RADAR30',
  grupos: 'vip; clientes',
};

export function previewPlatformTemplateContent(content: string): string {
  let out = content;
  for (const [k, v] of Object.entries(PLATFORM_WA_SAMPLE_VARS)) {
    out = out.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  return out.replace(/\{[^}]+\}/g, '').trim();
}
