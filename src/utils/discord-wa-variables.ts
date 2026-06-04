import type { ExtractedMessage } from '@/services/discord-bot/MessageExtractor';

import {

  pickBestLink,

  sanitizeDiscordForWhatsApp,

  type StoreButton,

} from '@/utils/discord-capture';

import {

  buildRodape,

  collectPrimaryLink,

  extractCreatorSlugFromUrl,

  formatLinkBlock,

  platformLabelFromLink,

  resolveStreamerIdentity,

} from '@/utils/discord-wa-format';



const URL_IN_TEXT = /https?:\/\/[^\s]+/gi;



function stripUrls(text: string): string {

  return text.replace(URL_IN_TEXT, '').replace(/\s+/g, ' ').trim();

}

/** WhatsApp trata linhas com ">" como citação — evita título duplicado visualmente */
function escapeWhatsAppQuoteLines(text: string): string {
  return text
    .split('\n')
    .map(line => (/^>\s?/.test(line) ? line.replace(/^>\s?/, '▸ ') : line))
    .join('\n');
}



export function formatButtonsAsOptions(buttons: StoreButton[]): string {

  if (!buttons.length) return '';

  const lines = ['*Opções — responda com o número:*'];

  buttons.slice(0, 9).forEach((b, i) => {

    const n = i + 1;

    lines.push(`${n}️⃣ *${b.label}*`);

    lines.push(`   ${b.url}`);

  });

  return lines.join('\n');

}



export function formatAttachmentList(

  files: Array<{ name: string; url: string }>

): string {

  if (!files.length) return '';

  return files.map(f => `📎 *${f.name}*\n${f.url}`).join('\n\n');

}



export interface DiscordWaPayload {

  variables: Record<string, string>;

  primaryImage?: string;

  extraImages: string[];

}



export function buildDiscordWhatsAppVariables(extracted: ExtractedMessage): DiscordWaPayload {

  const now = new Date();

  const data = now.toLocaleDateString('pt-BR');

  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });



  const buttons = extracted.storeButtons ?? [];

  const opcoesBotoes = formatButtonsAsOptions(buttons);

  const linkPrincipal = collectPrimaryLink(extracted) || pickBestLink(extracted.links ?? []) || '';



  const linksLojas =

    extracted.linksSection ||

    buttons

      .slice(0, 8)

      .map(b => `🔗 *${b.label}:*\n${b.url}`)

      .join('\n\n') ||

    formatLinkBlock(linkPrincipal);



  const rawText = extracted.text?.trim() ?? '';

  const mensagemCurta = sanitizeDiscordForWhatsApp(stripUrls(rawText));



  let corpo =

    extracted.whatsappBody ||

    extracted.fullEmbedText ||

    extracted.embedFieldsText ||

    mensagemCurta ||

    '';



  const kind = extracted.captureKind ?? '';

  const embedTitle = extracted.embedTitles?.[0] ?? '';
  const embedDesc = extracted.embedDescriptions?.[0] ?? '';
  const textTitle =
    extracted.text?.split('\n').find(l => l.trim())?.slice(0, 200) ?? '';
  const isTitleChannelName = /[-–]\s*(Twitch|YouTube|Twitch\.tv)$/i.test(embedTitle);
  const descLines = embedDesc
    .split('\n')
    .filter(l => l.trim() && !/^https?:\/\//i.test(l.trim()));
  const descClean = descLines.join('\n').trim();
  let descricao = escapeWhatsAppQuoteLines(
    (descClean || mensagemCurta || '').slice(0, 3800),
  );

  if (kind === 'video' || kind === 'live' || kind === 'short') {

    const parts: string[] = [];

    if (mensagemCurta) parts.push(mensagemCurta);
    else if (descClean) parts.push(descClean);

    if (kind === 'live' && extracted.embedGame) parts.push(`🎮 ${extracted.embedGame}`);

    if (kind === 'live' && extracted.embedViewers) parts.push(`👀 ${extracted.embedViewers}`);

    corpo = parts.join('\n\n') || corpo;

    if (kind === 'live') {
      descricao = escapeWhatsAppQuoteLines(corpo.slice(0, 3800));
    }

  }



  const listaConteudo =

    extracted.captureKind === 'embed_list' && extracted.embedFieldsText

      ? extracted.embedFieldsText

      : corpo;

  let titulo = isTitleChannelName

    ? descClean.split('\n').find(l => l.trim()) || embedTitle

    : embedTitle || textTitle || descClean.split('\n')[0] || extracted.authorName || '';



  const streamer = resolveStreamerIdentity(extracted, linkPrincipal);
  const slugFromLink = extractCreatorSlugFromUrl(linkPrincipal);

  if (/^https?:\/\//i.test(titulo.trim()) || (!titulo.trim() && slugFromLink)) {
    const platformLabel = platformLabelFromLink(linkPrincipal);
    titulo = slugFromLink
      ? `${slugFromLink} - ${platformLabel}`
      : streamer
        ? `${streamer} - ${platformLabel}`
        : 'Live';
  }



  const isTwitch = /twitch\.tv/i.test(linkPrincipal);
  const isYoutube = /youtube\.com|youtu\.be/i.test(linkPrincipal);
  const isTiktok = /tiktok\.com/i.test(linkPrincipal);
  const isKick = /kick\.com/i.test(linkPrincipal);

  const plataforma = isTwitch
    ? 'Twitch'
    : isYoutube
      ? 'YouTube'
      : isTiktok
        ? 'TikTok'
        : isKick
          ? 'Kick'
          : kind === 'news'
            ? 'Notícias'
            : '';



  const imageUrls = extracted.imageUrls ?? [];

  const primaryImage = extracted.embedThumbnail || imageUrls[0] || '';

  const extraImages = imageUrls.filter(u => u !== primaryImage).slice(0, 3);



  const anexos = formatAttachmentList(extracted.attachmentFiles ?? []);

  const rodape = buildRodape(extracted, data, hora);

  const linkBloco = formatLinkBlock(linkPrincipal);

  const canalHash = extracted.channelName

    ? `#${extracted.channelName.replace(/^#/, '')}`

    : '';



  const blob = `${titulo} ${corpo} ${embedDesc}`.toLowerCase();

  const precoMatch = blob.match(/r\$\s*[\d.,]+|\$\s*[\d.,]+/i);

  const descontoMatch = blob.match(/\d+\s*%\s*(?:off|desconto)?/i);



  const storeLabel =

    extracted.embedStoreLabels?.[0]?.replace(/\s*\(\d+\s*jogos?\)\s*/i, '').trim() || '';



  const variables: Record<string, string> = {

    titulo,

    corpo: corpo.slice(0, 3800),

    conteudo: corpo.slice(0, 3800),

    mensagem: mensagemCurta || listaConteudo.slice(0, 3800) || corpo.slice(0, 3800),

    mensagem_curta: (mensagemCurta || descClean).slice(0, 500),

    descricao,

    lista_conteudo: listaConteudo.slice(0, 3800),

    lista_jogos: listaConteudo.slice(0, 3800),

    embed_titulo: embedTitle,

    embed_descricao: embedDesc,

    embed_desc: embedDesc,

    autor: (streamer || 'radarzap').toLowerCase(),

    canal: extracted.channelName ?? '',

    canal_hash: canalHash,

    servidor: extracted.guildName ?? '',

    data,

    hora,

    timestamp: now.toISOString(),

    rodape,

    link_bloco: linkBloco,

    link_principal: linkPrincipal,

    link: linkPrincipal,

    links: linksLojas,

    links_lojas: linksLojas,

    opcoes_botoes: opcoesBotoes,

    anexos,

    imagem: primaryImage,

    imagens_extra: extraImages.join('\n'),

    streamer: streamer.toLowerCase() || titulo.toLowerCase(),

    jogo: extracted.embedGame ?? '',

    viewers: extracted.embedViewers ?? '',

    plataforma,

    preco: precoMatch?.[0] ?? '',

    desconto: descontoMatch?.[0] ?? '',

    loja: storeLabel,

    thumbnail: primaryImage,

    title: titulo,

    message: corpo,

    purchaseLink: linkPrincipal,

    store: storeLabel,

  };



  return { variables, primaryImage: primaryImage || undefined, extraImages };

}


