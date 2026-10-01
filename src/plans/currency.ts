// The four plan currencies of capability `api-conventions` (FR-40).
export const CURRENCY_CODES = ['ARS', 'USD', 'EUR', 'BOB'] as const;
export type CurrencyCode = (typeof CURRENCY_CODES)[number];

export interface Currency {
  code: CurrencyCode;
  symbol: '$' | 'US$' | '€' | 'Bs.';
  name: 'pesos' | 'dólares' | 'euros' | 'bolivianos';
  minorUnits: 0 | 2;
}

export const CURRENCIES: Record<CurrencyCode, Currency> = {
  ARS: { code: 'ARS', symbol: '$', name: 'pesos', minorUnits: 0 },
  USD: { code: 'USD', symbol: 'US$', name: 'dólares', minorUnits: 2 },
  EUR: { code: 'EUR', symbol: '€', name: 'euros', minorUnits: 2 },
  BOB: { code: 'BOB', symbol: 'Bs.', name: 'bolivianos', minorUnits: 2 },
};
