/**
 * Catálogo oficial Discord → WhatsApp (prefixo dw-).
 * Cada entrada = um tipo de post que o Discord pode gerar.
 */

import { classifyLinkUrl } from '@/utils/link-content-classifier';

export type DiscordWhatsAppKind =
  | 'text'
  | 'embed'
  | 'embed_list'
  | 'live'
  | 'video'
  | 'short'
  | 'news'
  | 'promo'
  | 'alert'
  | 'log'
  | 'media'
  | 'file'
  | 'poll'
  | 'mixed';

export interface DiscordWhatsAppTemplateDef {
  name: string;
  discordKind: DiscordWhatsAppKind | 'auto';
  label: string;
  description: string;
  content: string;
  variables: string[];
}

/** Variáveis documentadas para o painel e regras */
export const DISCORD_WA_VARIABLE_DOCS: Record<string, string> = {
  titulo: 'Título principal (embed ou primeira linha)',
  corpo: 'Texto formatado completo para WhatsApp',
  conteudo: 'Mesmo que corpo (alias)',
  mensagem: 'Corpo resumido ou texto da mensagem',
  mensagem_curta: 'Texto do post sem URLs (ex.: aviso @todos)',
  lista_conteudo: 'Blocos de fields (listas por loja, itens)',
  embed_titulo: 'Título do embed Discord',
  embed_descricao: 'Descrição do embed',
  autor: 'Conta ou empresa Radar Chat (painel Google/Discord)',
  discord_poster: 'Quem postou no canal (ex.: @\'Skulks)',
  canal_rota: 'Poster + canal (ex.: @\'Skulks > #live-on)',
  canal: 'Nome do canal',
  servidor: 'Nome do servidor',
  data: 'Data local (pt-BR)',
  hora: 'Hora local',
  link_principal: 'Melhor link (loja, live, etc.)',
  link_bloco: 'Link formatado (🔗 URL)',
  rodape: 'Tenant via radarchat • @poster > #canal • servidor • data hora',
  links_lojas: 'Links formatados das lojas',
  opcoes_botoes: 'Botões Discord como opções 1, 2, 3…',
  anexos: 'Lista de arquivos anexados (nome + link)',
  imagem: 'URL da imagem principal (thumbnail/embed)',
  imagens_extra: 'Outras imagens detectadas',
  streamer: 'Nome do streamer (live)',
  descricao: 'Descrição do embed ou texto (live/vídeo)',
  jogo: 'Jogo (live/embed)',
  viewers: 'Espectadores (live)',
  plataforma: 'Twitch / YouTube / etc.',
  preco: 'Preço detectado na promoção',
  loja: 'Loja / plataforma da promo',
  desconto: 'Percentual ou texto de desconto',
  usuario: 'Membro Discord do evento',
  usuario_id: 'ID Discord do membro',
  canal_voz: 'Nome do canal de voz (#…)',
  acao: 'Descrição da ação (entrou, saiu, banido…)',
  moderador: 'Moderador (kick/ban via audit log)',
  motivo: 'Motivo do kick/ban quando disponível',
  membros_no_canal: 'Quantidade de membros na chamada ou servidor',
};

export const DISCORD_WHATSAPP_TEMPLATES: DiscordWhatsAppTemplateDef[] = [
  {
    name: 'dw-padrao',
    discordKind: 'auto',
    label: 'Padrão (escolhe o formato sozinho)',
    description: 'Roteador automático conforme o tipo de post no Discord.',
    content: `📢 *{titulo}*

{corpo}

{opcoes_botoes}

{anexos}

{link_bloco}

_{rodape}_`,
    variables: [
      'titulo', 'corpo', 'opcoes_botoes', 'anexos', 'link_bloco', 'rodape',
    ],
  },
  {
    name: 'dw-texto',
    discordKind: 'text',
    label: 'Texto simples',
    description: 'Mensagem só com texto (sem embed relevante).',
    content: `💬 *{canal_hash}*

{corpo}

{link_bloco}

_{rodape}_`,
    variables: ['canal_hash', 'corpo', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-embed',
    discordKind: 'embed',
    label: 'Embed / artigo',
    description: 'Post com embed (título, descrição, link).',
    content: `📰 *{embed_titulo}*

{corpo}

{opcoes_botoes}

{link_bloco}

_{rodape}_`,
    variables: ['embed_titulo', 'corpo', 'opcoes_botoes', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-lista',
    discordKind: 'embed_list',
    label: 'Lista (fields)',
    description: 'Listas com blocos por loja/categoria (ex.: jogos grátis).',
    content: `📋 *{titulo}*

{lista_conteudo}

{opcoes_botoes}

{anexos}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'lista_conteudo', 'opcoes_botoes', 'anexos', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-live',
    discordKind: 'live',
    label: 'Live',
    description: 'Alerta de transmissão ao vivo (Twitch, YouTube, etc.).',
    content: `🔴 *{streamer} está ao vivo!*

{descricao}

{opcoes_botoes}

{link_bloco}

_{rodape}_`,
    variables: [
      'streamer', 'descricao', 'opcoes_botoes', 'link_bloco', 'rodape',
    ],
  },
  {
    name: 'dw-video',
    discordKind: 'video',
    label: 'Vídeo',
    description: 'Embed de vídeo (YouTube, etc.) que não é live.',
    content: `▶️ *Novo vídeo* — {plataforma}

*{titulo}*

{mensagem_curta}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'mensagem_curta', 'link_bloco', 'plataforma', 'rodape'],
  },
  {
    name: 'dw-short',
    discordKind: 'short',
    label: 'Short',
    description: 'YouTube Shorts, clip Twitch, vídeo vertical curto.',
    content: `📱 *Short* — {plataforma}

*{titulo}*

{mensagem_curta}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'mensagem_curta', 'link_bloco', 'plataforma', 'rodape'],
  },
  {
    name: 'dw-noticia',
    discordKind: 'news',
    label: 'Notícia / artigo',
    description: 'Links de sites de notícias ou embed de artigo.',
    content: `📰 *{embed_titulo}*

{corpo}

{link_bloco}

_{rodape}_`,
    variables: ['embed_titulo', 'corpo', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-promo',
    discordKind: 'promo',
    label: 'Promoção',
    description: 'Ofertas, descontos e preços.',
    content: `🏷️ *{titulo}*

{corpo}

💰 {preco}
📉 {desconto}
🏪 {loja}

{opcoes_botoes}

{link_bloco}

_{rodape}_`,
    variables: [
      'titulo', 'corpo', 'preco', 'desconto', 'loja', 'opcoes_botoes',
      'link_bloco', 'rodape',
    ],
  },
  {
    name: 'dw-alerta',
    discordKind: 'alert',
    label: 'Alerta',
    description: 'Avisos urgentes, manutenção, ping importante.',
    content: `🚨 *ALERTA*

*{titulo}*

{corpo}

{opcoes_botoes}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'opcoes_botoes', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-log',
    discordKind: 'log',
    label: 'Log / sistema',
    description: 'Mensagens de bot, auditoria, eventos de sistema.',
    content: `📋 *LOG* — #{canal}

*{titulo}*

{corpo}

_{rodape}_`,
    variables: ['canal', 'titulo', 'corpo', 'rodape'],
  },
  {
    name: 'dw-midia',
    discordKind: 'media',
    label: 'Mídia (imagem)',
    description: 'Foco em imagem/thumbnail; legenda no WhatsApp.',
    content: `{corpo}

{opcoes_botoes}

_{rodape}_`,
    variables: ['corpo', 'opcoes_botoes', 'rodape', 'imagem'],
  },
  {
    name: 'dw-arquivo',
    discordKind: 'file',
    label: 'Arquivos',
    description: 'Anexos de arquivo (PDF, zip, etc.).',
    content: `📎 *{titulo}*

{corpo}

{anexos}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'anexos', 'rodape'],
  },
  {
    name: 'dw-poll',
    discordKind: 'poll',
    label: 'Enquete',
    description: 'Resultado ou enquete do Discord.',
    content: `📊 *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'rodape'],
  },
  {
    name: 'dw-misto',
    discordKind: 'mixed',
    label: 'Misto',
    description: 'Texto + embed + anexos na mesma mensagem.',
    content: `📢 *{titulo}*

{corpo}

{anexos}

{opcoes_botoes}

{link_bloco}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'anexos', 'opcoes_botoes', 'link_bloco', 'rodape'],
  },
  {
    name: 'dw-voice-join',
    discordKind: 'alert',
    label: 'Entrada em chamada de voz',
    description: 'Quando alguém entra em um canal de voz monitorado.',
    content: `🔊 *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'canal_voz', 'membros_no_canal', 'rodape'],
  },
  {
    name: 'dw-voice-leave',
    discordKind: 'alert',
    label: 'Saída de chamada de voz',
    description: 'Quando alguém sai de um canal de voz monitorado.',
    content: `🔇 *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'canal_voz', 'membros_no_canal', 'rodape'],
  },
  {
    name: 'dw-member-join',
    discordKind: 'alert',
    label: 'Membro entrou no servidor',
    description: 'Novo membro no servidor Discord.',
    content: `✅ *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'servidor', 'membros_no_canal', 'rodape'],
  },
  {
    name: 'dw-member-leave',
    discordKind: 'alert',
    label: 'Membro saiu do servidor',
    description: 'Membro saiu voluntariamente.',
    content: `👋 *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'servidor', 'rodape'],
  },
  {
    name: 'dw-member-kick',
    discordKind: 'alert',
    label: 'Membro removido (kick)',
    description: 'Membro expulso do servidor.',
    content: `⛔ *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'moderador', 'motivo', 'rodape'],
  },
  {
    name: 'dw-member-ban',
    discordKind: 'alert',
    label: 'Membro banido',
    description: 'Banimento no servidor Discord.',
    content: `🚫 *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'moderador', 'motivo', 'rodape'],
  },
  {
    name: 'dw-message-edit',
    discordKind: 'alert',
    label: 'Mensagem editada',
    description: 'Quando alguém edita uma mensagem em canal monitorado.',
    content: `✏️ *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'mensagem_preview', 'conteudo_anterior', 'rodape'],
  },
  {
    name: 'dw-message-reaction',
    discordKind: 'alert',
    label: 'Nova reação',
    description: 'Quando alguém reage a uma mensagem em canal monitorado.',
    content: `{emoji} *{titulo}*

{corpo}

_{rodape}_`,
    variables: ['titulo', 'corpo', 'usuario', 'emoji', 'mensagem_preview', 'rodape'],
  },
];

/** Templates legados → novo nome (regras antigas continuam funcionando) */
export const LEGACY_TEMPLATE_ALIASES: Record<string, string> = {
  'radarchat-padrao': 'dw-padrao',
  'radarchat-simples': 'dw-texto',
  'radarchat-com-embed': 'dw-embed',
  'radarchat-jogos-gratis': 'dw-lista',
  'radarchat-live': 'dw-live',
  'radarchat-alerta': 'dw-alerta',
  'game-free': 'dw-lista',
  'game-promotion-basic': 'dw-promo',
  'game-promotion-discount': 'dw-promo',
  'custom-message': 'dw-texto',
};

export const AUTO_ROUTER_TEMPLATES = new Set([
  'dw-padrao',
  'dw-auto',
  'radarchat-padrao',
  'radarchat-simples',
  'custom-message',
]);

const FIXED_LIVE_TEMPLATES = new Set(['dw-live', 'radarchat-live']);

/** Normaliza nomes de template gravados antes do rebrand (prefixo legado). */
export function normalizeLegacyTemplateName(templateName: string): string {
  const trimmed = templateName.trim();
  if (/^radarzap-/i.test(trimmed)) {
    return trimmed.replace(/^radarzap-/i, 'radarchat-');
  }
  return trimmed;
}

export interface ResolveTemplateContext {
  channelName?: string;
  hasTwitchOrYoutubeLink?: boolean;
  primaryLink?: string;
}

export function resolveTemplateForCapture(
  ruleTemplate: string,
  captureKind: string,
  ctx: ResolveTemplateContext = {}
): string {
  const ruleKey = normalizeLegacyTemplateName(ruleTemplate);
  const normalized = LEGACY_TEMPLATE_ALIASES[ruleKey] ?? ruleKey;
  const liveChannel = /live-on|live_on/i.test(ctx.channelName ?? '');

  const kindToTemplate = (kind: string): string | null => {
    const map: Record<string, string> = {
      live: 'dw-live',
      video: 'dw-video',
      short: 'dw-short',
      news: 'dw-noticia',
    };
    return map[kind] ?? null;
  };

  const primary = ctx.primaryLink?.trim() ?? '';
  const linkKind = primary ? classifyLinkUrl(primary) : 'unknown';
  const hasClassifiedLink = primary.length > 0 && linkKind !== 'unknown';

  const templateForStreamLink = (): string | null => {
    if (!hasClassifiedLink) return null;
    return templateForLinkKind(linkKind);
  };

  function templateForLinkKind(kind: typeof linkKind): string | null {
    if (kind === 'live') return 'dw-live';
    if (kind === 'video') return 'dw-video';
    if (kind === 'short') return 'dw-short';
    return null;
  }

  const streamFromUrl = templateForStreamLink();
  if (streamFromUrl && captureKind !== 'embed_list') {
    return streamFromUrl;
  }

  const streamTemplate = kindToTemplate(captureKind);
  if (streamTemplate && captureKind !== 'embed_list') {
    return streamTemplate;
  }

  const preferLiveInLiveChannel = (kind: string): string | null => {
    if (!liveChannel) return null;
    const fromUrl = templateForStreamLink();
    if (fromUrl) return fromUrl;
    const routed = kindToTemplate(kind);
    if (routed) return routed;
    if (kind === 'embed_list') return 'dw-lista';
    return null;
  };

  // Regra com template "live" fixo: ainda respeita vídeo / lista
  if (FIXED_LIVE_TEMPLATES.has(normalized) || FIXED_LIVE_TEMPLATES.has(ruleTemplate)) {
    const liveOverride = preferLiveInLiveChannel(captureKind);
    if (liveOverride) return liveOverride;
    if (captureKind === 'video') return 'dw-video';
    if (captureKind === 'embed_list') return 'dw-lista';
    const streamTpl = templateForStreamLink();
    if (streamTpl) return streamTpl;
    if (captureKind === 'text' || captureKind === 'plain') return 'dw-texto';
    if (captureKind === 'embed' || captureKind === 'mixed') {
      if (linkKind === 'video') return 'dw-video';
      if (linkKind === 'short') return 'dw-short';
      return 'dw-embed';
    }
    if (linkKind === 'live') return 'dw-live';
    return 'dw-padrao';
  }

  const isAuto = AUTO_ROUTER_TEMPLATES.has(ruleTemplate) || AUTO_ROUTER_TEMPLATES.has(normalized);

  if (!isAuto) {
    if (liveChannel) {
      const streamTpl = templateForStreamLink();
      if (streamTpl) return streamTpl;
    }
    return normalized;
  }

  const liveOverride = preferLiveInLiveChannel(captureKind);
  if (liveOverride) return liveOverride;

  const map: Record<string, string> = {
    embed_list: 'dw-lista',
    live: 'dw-live',
    video: 'dw-video',
    short: 'dw-short',
    news: 'dw-noticia',
    promo: 'dw-promo',
    alert: 'dw-alerta',
    log: 'dw-log',
    media: 'dw-midia',
    file: 'dw-arquivo',
    poll: 'dw-poll',
    mixed: 'dw-misto',
    embed: 'dw-embed',
    embed_article: 'dw-embed',
    text: 'dw-texto',
    plain: 'dw-texto',
  };

  return map[captureKind] ?? 'dw-padrao';
}

/** Renderiza sempre do catálogo em código (não depende do Mongo desatualizado). */
export function renderCatalogTemplate(
  templateName: string,
  variables: Record<string, string>
): string | null {
  const templateKey = normalizeLegacyTemplateName(templateName);
  const normalized = LEGACY_TEMPLATE_ALIASES[templateKey] ?? templateKey;
  const def = DISCORD_WHATSAPP_TEMPLATES.find(
    t => t.name === normalized || t.name === templateKey
  );
  if (!def) return null;

  let rendered = def.content;
  for (const [key, value] of Object.entries(variables)) {
    rendered = rendered.replace(new RegExp(`\\{${key}\\}`, 'g'), String(value ?? ''));
  }
  rendered = rendered.replace(/\{[^}]+\}/g, '');
  return rendered
    .replace(/^🎮\s*$/gm, '')
    .replace(/^👀\s*$/gm, '')
    .replace(/^📺\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}
