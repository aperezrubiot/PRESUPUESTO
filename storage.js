// storage.js — Estado en memoria y caché local.
const CACHE_KEY = 'presupuesto_cache_v1';

const STORE = {
  data: { config: [], categorias: [], tarjetas: [], presupuestos: [], historial: [] },
};

function getConfigValue(clave, fallback) {
  const row = STORE.data.config.find(r => r.clave === clave);
  return row ? row.valor : fallback;
}

function setData(data) {
  STORE.data = data;
  try { localStorage.setItem(CACHE_KEY, JSON.stringify(data)); } catch (e) {}
}

function loadCache() {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (raw) { STORE.data = JSON.parse(raw); return true; }
  } catch (e) {}
  return false;
}
