// utils.js — Funciones auxiliares (dinero, fechas, formato).

function toNumber(v) {
  if (typeof v === 'number') return v;
  if (!v) return 0;
  return Number(String(v).replace(/[^0-9.-]/g, '')) || 0;
}

function formatMoney(n) {
  return new Intl.NumberFormat(CONFIG.LOCALE, {
    style: 'currency', currency: CONFIG.MONEDA,
    minimumFractionDigits: 0, maximumFractionDigits: 0,
  }).format(toNumber(n));
}

function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return v;
  const s = String(v).slice(0, 10);
  const p = s.split('-');
  if (p.length === 3) return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
  const d = new Date(v);
  return isNaN(d) ? null : d;
}

function formatDate(v) {
  const d = parseDate(v);
  if (!d) return '';
  return new Intl.DateTimeFormat(CONFIG.LOCALE,
    { day: '2-digit', month: 'short', year: 'numeric' }).format(d);
}

function monthKey(v) {
  const d = parseDate(v);
  if (!d) return 'sin-fecha';
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

function monthLabel(key) {
  const [y, m] = key.split('-');
  const d = new Date(Number(y), Number(m) - 1, 1);
  const s = new Intl.DateTimeFormat(CONFIG.LOCALE, { month: 'long', year: 'numeric' }).format(d);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function todayISO() {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0')
    + '-' + String(d.getDate()).padStart(2, '0');
}
