'use client'

import { useState, useMemo } from 'react'

/** ISO 3166-1 countries — name + alpha-2 code */
const COUNTRIES = [
  { name: 'Afghanistan', code: 'AF' }, { name: 'Albania', code: 'AL' }, { name: 'Algeria', code: 'DZ' },
  { name: 'Andorra', code: 'AD' }, { name: 'Angola', code: 'AO' }, { name: 'Argentina', code: 'AR' },
  { name: 'Armenia', code: 'AM' }, { name: 'Australia', code: 'AU' }, { name: 'Austria', code: 'AT' },
  { name: 'Azerbaijan', code: 'AZ' }, { name: 'Bahamas', code: 'BS' }, { name: 'Bahrain', code: 'BH' },
  { name: 'Bangladesh', code: 'BD' }, { name: 'Barbados', code: 'BB' }, { name: 'Belarus', code: 'BY' },
  { name: 'Belgium', code: 'BE' }, { name: 'Belize', code: 'BZ' }, { name: 'Benin', code: 'BJ' },
  { name: 'Bhutan', code: 'BT' }, { name: 'Bolivia', code: 'BO' }, { name: 'Bosnia and Herzegovina', code: 'BA' },
  { name: 'Botswana', code: 'BW' }, { name: 'Brazil', code: 'BR' }, { name: 'Brunei', code: 'BN' },
  { name: 'Bulgaria', code: 'BG' }, { name: 'Burkina Faso', code: 'BF' }, { name: 'Burundi', code: 'BI' },
  { name: 'Cambodia', code: 'KH' }, { name: 'Cameroon', code: 'CM' }, { name: 'Canada', code: 'CA' },
  { name: 'Cape Verde', code: 'CV' }, { name: 'Central African Republic', code: 'CF' }, { name: 'Chad', code: 'TD' },
  { name: 'Chile', code: 'CL' }, { name: 'China', code: 'CN' }, { name: 'Colombia', code: 'CO' },
  { name: 'Comoros', code: 'KM' }, { name: 'Congo', code: 'CG' }, { name: 'Costa Rica', code: 'CR' },
  { name: 'Croatia', code: 'HR' }, { name: 'Cuba', code: 'CU' }, { name: 'Cyprus', code: 'CY' },
  { name: 'Czech Republic', code: 'CZ' }, { name: 'Denmark', code: 'DK' }, { name: 'Djibouti', code: 'DJ' },
  { name: 'Dominican Republic', code: 'DO' }, { name: 'DR Congo', code: 'CD' }, { name: 'Ecuador', code: 'EC' },
  { name: 'Egypt', code: 'EG' }, { name: 'El Salvador', code: 'SV' }, { name: 'Equatorial Guinea', code: 'GQ' },
  { name: 'Eritrea', code: 'ER' }, { name: 'Estonia', code: 'EE' }, { name: 'Eswatini', code: 'SZ' },
  { name: 'Ethiopia', code: 'ET' }, { name: 'Fiji', code: 'FJ' }, { name: 'Finland', code: 'FI' },
  { name: 'France', code: 'FR' }, { name: 'Gabon', code: 'GA' }, { name: 'Gambia', code: 'GM' },
  { name: 'Georgia', code: 'GE' }, { name: 'Germany', code: 'DE' }, { name: 'Ghana', code: 'GH' },
  { name: 'Greece', code: 'GR' }, { name: 'Grenada', code: 'GD' }, { name: 'Guatemala', code: 'GT' },
  { name: 'Guinea', code: 'GN' }, { name: 'Guyana', code: 'GY' }, { name: 'Haiti', code: 'HT' },
  { name: 'Honduras', code: 'HN' }, { name: 'Hungary', code: 'HU' }, { name: 'Iceland', code: 'IS' },
  { name: 'India', code: 'IN' }, { name: 'Indonesia', code: 'ID' }, { name: 'Iran', code: 'IR' },
  { name: 'Iraq', code: 'IQ' }, { name: 'Ireland', code: 'IE' }, { name: 'Israel', code: 'IL' },
  { name: 'Italy', code: 'IT' }, { name: 'Ivory Coast', code: 'CI' }, { name: 'Jamaica', code: 'JM' },
  { name: 'Japan', code: 'JP' }, { name: 'Jordan', code: 'JO' }, { name: 'Kazakhstan', code: 'KZ' },
  { name: 'Kenya', code: 'KE' }, { name: 'Kuwait', code: 'KW' }, { name: 'Kyrgyzstan', code: 'KG' },
  { name: 'Laos', code: 'LA' }, { name: 'Latvia', code: 'LV' }, { name: 'Lebanon', code: 'LB' },
  { name: 'Lesotho', code: 'LS' }, { name: 'Liberia', code: 'LR' }, { name: 'Libya', code: 'LY' },
  { name: 'Liechtenstein', code: 'LI' }, { name: 'Lithuania', code: 'LT' }, { name: 'Luxembourg', code: 'LU' },
  { name: 'Madagascar', code: 'MG' }, { name: 'Malawi', code: 'MW' }, { name: 'Malaysia', code: 'MY' },
  { name: 'Maldives', code: 'MV' }, { name: 'Mali', code: 'ML' }, { name: 'Malta', code: 'MT' },
  { name: 'Mauritania', code: 'MR' }, { name: 'Mauritius', code: 'MU' }, { name: 'Mexico', code: 'MX' },
  { name: 'Moldova', code: 'MD' }, { name: 'Monaco', code: 'MC' }, { name: 'Mongolia', code: 'MN' },
  { name: 'Montenegro', code: 'ME' }, { name: 'Morocco', code: 'MA' }, { name: 'Mozambique', code: 'MZ' },
  { name: 'Myanmar', code: 'MM' }, { name: 'Namibia', code: 'NA' }, { name: 'Nepal', code: 'NP' },
  { name: 'Netherlands', code: 'NL' }, { name: 'New Zealand', code: 'NZ' }, { name: 'Nicaragua', code: 'NI' },
  { name: 'Niger', code: 'NE' }, { name: 'Nigeria', code: 'NG' }, { name: 'North Korea', code: 'KP' },
  { name: 'North Macedonia', code: 'MK' }, { name: 'Norway', code: 'NO' }, { name: 'Oman', code: 'OM' },
  { name: 'Pakistan', code: 'PK' }, { name: 'Palestine', code: 'PS' }, { name: 'Panama', code: 'PA' },
  { name: 'Papua New Guinea', code: 'PG' }, { name: 'Paraguay', code: 'PY' }, { name: 'Peru', code: 'PE' },
  { name: 'Philippines', code: 'PH' }, { name: 'Poland', code: 'PL' }, { name: 'Portugal', code: 'PT' },
  { name: 'Qatar', code: 'QA' }, { name: 'Romania', code: 'RO' }, { name: 'Russia', code: 'RU' },
  { name: 'Rwanda', code: 'RW' }, { name: 'Saudi Arabia', code: 'SA' }, { name: 'Senegal', code: 'SN' },
  { name: 'Serbia', code: 'RS' }, { name: 'Sierra Leone', code: 'SL' }, { name: 'Singapore', code: 'SG' },
  { name: 'Slovakia', code: 'SK' }, { name: 'Slovenia', code: 'SI' }, { name: 'Somalia', code: 'SO' },
  { name: 'South Africa', code: 'ZA' }, { name: 'South Korea', code: 'KR' }, { name: 'South Sudan', code: 'SS' },
  { name: 'Spain', code: 'ES' }, { name: 'Sri Lanka', code: 'LK' }, { name: 'Sudan', code: 'SD' },
  { name: 'Suriname', code: 'SR' }, { name: 'Sweden', code: 'SE' }, { name: 'Switzerland', code: 'CH' },
  { name: 'Syria', code: 'SY' }, { name: 'Taiwan', code: 'TW' }, { name: 'Tajikistan', code: 'TJ' },
  { name: 'Tanzania', code: 'TZ' }, { name: 'Thailand', code: 'TH' }, { name: 'Timor-Leste', code: 'TL' },
  { name: 'Togo', code: 'TG' }, { name: 'Trinidad and Tobago', code: 'TT' }, { name: 'Tunisia', code: 'TN' },
  { name: 'Turkey', code: 'TR' }, { name: 'Turkmenistan', code: 'TM' }, { name: 'Uganda', code: 'UG' },
  { name: 'Ukraine', code: 'UA' }, { name: 'United Arab Emirates', code: 'AE' }, { name: 'United Kingdom', code: 'GB' },
  { name: 'United States', code: 'US' }, { name: 'Uruguay', code: 'UY' }, { name: 'Uzbekistan', code: 'UZ' },
  { name: 'Venezuela', code: 'VE' }, { name: 'Vietnam', code: 'VN' }, { name: 'Yemen', code: 'YE' },
  { name: 'Zambia', code: 'ZM' }, { name: 'Zimbabwe', code: 'ZW' },
] as const

function countryFlag(code: string): string {
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map((c) => 0x1f1e6 + c.charCodeAt(0) - 65)
  )
}

export function CountrySelect() {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ name: string; code: string } | null>(null)
  const [open, setOpen] = useState(false)

  const filtered = useMemo(() => {
    if (!search) return COUNTRIES
    const q = search.toLowerCase()
    return COUNTRIES.filter(
      (c) => c.name.toLowerCase().includes(q) || c.code.toLowerCase().includes(q)
    )
  }, [search])

  return (
    <div className="relative">
      <label htmlFor="country-search" className="block text-sm font-medium text-gray-700 mb-1">
        Country
      </label>

      {/* Hidden inputs for form submission */}
      <input type="hidden" name="country" value={selected?.name ?? ''} />
      <input type="hidden" name="country_code" value={selected?.code ?? ''} />

      <div className="relative">
        <input
          id="country-search"
          type="text"
          autoComplete="off"
          value={selected ? `${countryFlag(selected.code)} ${selected.name}` : search}
          onChange={(e) => {
            setSearch(e.target.value)
            setSelected(null)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => {
            // Delay to allow click on option
            setTimeout(() => setOpen(false), 200)
          }}
          placeholder="Search countries…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        {selected && (
          <button
            type="button"
            onClick={() => {
              setSelected(null)
              setSearch('')
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 text-sm"
          >
            ✕
          </button>
        )}
      </div>

      {open && !selected && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-48 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {filtered.slice(0, 20).map((c) => (
            <li key={c.code}>
              <button
                type="button"
                className="flex w-full items-center gap-2 px-3 py-2 text-sm text-left hover:bg-indigo-50"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  setSelected(c)
                  setSearch('')
                  setOpen(false)
                }}
              >
                <span>{countryFlag(c.code)}</span>
                <span>{c.name}</span>
                <span className="ml-auto text-xs text-gray-400">{c.code}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
