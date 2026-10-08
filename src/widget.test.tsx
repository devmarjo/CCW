import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CurrencyConverterWidget } from './index';
import { createFrankfurterClient, type ExchangeClient, type Rate } from './api';
import { parseAmount, formatAmount } from './money';
const currencies = [{ iso_code: 'EUR', name: 'Euro' }, { iso_code: 'USD', name: 'Dollar' }, { iso_code: 'BRL', name: 'Real' }, { iso_code: 'JPY', name: 'Yen' }];
function client(): ExchangeClient {
  return { currencies: vi.fn().mockResolvedValue(currencies), clear: vi.fn(), rate: vi.fn(async (base: string, quote: string) => ({ base, quote, rate: ({ 'USD/EUR': .8, 'EUR/USD': 1.25, 'USD/BRL': 5, 'BRL/USD': .2, 'USD/JPY': 150 } as Record<string, number>)[`${base}/${quote}`] ?? 1, date: '2026-10-08' })) };
}
const input = (code: string) => screen.getByLabelText(`Valor em ${code}`) as HTMLInputElement;
describe('money mask', () => {
  it('handles pasted symbols, zero and currency precision', () => {
    expect(parseAmount('R$ 1.234,56', 'BRL')).toBe(1234.56);
    expect(parseAmount('', 'USD')).toBe(0);
    expect(parseAmount('123', 'JPY')).toBe(123);
    expect(formatAmount(12.3, 'USD')).toBe('12,30');
  });
});
describe('widget', () => {
  it('keeps EUR/USD first and converts through USD after edits', async () => {
    const api = client(); render(<CurrencyConverterWidget lang="pt" client={api} initialCurrencies={['BRL']} />);
    expect(screen.getAllByRole('textbox').map(e => e.getAttribute('aria-label'))).toEqual(['Valor em EUR', 'Valor em USD', 'Valor em BRL']);
    expect(screen.queryByLabelText('Remover EUR')).not.toBeInTheDocument();
    await waitFor(() => expect(input('BRL').value).toBe('500,00'));
    fireEvent.change(input('EUR'), { target: { value: '20000' } });
    await waitFor(() => expect(input('BRL').value).toBe('1.250,00'));
    expect(input('USD').value).toBe('250,00');
    expect(api.rate).toHaveBeenCalledWith('EUR', 'USD');
    expect(api.rate).toHaveBeenCalledWith('USD', 'BRL');
  });
  it('selects, adds and removes currencies', async () => {
    render(<CurrencyConverterWidget lang="pt" client={client()} initialCurrencies={[]} />);
    await screen.findByRole('option', { name: 'JPY · Iene japonês' });
    fireEvent.change(screen.getByLabelText('Selecionar moeda'), { target: { value: 'JPY' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await waitFor(() => expect(input('JPY').value).toBe('15.000'));
    fireEvent.click(screen.getByLabelText('Remover JPY'));
    expect(screen.queryByLabelText('Valor em JPY')).not.toBeInTheDocument();
  });
  it('discards obsolete responses and preserves newer edited values', async () => {
    let resolveOld!: (rate: Rate) => void;
    const api = client(); let calls = 0;
    api.rate = vi.fn((base, quote) => {
      calls++;
      if (calls === 1) return new Promise<Rate>(resolve => { resolveOld = resolve; });
      return Promise.resolve({ base, quote, rate: .8, date: '2026-10-08' });
    });
    render(<CurrencyConverterWidget lang="pt" client={api} initialCurrencies={[]} />);
    await waitFor(() => expect(resolveOld).toBeDefined());
    fireEvent.change(input('USD'), { target: { value: '20000' } });
    await waitFor(() => expect(input('EUR').value).toBe('160,00'));
    resolveOld({ base: 'USD', quote: 'EUR', rate: 99, date: '2026-10-08' });
    await new Promise(resolve => setTimeout(resolve, 20));
    expect(input('EUR').value).toBe('160,00');
  });
  it('reports one failed target while completing other conversions', async () => {
    const api = client(); const original = api.rate;
    api.rate = (base, quote) => quote === 'BRL' ? Promise.reject(new Error('offline')) : original(base, quote);
    render(<CurrencyConverterWidget lang="pt" client={api} initialCurrencies={['BRL']} />);
    await screen.findByText('Conversão indisponível');
    expect(input('EUR').value).toBe('80,00');
    expect(input('BRL')).toHaveAttribute('aria-invalid', 'true');
  });
  it('persists USD by default and tolerates malformed storage', async () => {
    localStorage.setItem('saved', '{broken');
    const { unmount } = render(<CurrencyConverterWidget lang="pt" client={client()} persist storageKey="saved" initialCurrencies={[]} />);
    fireEvent.change(input('USD'), { target: { value: '32100' } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('saved')!).usdAmount).toBe(321));
    unmount();
    render(<CurrencyConverterWidget lang="pt" client={client()} persist storageKey="saved" />);
    expect(input('USD').value).toBe('321,00');
    expect(localStorage.getItem('ccw:v1')).toBeNull();
  });
  it('restores added currencies and reconverts from stored USD after a non-USD edit', async () => {
    const api = client();
    const { unmount } = render(<CurrencyConverterWidget lang="pt" client={api} initialCurrencies={[]} storageKey="reload" />);
    await screen.findByRole('option', { name: 'BRL · Real brasileiro' });
    fireEvent.change(screen.getByLabelText('Selecionar moeda'), { target: { value: 'BRL' } });
    fireEvent.click(screen.getByRole('button', { name: '+ Adicionar' }));
    await waitFor(() => expect(input('BRL').value).toBe('500,00'));
    fireEvent.change(input('BRL'), { target: { value: '100000' } });
    await waitFor(() => expect(JSON.parse(localStorage.getItem('reload')!).usdAmount).toBe(200));
    unmount();
    const fresh = client();
    render(<CurrencyConverterWidget lang="pt" client={fresh} initialCurrencies={[]} storageKey="reload" />);
    expect(input('USD').value).toBe('200,00');
    await waitFor(() => expect(input('BRL').value).toBe('1.000,00'));
    expect(fresh.rate).toHaveBeenCalledWith('USD', 'BRL');
    expect(fresh.rate).not.toHaveBeenCalledWith('BRL', 'USD');
    fireEvent.click(screen.getByLabelText('Remover BRL'));
    await waitFor(() => expect(JSON.parse(localStorage.getItem('reload')!).codes).not.toContain('BRL'));
  });
  it('reorders fixed currencies and restores their positions without converting again', async () => {
    const api = client();
    const { unmount } = render(<CurrencyConverterWidget lang="pt" client={api} initialCurrencies={['BRL']} storageKey="order" />);
    await waitFor(() => expect(input('BRL').value).toBe('500,00'));
    const callCount = vi.mocked(api.rate).mock.calls.length;
    fireEvent.keyDown(screen.getByLabelText('Reordenar BRL'), { key: 'ArrowUp' });
    fireEvent.keyDown(screen.getByLabelText('Reordenar BRL'), { key: 'ArrowUp' });
    expect(screen.getAllByRole('textbox').map(e => e.getAttribute('aria-label'))).toEqual(['Valor em BRL', 'Valor em EUR', 'Valor em USD']);
    expect(JSON.parse(localStorage.getItem('order')!).codes).toEqual(['BRL', 'EUR', 'USD']);
    expect(vi.mocked(api.rate).mock.calls.length).toBe(callCount);
    unmount();
    render(<CurrencyConverterWidget lang="pt" client={client()} storageKey="order" />);
    expect(screen.getAllByRole('textbox').map(e => e.getAttribute('aria-label'))).toEqual(['Valor em BRL', 'Valor em EUR', 'Valor em USD']);
    expect(screen.queryByLabelText('Remover EUR')).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Remover USD')).not.toBeInTheDocument();
  });

  it('can explicitly disable persistence', () => {
    render(<CurrencyConverterWidget lang="pt" client={client()} persist={false} storageKey="disabled" />);
    fireEvent.change(input('USD'), { target: { value: '9900' } });
    expect(localStorage.getItem('disabled')).toBeNull();
  });

});
describe('Frankfurter client', () => {
  it('deduplicates concurrent requests, caches and refreshes', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ base: 'USD', quote: 'EUR', rate: .8, date: '2026-10-08' }) } as Response);
    const api = createFrankfurterClient();
    await Promise.all([api.rate('USD', 'EUR'), api.rate('USD', 'EUR')]);
    await api.rate('USD', 'EUR'); expect(fetchMock).toHaveBeenCalledTimes(1);
    api.clear(); await api.rate('USD', 'EUR'); expect(fetchMock).toHaveBeenCalledTimes(2);
  });
  it('rejects invalid responses without caching failures', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true, json: async () => ({ rate: -1 }) } as Response);
    const api = createFrankfurterClient();
    await expect(api.rate('USD', 'EUR')).rejects.toThrow('Resposta inválida');
    await expect(api.rate('USD', 'EUR')).rejects.toThrow();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
