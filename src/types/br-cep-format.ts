/** Formatação e validação de CEP — sem I/O (seguro para tipos compartilhados com o frontend). */

export function normalizeCepDigits(cep: string): string {
  return cep.replace(/\D/g, '').slice(0, 8);
}

export function formatCepDisplay(cep: string): string {
  const d = normalizeCepDigits(cep);
  if (d.length !== 8) return cep.trim();
  return `${d.slice(0, 5)}-${d.slice(5)}`;
}

export function isValidCepDigits(cep: string): boolean {
  return normalizeCepDigits(cep).length === 8;
}
