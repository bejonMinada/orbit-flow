export interface Currency {
  code: string;
  name: string;
  symbol: string;
  minorUnits: number;
}

export const CURRENCIES: Currency[] = [
  { code: 'AED', name: 'UAE Dirham', symbol: 'د.إ', minorUnits: 2 },
  { code: 'ARS', name: 'Argentine Peso', symbol: '$', minorUnits: 2 },
  { code: 'AUD', name: 'Australian Dollar', symbol: 'A$', minorUnits: 2 },
  { code: 'BDT', name: 'Bangladeshi Taka', symbol: '৳', minorUnits: 2 },
  { code: 'BHD', name: 'Bahraini Dinar', symbol: 'BD', minorUnits: 3 },
  { code: 'BRL', name: 'Brazilian Real', symbol: 'R$', minorUnits: 2 },
  { code: 'CAD', name: 'Canadian Dollar', symbol: 'C$', minorUnits: 2 },
  { code: 'CHF', name: 'Swiss Franc', symbol: 'CHF', minorUnits: 2 },
  { code: 'CLP', name: 'Chilean Peso', symbol: '$', minorUnits: 0 },
  { code: 'CNY', name: 'Yuan Renminbi', symbol: '¥', minorUnits: 2 },
  { code: 'COP', name: 'Colombian Peso', symbol: '$', minorUnits: 2 },
  { code: 'CZK', name: 'Czech Koruna', symbol: 'Kč', minorUnits: 2 },
  { code: 'DKK', name: 'Danish Krone', symbol: 'kr', minorUnits: 2 },
  { code: 'EGP', name: 'Egyptian Pound', symbol: '£', minorUnits: 2 },
  { code: 'EUR', name: 'Euro', symbol: '€', minorUnits: 2 },
  { code: 'GBP', name: 'Pound Sterling', symbol: '£', minorUnits: 2 },
  { code: 'HKD', name: 'Hong Kong Dollar', symbol: 'HK$', minorUnits: 2 },
  { code: 'HUF', name: 'Forint', symbol: 'Ft', minorUnits: 2 },
  { code: 'IDR', name: 'Rupiah', symbol: 'Rp', minorUnits: 2 },
  { code: 'ILS', name: 'New Israeli Shekel', symbol: '₪', minorUnits: 2 },
  { code: 'INR', name: 'Indian Rupee', symbol: '₹', minorUnits: 2 },
  { code: 'JPY', name: 'Yen', symbol: '¥', minorUnits: 0 },
  { code: 'KES', name: 'Kenyan Shilling', symbol: 'KSh', minorUnits: 2 },
  { code: 'KRW', name: 'Won', symbol: '₩', minorUnits: 0 },
  { code: 'KWD', name: 'Kuwaiti Dinar', symbol: 'KD', minorUnits: 3 },
  { code: 'LKR', name: 'Sri Lanka Rupee', symbol: 'Rs', minorUnits: 2 },
  { code: 'MAD', name: 'Moroccan Dirham', symbol: 'MAD', minorUnits: 2 },
  { code: 'MXN', name: 'Mexican Peso', symbol: 'MX$', minorUnits: 2 },
  { code: 'MYR', name: 'Malaysian Ringgit', symbol: 'RM', minorUnits: 2 },
  { code: 'NGN', name: 'Naira', symbol: '₦', minorUnits: 2 },
  { code: 'NOK', name: 'Norwegian Krone', symbol: 'kr', minorUnits: 2 },
  { code: 'NPR', name: 'Nepalese Rupee', symbol: 'Rs', minorUnits: 2 },
  { code: 'NZD', name: 'New Zealand Dollar', symbol: 'NZ$', minorUnits: 2 },
  { code: 'OMR', name: 'Rial Omani', symbol: 'OMR', minorUnits: 3 },
  { code: 'PEN', name: 'Sol', symbol: 'S/', minorUnits: 2 },
  { code: 'PHP', name: 'Philippine Peso', symbol: '₱', minorUnits: 2 },
  { code: 'PKR', name: 'Pakistan Rupee', symbol: 'Rs', minorUnits: 2 },
  { code: 'PLN', name: 'Zloty', symbol: 'zł', minorUnits: 2 },
  { code: 'QAR', name: 'Qatari Rial', symbol: 'QR', minorUnits: 2 },
  { code: 'RON', name: 'Romanian Leu', symbol: 'lei', minorUnits: 2 },
  { code: 'RUB', name: 'Russian Ruble', symbol: '₽', minorUnits: 2 },
  { code: 'SAR', name: 'Saudi Riyal', symbol: 'SR', minorUnits: 2 },
  { code: 'SEK', name: 'Swedish Krona', symbol: 'kr', minorUnits: 2 },
  { code: 'SGD', name: 'Singapore Dollar', symbol: 'S$', minorUnits: 2 },
  { code: 'THB', name: 'Baht', symbol: '฿', minorUnits: 2 },
  { code: 'TRY', name: 'Turkish Lira', symbol: '₺', minorUnits: 2 },
  { code: 'TWD', name: 'New Taiwan Dollar', symbol: 'NT$', minorUnits: 2 },
  { code: 'UAH', name: 'Hryvnia', symbol: '₴', minorUnits: 2 },
  { code: 'USD', name: 'US Dollar', symbol: '$', minorUnits: 2 },
  { code: 'VND', name: 'Dong', symbol: '₫', minorUnits: 0 },
  { code: 'ZAR', name: 'Rand', symbol: 'R', minorUnits: 2 },
];

export function getCurrency(code: string): Currency | undefined {
  return CURRENCIES.find((c) => c.code === code.toUpperCase());
}

export function normalizeCurrencyCode(code: string, fallback: string = 'PHP'): string {
  const normalized = code.trim().toUpperCase();
  return getCurrency(normalized) ? normalized : fallback;
}

export function formatAmount(amount: number, currencyCode: string): string {
  const safeCode = normalizeCurrencyCode(currencyCode);
  const currency = getCurrency(safeCode);
  const symbol = currency?.symbol ?? currencyCode;
  const decimals = currency?.minorUnits ?? 2;
  return `${symbol}${amount.toFixed(decimals)}`;
}
