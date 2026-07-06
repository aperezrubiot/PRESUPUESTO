// api.js — Comunicación con Google Apps Script.

async function apiGet() {
  const res = await fetch(CONFIG.API_URL, { method: 'GET' });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al leer');
  return json.data;
}

async function apiPost(action, payload) {
  const body = JSON.stringify(Object.assign({ action, token: CONFIG.TOKEN }, payload));
  const res = await fetch(CONFIG.API_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'text/plain;charset=utf-8' }, // evita el bloqueo CORS
    body,
  });
  const json = await res.json();
  if (!json.ok) throw new Error(json.error || 'Error al escribir');
  return json;
}

function crearMovimiento(mov)      { return apiPost('create',    { movimiento: mov }); }
function actualizarMovimiento(mov) { return apiPost('update',    { movimiento: mov }); }
function eliminarMovimiento(id)    { return apiPost('delete',    { id }); }
function duplicarMovimiento(id)    { return apiPost('duplicate', { id }); }
