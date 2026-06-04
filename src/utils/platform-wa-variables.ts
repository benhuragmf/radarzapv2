import type { IDestination } from '@/models/Destination';
import type { IOrganization } from '@/models/Organization';
import type { IUser } from '@/models/User';
import {
  computeAgeYears,
  formatBirthdayPtBr,
} from '@/utils/birthday-match';
import { resolveTenantSenderLabel } from '@/utils/radarzap-sender';

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

  return {
    nome,
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
