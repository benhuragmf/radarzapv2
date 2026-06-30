/** Consulta CEP brasileiro (ViaCEP). */

export interface BrCepLookupResult {
  cep: string;
  street: string;
  neighborhood: string;
  city: string;
  state: string;
  complement?: string;
}

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

/** Busca endereço por CEP. Retorna null se inválido ou não encontrado. */
export async function lookupBrCep(cep: string): Promise<BrCepLookupResult | null> {
  const digits = normalizeCepDigits(cep);
  if (digits.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as {
      erro?: boolean;
      cep?: string;
      logradouro?: string;
      bairro?: string;
      localidade?: string;
      uf?: string;
      complemento?: string;
    };
    if (data.erro || !data.localidade || !data.uf) return null;
    return {
      cep: formatCepDisplay(data.cep ?? digits),
      street: data.logradouro?.trim() ?? '',
      neighborhood: data.bairro?.trim() ?? '',
      city: data.localidade.trim(),
      state: data.uf.trim().toUpperCase(),
      complement: data.complemento?.trim() || undefined,
    };
  } catch {
    return null;
  }
}
