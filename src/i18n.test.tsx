import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { resolveLanguage, currencyName, formatRateDate } from './i18n';
import { CurrencyConverterWidget } from './index';
import { formatAmount } from './money';
import type { ExchangeClient } from './api';
const api: ExchangeClient = { currencies: async () => [], rate: async (base, quote) => ({ base, quote, rate: 1, date: '2026-10-08' }), clear() {} };
describe('language resolution', () => {
  it('prioritizes component, query, page and browser in order', () => {
    expect(resolveLanguage('en', { query: 'pt', page: 'pt', browser: 'pt' })).toBe('en');
    expect(resolveLanguage('pt-PT', { query: 'en' })).toBe('pt');
    expect(resolveLanguage(undefined, { query: 'pt-BR', page: 'en' })).toBe('pt');
    expect(resolveLanguage(undefined, { page: 'pt-PT', browser: 'en' })).toBe('pt');
    expect(resolveLanguage(undefined, { browser: 'pt-BR' })).toBe('pt');
    expect(resolveLanguage(undefined, { browser: 'pt-PT' })).toBe('pt');
    expect(resolveLanguage(undefined, { query: 'en', browser: 'pt' })).toBe('en');
  });
  it('defaults to English and handles blanks and unsupported languages', () => {
    expect(resolveLanguage(undefined, {})).toBe('en');
    expect(resolveLanguage('', { query: ' ', browser: 'PT-br' })).toBe('pt');
    expect(resolveLanguage(undefined, { browser: 'fr-FR' })).toBe('en');
    expect(resolveLanguage('de', { browser: 'pt' })).toBe('en');
  });
  it('localizes money, currency names and dates', () => {
    expect(formatAmount(1234.56, 'USD', 'en-US')).toBe('1,234.56');
    expect(formatAmount(1234.56, 'USD', 'pt-BR')).toBe('1.234,56');
    expect(currencyName('USD', 'en')).toBe('US Dollar');
    expect(currencyName('USD', 'pt')).toBe('Dólar americano');
    expect(formatRateDate('2026-10-08', 'pt')).toBe('08/10/2026');
    expect(formatRateDate('2026-10-08', 'en')).toBe('10/8/2026');
  });
  it('switches component language without resetting the source amount', () => {
    const { rerender } = render(<CurrencyConverterWidget client={api} lang="en" initialCurrencies={[]} initialAmount={1234.56} />);
    expect(screen.getByRole('heading', { name: 'Currency converter' })).toBeInTheDocument();
    expect(screen.getByLabelText('Amount in USD')).toHaveValue('1,234.56');
    rerender(<CurrencyConverterWidget client={api} lang="pt-PT" initialCurrencies={[]} initialAmount={1234.56} />);
    expect(screen.getByRole('heading', { name: 'Conversor de moedas' })).toBeInTheDocument();
    expect(screen.getByLabelText('Valor em USD')).toHaveValue('1.234,56');
  });
  it('reads URL language when no component language is provided', () => {
    const previous = window.location.href;
    window.history.replaceState({}, '', '?lang=pt-PT');
    try {
      render(<CurrencyConverterWidget client={api} initialCurrencies={[]} />);
      expect(screen.getByRole('heading', { name: 'Conversor de moedas' })).toBeInTheDocument();
    } finally { window.history.replaceState({}, '', previous); }
  });
});
