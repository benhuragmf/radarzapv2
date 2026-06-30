import type { IDestination } from '@/models/Destination';
import type { IOrganization } from '@/models/Organization';
import type { IUser } from '@/models/User';
import {
  computeAgeYears,
  formatBirthdayPtBr,
} from '@/utils/birthday-match';
import { resolveTenantSenderLabel } from '@/utils/radarchat-sender';

const WEEKDAY_PT = [
  'domingo',
  'segunda-feira',
  'terça-feira',
  'quarta-feira',
  'quinta-feira',
  'sexta-feira',
  'sábado',
] as const;

function greetingForHour(hour: number): string {
  if (hour >= 5 && hour < 12) return 'Bom dia';
  if (hour >= 12 && hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

function firstName(fullName: string): string {
  const part = fullName.trim().split(/\s+/)[0];
  return part || 'Cliente';
}

export interface PlatformWaVariableContext {
  mensagem?: string;
  titulo?: string;
  link?: string;
  telefone?: string;
  desconto?: string;
  preco?: string;
  validade?: string;
  evento?: string;
  local?: string;
  cupom?: string;
}

function maskPhone(identifier: string): string {
  const digits = identifier.replace(/\D/g, '');
  if (digits.length < 8) return identifier;
  const tail = digits.slice(-4);
  const cc = digits.length > 10 ? `+${digits.slice(0, digits.length - 10)} ` : '';
  return `${cc}***${tail}`;
}

function formatLinkBlock(url: string): string {
  const u = url.trim();
  if (!u) return '';
  return `🔗 ${u}`;
}

function buildRodape(empresa: string, data: string, hora: string): string {
  return `${empresa} • ${data} ${hora}`;
}

/**
 * Variáveis para render pw-* em envio 1:1 (contato/grupo).
 * Espelha o espírito de buildDiscordWhatsAppVariables, sem payload Discord.
 */
export function buildPlatformWhatsAppVariables(
  destination: Pick<IDestination, 'name' | 'identifier' | 'type' | 'birthday' | 'tags' | 'email'>,
  org: Pick<IOrganization, 'name'> | null | undefined,
  user: Pick<IUser, 'displayName' | 'email' | 'discordUserId'> | null | undefined,
  extra?: PlatformWaVariableContext,
): Record<string, string> {
  const now = new Date();
  const data = now.toLocaleDateString('pt-BR');
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const empresa = resolveTenantSenderLabel(org, user);
  const autor = resolveTenantSenderLabel(org, user);
  const nome = destination.name?.trim() || 'Cliente';
  const aniversario = destination.birthday
    ? formatBirthdayPtBr(destination.birthday)
    : '';
  const idade =
    destination.birthday && computeAgeYears(destination.birthday, now) != null
      ? String(computeAgeYears(destination.birthday, now))
      : '';
  const link = extra?.link?.trim() ?? '';
  const mensagem = extra?.mensagem?.trim() ?? '';
  const titulo = extra?.titulo?.trim() ?? '';
  const grupos = (destination.tags ?? []).join('; ');
  const primeiro_nome = firstName(nome);
  const dia_semana = WEEKDAY_PT[now.getDay()] ?? '';
  const mes = now.toLocaleDateString('pt-BR', { month: 'long' });
  const ano = String(now.getFullYear());
  const saudacao = greetingForHour(now.getHours());

  return {
    nome,
    primeiro_nome,
    empresa,
    aniversario,
    idade,
    mensagem,
    titulo,
    link,
    link_bloco: formatLinkBlock(link),
    data,
    hora,
    timestamp: now.toISOString(),
    rodape: buildRodape(empresa, data, hora),
    autor,
    saudacao,
    dia_semana,
    mes,
    ano,
    telefone:
      extra?.telefone?.trim() ||
      (destination.type === 'contact' ? maskPhone(destination.identifier) : ''),
    desconto: extra?.desconto?.trim() ?? '',
    preco: extra?.preco?.trim() ?? '',
    validade: extra?.validade?.trim() ?? '',
    evento: extra?.evento?.trim() ?? '',
    local: extra?.local?.trim() ?? '',
    cupom: extra?.cupom?.trim() ?? '',
    grupos,
    email: destination.email?.trim() ?? '',
  };
}

/**
 * Variáveis para pré-visualização no painel quando não há destino selecionado.
 * Usa dados reais da organização/conta e amostras para campos do contato.
 */
export function buildPlatformPreviewSampleVariables(
  org: Pick<IOrganization, 'name'> | null | undefined,
  user: Pick<IUser, 'displayName' | 'email' | 'discordUserId'> | null | undefined,
  extra?: PlatformWaVariableContext,
): Record<string, string> {
  const now = new Date();
  const data = now.toLocaleDateString('pt-BR');
  const hora = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  const empresa = resolveTenantSenderLabel(org, user);
  const autor = resolveTenantSenderLabel(org, user);
  const nome = 'Maria Silva';
  const link = extra?.link?.trim() || 'https://exemplo.com/oferta';
  const mensagem =
    extra?.mensagem?.trim() ||
    'Conteúdo da sua campanha ou aviso aqui.';

  return {
    nome,
    primeiro_nome: firstName(nome),
    empresa,
    aniversario: '15/03',
    idade: '32',
    mensagem,
    titulo: extra?.titulo?.trim() || 'Novidade da semana',
    link,
    link_bloco: formatLinkBlock(link),
    data,
    hora,
    timestamp: now.toISOString(),
    rodape: buildRodape(empresa, data, hora),
    autor,
    saudacao: greetingForHour(now.getHours()),
    dia_semana: WEEKDAY_PT[now.getDay()] ?? '',
    mes: now.toLocaleDateString('pt-BR', { month: 'long' }),
    ano: String(now.getFullYear()),
    telefone: '+55 11 99999-0000',
    desconto: extra?.desconto?.trim() || '30% OFF',
    preco: extra?.preco?.trim() || 'R$ 49,90',
    validade: extra?.validade?.trim() || '10/06/2026',
    evento: extra?.evento?.trim() || 'Live especial',
    local: extra?.local?.trim() || 'Canal oficial',
    cupom: extra?.cupom?.trim() || 'RADAR30',
    grupos: 'vip; clientes',
    email: 'maria@exemplo.com',
  };
}
