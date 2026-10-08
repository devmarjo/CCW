export type Language = 'en' | 'pt';
export type LanguageHints = { query?: string | null; page?: string | null; browser?: string | null };
export function resolveLanguage(lang?: string, hints?: LanguageHints): Language {
  const signals = hints ?? {
    query: typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('lang') : null,
    page: typeof document !== 'undefined' ? document.documentElement.lang : null,
    browser: typeof navigator !== 'undefined' ? navigator.languages?.[0] || navigator.language : null,
  };
  const value = [lang, signals.query, signals.page, signals.browser].find(v => v?.trim());
  return /^pt(?:[-_]|$)/i.test(value?.trim() ?? '') ? 'pt' : 'en';
}
export const messages = {
  pt: {
    reorder: 'Reordenar', dragHint: 'Arraste para reordenar ou use as setas para cima e para baixo', title: 'Conversor de moedas', currency: 'MOEDA', amount: 'VALOR', fixed: 'Fixa', remove: 'Remover', valueIn: 'Valor em',
    converting: 'Convertendo…', reference: 'Valor de referência', converted: 'Convertido', select: 'Selecionar moeda',
    loadingCurrencies: 'Carregando moedas…', choose: 'Selecione uma moeda', add: '+ Adicionar', noCurrencies: 'Nenhuma moeda disponível.',
    catalogError: 'Não foi possível carregar as moedas. Tente novamente.', conversionError: 'Conversão indisponível', usdError: 'Não foi possível converter para USD',
    info: 'Informações das taxas', updating: 'Atualizando taxas…', unavailable: 'Algumas informações estão indisponíveis', loaded: 'Taxas carregadas',
    rates: 'Taxas', daily: 'Taxas de referência diárias', note: 'Valores indicativos, sem IOF, tarifas ou spread. Edite qualquer valor para recalcular as outras moedas.',
    refresh: 'Atualizar taxas ↻', demo: 'DEMO INTERATIVA', tagline: 'Feito para o dia a dia de quem conecta pessoas e destinos.'
  },
  en: {
    reorder: 'Reorder', dragHint: 'Drag to reorder or use the up and down arrow keys', title: 'Currency converter', currency: 'CURRENCY', amount: 'AMOUNT', fixed: 'Fixed', remove: 'Remove', valueIn: 'Amount in',
    converting: 'Converting…', reference: 'Reference amount', converted: 'Converted', select: 'Select currency',
    loadingCurrencies: 'Loading currencies…', choose: 'Choose a currency', add: '+ Add', noCurrencies: 'No currencies available.',
    catalogError: 'Could not load currencies. Please try again.', conversionError: 'Conversion unavailable', usdError: 'Could not convert to USD',
    info: 'Exchange rate information', updating: 'Updating rates…', unavailable: 'Some information is unavailable', loaded: 'Rates loaded',
    rates: 'Rates', daily: 'Daily reference rates', note: 'Indicative amounts excluding IOF tax, fees and spread. Edit any amount to recalculate the other currencies.',
    refresh: 'Refresh rates ↻', demo: 'INTERACTIVE DEMO', tagline: 'Made for people who connect travelers and destinations.'
  }
};
export function currencyName(code: string, language: Language, fallback = code): string {
  try { return new Intl.DisplayNames([language === 'pt' ? 'pt-BR' : 'en-US'], { type: 'currency' }).of(code) ?? fallback; }
  catch { return fallback; }
}
export function formatRateDate(date: string, language: Language): string {
  const value = new Date(`${date}T00:00:00Z`);
  return Number.isNaN(value.getTime()) ? date : new Intl.DateTimeFormat(language === 'pt' ? 'pt-BR' : 'en-US', { timeZone: 'UTC' }).format(value);
}
