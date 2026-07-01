/** Reconfirma nome após 30 dias sem contato (troca de chip / outra pessoa). */
export const AI_NAME_RECONFIRM_AFTER_MS = 30 * 24 * 60 * 60 * 1000;

export function resolveRegistryNameFromDestination(dest: {
  name?: string | null;
  identifier?: string | null;
}): string | undefined {
  const name = dest.name?.trim();
  if (!name) return undefined;
  const idNorm = dest.identifier?.replace(/\D/g, '') ?? '';
  if (idNorm && name.replace(/\D/g, '') === idNorm) return undefined;
  return name;
}

/** Uma palavra: 1ª e última letra em maiúsculo; * = letras ocultas no meio. */
function maskRegisteredNameWord(word: string): string {
  if (!word) return '';
  if (word.length === 1) return word[0].toUpperCase();
  if (word.length === 2) {
    return `${word[0].toUpperCase()}${word[1].toUpperCase()}`;
  }
  const hidden = word.length - 2;
  return `${word[0].toUpperCase()}${'*'.repeat(hidden)}${word[word.length - 1].toUpperCase()}`;
}

/**
 * Mascara o nome exatamente como cadastrado — sem completar partes faltantes.
 * Cada palavra: primeira e última letra visíveis (maiúsculas); meio com `*` proporcional.
 */
export function maskContactDisplayName(fullName: string): string {
  const trimmed = fullName.trim();
  if (!trimmed) return '*';

  const parts = trimmed.split(/(\s+)/);
  return parts
    .map(part => (/^\s+$/.test(part) ? part : maskRegisteredNameWord(part)))
    .join('');
}

export function shouldReconfirmContactName(
  lastContactAt: Date | null | undefined,
  now = new Date(),
): boolean {
  if (!lastContactAt) return true;
  return now.getTime() - lastContactAt.getTime() > AI_NAME_RECONFIRM_AFTER_MS;
}
