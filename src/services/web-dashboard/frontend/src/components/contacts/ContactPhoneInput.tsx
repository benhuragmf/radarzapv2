import { useId, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import CountryFlag from './CountryFlag'
import {
  buildE164,
  DEFAULT_PHONE_COUNTRY,
  detectCountryFromE164,
  nationalDigitsFromE164,
  PHONE_COUNTRIES,
  type PhoneCountry,
} from '../../lib/phoneCountries'

interface Props {
  value: string
  onChange: (value: string) => void
  disabled?: boolean
}

export default function ContactPhoneInput({ value, onChange, disabled }: Props) {
  const listId = useId()
  const [open, setOpen] = useState(false)
  const country = value.trim() ? detectCountryFromE164(value) : DEFAULT_PHONE_COUNTRY
  const national = nationalDigitsFromE164(value, country.dial)

  const applyCountry = (next: PhoneCountry) => {
    setOpen(false)
    onChange(buildE164(next.dial, national))
  }

  const applyNational = (raw: string) => {
    onChange(buildE164(country.dial, raw.replace(/\D/g, '')))
  }

  const placeholder = country.iso === 'BR' ? '11999999999' : 'número sem DDI'

  return (
    <div className="relative">
      <div
        className={`flex rounded-lg border border-gray-700 bg-gray-900 overflow-hidden focus-within:ring-2 focus-within:ring-brand-500/40 focus-within:border-brand-500/50 ${
          disabled ? 'opacity-60' : ''
        }`}
      >
        <button
          type="button"
          disabled={disabled}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={listId}
          onClick={() => setOpen(o => !o)}
          className="flex items-center gap-1.5 shrink-0 px-2.5 py-2 border-r border-gray-700 bg-gray-800/80 hover:bg-gray-800 text-sm text-gray-200"
        >
          <CountryFlag iso={country.iso} size={22} />
          <span className="font-mono text-xs text-gray-300">+{country.dial}</span>
          <ChevronDown size={14} className="text-gray-500" />
        </button>
        <input
          type="tel"
          inputMode="tel"
          autoComplete="tel-national"
          disabled={disabled}
          value={national}
          onChange={e => applyNational(e.target.value)}
          placeholder={placeholder}
          className="flex-1 min-w-0 bg-transparent px-3 py-2 text-sm text-white placeholder:text-gray-600 outline-none"
        />
      </div>

      {open && !disabled && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            aria-label="Fechar lista de países"
            onClick={() => setOpen(false)}
          />
          <ul
            id={listId}
            role="listbox"
            className="absolute left-0 right-0 top-full z-50 mt-1 max-h-52 overflow-y-auto rounded-lg border border-gray-700 bg-gray-900 shadow-xl py-1"
          >
            {PHONE_COUNTRIES.map(c => (
              <li key={c.iso} role="option" aria-selected={c.iso === country.iso}>
                <button
                  type="button"
                  className={`w-full flex items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-gray-800 ${
                    c.iso === country.iso ? 'bg-brand-600/10 text-white' : 'text-gray-200'
                  }`}
                  onClick={() => applyCountry(c)}
                >
                  <CountryFlag iso={c.iso} size={20} className="w-6" />
                  <span className="flex-1 truncate">{c.name}</span>
                  <span className="font-mono text-xs text-gray-500">+{c.dial}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  )
}
