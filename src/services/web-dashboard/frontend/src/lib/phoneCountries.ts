export interface PhoneCountry {
  iso: string
  name: string
  dial: string
  flag: string
}

/** Emoji de bandeira a partir do código ISO 3166-1 alpha-2 (ex: BR → 🇧🇷). */
export function countryFlag(iso: string): string {
  return iso
    .toUpperCase()
    .replace(/[A-Z]/g, char => String.fromCodePoint(127397 + char.charCodeAt(0)))
}

const COUNTRY_DEFS: Array<[iso: string, name: string, dial: string]> = [
  ['BR', 'Brasil', '55'],
  ['US', 'Estados Unidos', '1'],
  ['PT', 'Portugal', '351'],
  ['AR', 'Argentina', '54'],
  ['PY', 'Paraguai', '595'],
  ['UY', 'Uruguai', '598'],
  ['MX', 'México', '52'],
  ['CO', 'Colômbia', '57'],
  ['CL', 'Chile', '56'],
  ['PE', 'Peru', '51'],
  ['BO', 'Bolívia', '591'],
  ['EC', 'Equador', '593'],
  ['VE', 'Venezuela', '58'],
  ['ES', 'Espanha', '34'],
  ['DE', 'Alemanha', '49'],
  ['FR', 'França', '33'],
  ['GB', 'Reino Unido', '44'],
  ['IT', 'Itália', '39'],
  ['CA', 'Canadá', '1'],
  ['AO', 'Angola', '244'],
  ['MZ', 'Moçambique', '258'],
  ['CV', 'Cabo Verde', '238'],
  ['JP', 'Japão', '81'],
  ['CN', 'China', '86'],
  ['IN', 'Índia', '91'],
]

export const PHONE_COUNTRIES: PhoneCountry[] = COUNTRY_DEFS.map(([iso, name, dial]) => ({
  iso,
  name,
  dial,
  flag: countryFlag(iso),
}))

export const DEFAULT_PHONE_COUNTRY = PHONE_COUNTRIES[0]!

const BY_DIAL_LENGTH = [...PHONE_COUNTRIES].sort((a, b) => b.dial.length - a.dial.length)

export function findCountryByIso(iso: string): PhoneCountry | undefined {
  return PHONE_COUNTRIES.find(c => c.iso === iso)
}

export function detectCountryFromE164(value: string): PhoneCountry {
  const digits = value.replace(/\D/g, '')
  if (!digits) return DEFAULT_PHONE_COUNTRY
  for (const country of BY_DIAL_LENGTH) {
    if (digits.startsWith(country.dial)) return country
  }
  return DEFAULT_PHONE_COUNTRY
}

export function nationalDigitsFromE164(value: string, dial: string): string {
  const digits = value.replace(/\D/g, '')
  if (digits.startsWith(dial)) return digits.slice(dial.length)
  return digits
}

export function buildE164(dial: string, nationalDigits: string): string {
  const local = nationalDigits.replace(/\D/g, '')
  return local ? `+${dial}${local}` : `+${dial}`
}

/** true quando o usuário já digitou algo além do DDI (para exibir erro de validação). */
export function hasContactPhoneNationalDigits(value: string): boolean {
  const country = value.trim() ? detectCountryFromE164(value) : DEFAULT_PHONE_COUNTRY
  return nationalDigitsFromE164(value, country.dial).length > 0
}
