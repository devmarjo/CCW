import { useEffect, useMemo, useRef, useState } from 'react';
import { createFrankfurterClient, type ExchangeClient, type Currency } from './api';
import { formatAmount, parseAmount } from './money';
import './style.css';
import { resolveLanguage, messages, currencyName, formatRateDate } from './i18n';
const sharedClient = createFrankfurterClient();
type Row = { code: string; amount: number; loading: boolean; error?: 'conversionError' | 'usdError'; date?: string };
type Source = { code: string; amount: number };
export interface CurrencyConverterWidgetProps { lang?: string; initialCurrencies?: string[]; initialAmount?: number; persist?: boolean; storageKey?: string; client?: ExchangeClient }
function readSaved(key: string): { codes: string[]; source: Source } | null {
  try {
    const value = JSON.parse(localStorage.getItem(key) ?? 'null');
    if (!value || !Array.isArray(value.codes) || value.codes.length > 30 || !value.codes.every((c: unknown) => typeof c === 'string' && /^[A-Z]{3}$/.test(c))) return null;
    if (typeof value.usdAmount === 'number' && Number.isFinite(value.usdAmount) && value.usdAmount >= 0) return { codes: value.codes, source: { code: 'USD', amount: value.usdAmount } };
    // Read the previous format once; the next successful conversion saves USD.
    if (value.codes.includes(value.source?.code) && typeof value.source.amount === 'number' && Number.isFinite(value.source.amount) && value.source.amount >= 0) return value;
  } catch { /* Storage can be unavailable. */ }
  return null;
}
export function CurrencyConverterWidget({ lang, initialCurrencies = ['BRL', 'GBP', 'JPY'], initialAmount = 100, persist = true, storageKey = 'ccw:v1', client = sharedClient }: CurrencyConverterWidgetProps) {
  const language = resolveLanguage(lang);
  const t = messages[language];
  const locale = language === 'pt' ? 'pt-BR' : 'en-US';
  const [seed] = useState(() => {
    const saved = persist ? readSaved(storageKey) : null;
    const restored = saved?.codes.filter(c => /^[A-Z]{3}$/.test(c));
    const codes = restored
      ? [...new Set([...restored, 'EUR', 'USD'])]
      : [...new Set(['EUR', 'USD', ...initialCurrencies.filter(c => /^[A-Z]{3}$/.test(c))])].slice(0, 30);
    const source = saved?.source ?? { code: 'USD', amount: Number.isFinite(initialAmount) && initialAmount >= 0 ? initialAmount : 100 };
    return { codes, source };
  });
  const [rows, setRows] = useState<Row[]>(seed.codes.map(code => ({ code, amount: code === seed.source.code ? seed.source.amount : 0, loading: code !== seed.source.code })));
  const [source, setSource] = useState<Source>(seed.source);
  const [usdAmount, setUsdAmount] = useState<number | null>(seed.source.code === 'USD' ? seed.source.amount : null);
  const [currencies, setCurrencies] = useState<Currency[]>([]);
  const [catalogError, setCatalogError] = useState('');
  const [catalogLoading, setCatalogLoading] = useState(true);
  const [selected, setSelected] = useState('');
  const [dragging, setDragging] = useState<string | null>(null);
  const dragCode = useRef<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [infoOpen, setInfoOpen] = useState(false);
  const infoRef = useRef<HTMLDivElement>(null);
  const infoButtonRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (!infoOpen) return;
    function outside(event: PointerEvent) { if (!infoRef.current?.contains(event.target as Node)) setInfoOpen(false); }
    function escape(event: KeyboardEvent) { if (event.key === 'Escape') { setInfoOpen(false); infoButtonRef.current?.focus(); } }
    document.addEventListener('pointerdown', outside);
    document.addEventListener('keydown', escape);
    return () => { document.removeEventListener('pointerdown', outside); document.removeEventListener('keydown', escape); };
  }, [infoOpen]);
  const revision = useRef(0);
  const codes = rows.map(r => r.code).join(',');
  const conversionCodes = rows.map(r => r.code).sort().join(',');
  useEffect(() => {
    let active = true; setCatalogLoading(true); setCatalogError('');
    client.currencies().then(cs => { if (active) setCurrencies(cs); }).catch(() => { if (active) setCatalogError('catalogError'); }).finally(() => { if (active) setCatalogLoading(false); });
    return () => { active = false; };
  }, [client, refresh]);
  useEffect(() => {
    const id = ++revision.current;
    const current = () => id === revision.current;
    const targets = conversionCodes.split(',').filter(c => c !== source.code);
    setRows(rs => rs.map(r => ({ ...r, loading: r.code !== source.code, error: undefined, date: undefined })));
    const timer = setTimeout(async () => {
      try {
        const usd = source.code === 'USD' ? source.amount : source.amount * (await client.rate(source.code, 'USD')).rate;
        if (!current()) return;
        if (!Number.isFinite(usd)) throw new Error('Invalid USD amount');
        setUsdAmount(usd);
        await Promise.allSettled(targets.map(async code => {
          try {
            const rate = await client.rate('USD', code);
            const amount = usd * rate.rate;
            if (!Number.isFinite(amount)) throw new Error('Valor muito alto');
            if (current()) setRows(rs => rs.map(r => r.code === code ? { ...r, amount, loading: false, error: undefined, date: rate.date } : r));
          } catch {
            if (current()) setRows(rs => rs.map(r => r.code === code ? { ...r, loading: false, error: 'conversionError' } : r));
          }
        }));
      } catch {
        if (current()) setRows(rs => rs.map(r => r.code !== source.code ? { ...r, loading: false, error: 'usdError' } : r));
      }
    }, 200);
    return () => { clearTimeout(timer); revision.current++; };
  }, [source, conversionCodes, client, refresh]);
  useEffect(() => { if (persist && usdAmount !== null) { try { localStorage.setItem(storageKey, JSON.stringify({ version: 2, codes: codes.split(','), usdAmount })); } catch { /* Persistence is optional. */ } } }, [codes, usdAmount, persist, storageKey]);
  const names = useMemo(() => new Map(currencies.map(c => [c.iso_code, currencyName(c.iso_code, language, c.name)])), [currencies, language]);
  const choices = currencies.filter(c => !rows.some(r => r.code === c.iso_code));
  const dates = [...new Set(rows.flatMap(r => r.date ? [r.date] : []))].sort();
  function edit(code: string, text: string) {
    revision.current++;
    const amount = parseAmount(text, code);
    if (code === 'USD') setUsdAmount(amount);
    setRows(rs => rs.map(r => ({ ...r, ...(r.code === code ? { amount, loading: false, error: undefined } : { loading: true, error: undefined }) })));
    setSource({ code, amount });
  }
  function add() {
    if (!selected || !choices.some(c => c.iso_code === selected) || rows.length >= 30) return;
    revision.current++;
    setRows(rs => [...rs, { code: selected, amount: 0, loading: true }]); setSelected('');
  }
  function remove(code: string) {
    if (code === 'EUR' || code === 'USD') return;
    revision.current++;
    if (source.code === code) { const usd = rows.find(r => r.code === 'USD'); setSource({ code: 'USD', amount: usd?.amount ?? 0 }); }
    setRows(rs => rs.filter(r => r.code !== code));
  }
  function reorder(code: string, target: string) {
    if (code === target) return;
    setRows(current => {
      const from = current.findIndex(row => row.code === code);
      const to = current.findIndex(row => row.code === target);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
  }
  return <section className="ccw" lang={language} aria-label={t.title}>
    <header className="ccw-header"><h2>{t.title}</h2></header>
    <div className="ccw-table"><div className="ccw-head"><span>{t.currency}</span><span>{t.amount}</span></div>
      {rows.map(row => <div className={`ccw-row ${source.code === row.code ? 'ccw-active' : ''} ${dragging === row.code ? 'ccw-dragging' : ''}`} key={row.code} data-currency={row.code}>
        <div className="ccw-currency"><button className="ccw-drag-handle" aria-label={`${t.reorder} ${row.code}`} title={t.dragHint}
          onPointerDown={event => { if (event.button !== 0) return; dragCode.current = row.code; setDragging(row.code); event.currentTarget.setPointerCapture(event.pointerId); }}
          onPointerMove={event => { if (!dragCode.current) return; const target = document.elementFromPoint(event.clientX, event.clientY)?.closest<HTMLElement>('[data-currency]')?.dataset.currency; if (target) reorder(dragCode.current, target); }}
          onPointerUp={() => { dragCode.current = null; setDragging(null); }}
          onPointerCancel={() => { dragCode.current = null; setDragging(null); }}
          onLostPointerCapture={() => { dragCode.current = null; setDragging(null); }}
          onKeyDown={event => { if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return; event.preventDefault(); const index = rows.findIndex(r => r.code === row.code); const target = rows[index + (event.key === 'ArrowUp' ? -1 : 1)]; if (target) reorder(row.code, target.code); }}
        ><span aria-hidden="true">⠿</span></button><strong>{row.code}</strong><span>{names.get(row.code) ?? currencyName(row.code, language)}</span>{['EUR', 'USD'].includes(row.code) ? <small>{t.fixed}</small> : <button className="ccw-remove" aria-label={`${t.remove} ${row.code}`} onClick={() => remove(row.code)}>×</button>}</div>
        <div className="ccw-value"><label className="ccw-sr" htmlFor={`amount-${storageKey}-${row.code}`}>{t.valueIn} {row.code}</label><input id={`amount-${storageKey}-${row.code}`} aria-label={`${t.valueIn} ${row.code}`} inputMode="numeric" value={formatAmount(row.amount, row.code, locale)} onChange={e => edit(row.code, e.target.value)} onFocus={e => e.target.select()} aria-invalid={!!row.error} aria-describedby={`status-${storageKey}-${row.code}`}/><span className="ccw-status" id={`status-${storageKey}-${row.code}`} role="status">{row.loading ? <><i className="ccw-spinner"/> {t.converting}</> : (row.error ? t[row.error] : source.code === row.code ? t.reference : t.converted)}</span></div>
      </div>)}
    </div>
    <div className="ccw-add"><div className="ccw-search"><select aria-label={t.select} value={selected} onChange={e => setSelected(e.target.value)} disabled={catalogLoading}><option value="">{catalogLoading ? t.loadingCurrencies : t.choose}</option>{choices.map(c => <option value={c.iso_code} key={c.iso_code}>{c.iso_code} · {names.get(c.iso_code)}</option>)}</select><button onClick={add} disabled={!selected || rows.length >= 30}>{t.add}</button></div>{!catalogLoading && !catalogError && choices.length === 0 && <p role="status">{t.noCurrencies}</p>}{catalogError && <p role="alert">{t.catalogError}</p>}</div>
    <footer className="ccw-footer">
      <div className="ccw-info" ref={infoRef}>
        <button className="ccw-info-button" ref={infoButtonRef} aria-label={t.info} aria-expanded={infoOpen} aria-controls={`info-${storageKey}`} onClick={() => setInfoOpen(open => !open)}>i</button>
        {infoOpen && <div className="ccw-info-menu" id={`info-${storageKey}`} role="region" aria-label={t.info}>
          <strong>Frankfurter v2</strong>
          <p role="status">{rows.some(r => r.loading) || catalogLoading ? t.updating : catalogError || rows.some(r => r.error) ? t.unavailable : t.loaded}</p>
          <p>{dates.length ? `${t.rates}: ${dates.map(d => formatRateDate(d, language)).join(' · ')}` : t.daily}</p>
          <p>{t.note}</p>
          <button onClick={() => { revision.current++; client.clear(); setRefresh(r => r + 1); }}>{t.refresh}</button>
        </div>}
      </div>
      <span className="ccw-credit"><span aria-hidden="true">♡</span> LOVEThenDO</span>
    </footer>
  </section>;
}
