export type Currency = { iso_code: string; name: string };
export type Rate = { base: string; quote: string; rate: number; date: string };
export interface ExchangeClient { currencies(): Promise<Currency[]>; rate(base: string, quote: string): Promise<Rate>; clear(): void }
const API = 'https://api.frankfurter.dev/v2';
export function createFrankfurterClient(ttl = 60 * 60 * 1000): ExchangeClient {
  const cache = new Map<string, { expires: number; value: unknown }>();
  const pending = new Map<string, Promise<unknown>>();
  let generation = 0;
  async function request<T>(path: string, validate: (value: unknown) => value is T): Promise<T> {
    const cached = cache.get(path);
    if (cached && cached.expires > Date.now()) return cached.value as T;
    if (pending.has(path)) return pending.get(path) as Promise<T>;
    const epoch = generation;
    const task = (async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetch(`${API}${path}`, { signal: controller.signal });
        if (!response.ok) throw new Error(`API indisponível (${response.status})`);
        const value: unknown = await response.json();
        if (!validate(value)) throw new Error('Resposta inválida da API');
        if (epoch === generation) cache.set(path, { expires: Date.now() + ttl, value });
        return value;
      } finally { clearTimeout(timer); }
    })();
    pending.set(path, task);
    try { return await task; } finally { if (pending.get(path) === task) pending.delete(path); }
  }
  return {
    currencies: () => request('/currencies', (v): v is Currency[] => Array.isArray(v) && v.length > 0 && v.every(c => typeof c?.iso_code === 'string' && /^[A-Z]{3}$/i.test(c.iso_code) && typeof c.name === 'string')).then(cs => cs.map(c => ({ ...c, iso_code: c.iso_code.toUpperCase() }))),
    rate: (base, quote) => {
      if (!/^[A-Z]{3}$/.test(base) || !/^[A-Z]{3}$/.test(quote)) return Promise.reject(new Error('Moeda inválida'));
      if (base === quote) return Promise.resolve({ base, quote, rate: 1, date: '' });
      return request(`/rate/${base.toLowerCase()}/${quote.toLowerCase()}`, (v): v is Rate => {
        const r = v as Rate | null;
        return !!r && typeof r.base === 'string' && r.base.toUpperCase() === base && typeof r.quote === 'string' && r.quote.toUpperCase() === quote && typeof r.rate === 'number' && Number.isFinite(r.rate) && r.rate > 0 && typeof r.date === 'string';
      });
    },
    clear: () => { generation++; cache.clear(); pending.clear(); }
  };
}
