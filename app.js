// app.js — Punto de entrada + lógica del Dashboard e Historial.

let mesSeleccionado = null;
let mesesAbiertos = new Set();
let editandoId = null;

async function init() {
  const status = document.getElementById('status');
    setupTabs();
  setupForm();
  setupHistorial();
    setupSettings();
  setupExport();

  if (loadCache()) render();

  try {
    status.textContent = 'Conectando…';
    const data = await apiGet();
    setData(data);
    render();
    status.textContent = 'Conectado ✅';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
    console.error(e);
  }
}

function render() {
  poblarSelectoresFormulario();
  poblarSelectorMes();
  renderDashboard();
  poblarFiltrosHistorial();
  renderHistorial();
  renderSettings();
}



/* ---------- Navegación ---------- */
function setupTabs() {
  const tabs = document.querySelectorAll('.tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      tabs.forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
            tab.classList.add('active');
      document.getElementById('view-' + tab.dataset.tab).classList.add('active');
      if (tab.dataset.tab === 'estadisticas') renderStats();

    });
  });
}

/* ---------- Formulario (Dashboard) ---------- */
function setupForm() {
  const btn = document.getElementById('f-guardar');
  if (btn) btn.addEventListener('click', onGuardar);
  const fecha = document.getElementById('f-fecha');
  if (fecha) fecha.value = todayISO();
  const sel = document.getElementById('mes-selector');
  if (sel) sel.addEventListener('change', () => { mesSeleccionado = sel.value; renderDashboard(); });
}

function poblarSelectoresFormulario() {
  const cat = document.getElementById('f-cat');
  const tar = document.getElementById('f-tar');
  if (!cat || !tar) return;
  const cats = categoriasActivas();
  cat.innerHTML = '<option value="">Categoría…</option>' +
    cats.map(c => `<option value="${c.nombre}">${(c.emoji || '')} ${c.nombre}</option>`).join('');
  const tars = STORE.data.tarjetas.filter(t => String(t.activa).toLowerCase() === 'si');
  tar.innerHTML = '<option value="">Tarjeta…</option>' +
    tars.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
}

async function onGuardar() {
  const btn = document.getElementById('f-guardar');
  const mov = {
    fecha:       val('f-fecha'),
    descripcion: val('f-desc').trim(),
    categoria:   val('f-cat'),
    monto:       toNumber(val('f-monto')),
    tarjeta:     val('f-tar'),
    notas:       val('f-notas').trim(),
  };
  if (!mov.fecha || !mov.descripcion || !mov.categoria || mov.monto <= 0) {
    toast('Completa fecha, descripción, categoría y un monto mayor a 0.');
    return;
  }
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    const res = await crearMovimiento(mov);
    STORE.data.historial.push(res.movimiento);
    setData(STORE.data);
    document.getElementById('f-desc').value = '';
    document.getElementById('f-monto').value = '';
    document.getElementById('f-notas').value = '';
        mesSeleccionado = monthKey(mov.fecha);
    poblarSelectorMes();
    poblarFiltrosHistorial();
    renderDashboard();
    renderHistorial();
    toast('Gasto guardado ✅');

  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

/* ---------- Selector de mes (Dashboard) ---------- */
function poblarSelectorMes() {
  const sel = document.getElementById('mes-selector');
  if (!sel) return;
  const meses = getMesesDisponibles();
  if (!mesSeleccionado || !meses.includes(mesSeleccionado)) mesSeleccionado = meses[0];
  sel.innerHTML = meses.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.value = mesSeleccionado;
}

/* ---------- Cálculos compartidos ---------- */
function categoriasActivas() {
  return STORE.data.categorias
    .filter(c => String(c.activa).toLowerCase() === 'si')
    .sort((a, b) => toNumber(a.orden) - toNumber(b.orden));
}

function getMesesDisponibles() {
  const set = new Set(STORE.data.historial.map(m => monthKey(m.fecha)));
  set.add(monthKey(todayISO()));
  set.delete('sin-fecha');
  const arr = Array.from(set).sort().reverse();
  return arr.length ? arr : [monthKey(todayISO())];
}

function getPresupuesto(categoria) {
  const row = STORE.data.presupuestos.find(p => String(p.categoria) === String(categoria));
  return row ? toNumber(row.presupuesto) : 0;
}

function computeDashboard(mes) {
  const movs = STORE.data.historial.filter(m => monthKey(m.fecha) === mes);
  const totalGastado = movs.reduce((s, m) => s + toNumber(m.monto), 0);
  const ingreso = toNumber(getConfigValue('ingreso_mensual', 0));
  const disponible = ingreso - totalGastado;
  const pct = ingreso > 0 ? (totalGastado / ingreso) * 100 : 0;
  const numCompras = movs.length;
  const promCompra = numCompras > 0 ? totalGastado / numCompras : 0;

  const [y, mo] = mes.split('-').map(Number);
  const hoy = new Date();
  const esActual = (y === hoy.getFullYear() && mo === hoy.getMonth() + 1);
  const diasMes = new Date(y, mo, 0).getDate();
  const dias = esActual ? hoy.getDate() : diasMes;
  const promDiario = dias > 0 ? totalGastado / dias : 0;

  const porCat = {};
  movs.forEach(m => {
    const c = m.categoria || 'Sin categoría';
    porCat[c] = (porCat[c] || 0) + toNumber(m.monto);
  });
  let topCat = '—', topVal = 0;
  for (const c in porCat) if (porCat[c] > topVal) { topVal = porCat[c]; topCat = c; }

  return { totalGastado, ingreso, disponible, pct, numCompras, promCompra, promDiario, porCat, topCat, topVal, movs };
}

/* ---------- Render Dashboard ---------- */
function renderDashboard() {
  if (!mesSeleccionado) mesSeleccionado = getMesesDisponibles()[0];
  const d = computeDashboard(mesSeleccionado);

  setText('kpi-ingreso', formatMoney(d.ingreso));
  setText('kpi-gastado', formatMoney(d.totalGastado));

  const disp = document.getElementById('kpi-disponible');
  if (disp) { disp.textContent = formatMoney(d.disponible); disp.classList.toggle('neg', d.disponible < 0); }

  setText('kpi-pct', d.pct.toFixed(1) + '%');
  setText('kpi-compras', d.numCompras);
  setText('kpi-promcompra', formatMoney(d.promCompra));
  setText('kpi-promdiario', formatMoney(d.promDiario));
  setText('kpi-topcat', d.topVal > 0 ? d.topCat : '—');

  renderResumen(d);
  renderCharts(d, d.movs, mesSeleccionado, categoriasActivas());
}

function renderResumen(d) {
  const cont = document.getElementById('resumen-body');
  if (!cont) return;
  const cats = categoriasActivas();
  if (!cats.length) { cont.innerHTML = '<p class="placeholder">Sin categorías.</p>'; return; }

  cont.innerHTML = cats.map(c => {
    const presu = getPresupuesto(c.nombre);
    const gastado = d.porCat[c.nombre] || 0;
    const disp = presu - gastado;
    const sinPresu = presu <= 0;
    const pct = sinPresu ? 0 : (gastado / presu) * 100;
    const nivel = sinPresu ? (gastado > 0 ? 'over' : 'ok') : (pct > 100 ? 'over' : (pct >= 75 ? 'warn' : 'ok'));
    const w = sinPresu ? (gastado > 0 ? 100 : 0) : Math.min(pct, 100);
    const pctTxt = sinPresu ? (gastado > 0 ? 'sin presupuesto' : '—') : pct.toFixed(0) + '%';
    return `
      <div class="res-row">
        <div class="res-head">
          <span class="res-cat">${(c.emoji || '')} ${c.nombre}</span>
          <span class="res-nums">${formatMoney(gastado)} <span class="res-sep">/</span> ${formatMoney(presu)}</span>
        </div>
        <div class="res-bar"><div class="res-fill ${nivel}" style="width:${w}%"></div></div>
        <div class="res-foot">
          <span class="${disp < 0 ? 'neg' : ''}">Disponible ${formatMoney(disp)}</span>
          <span>${pctTxt}</span>
        </div>
      </div>`;
  }).join('');
}

/* ================= HISTORIAL ================= */

function setupHistorial() {
  ['h-buscar', 'h-cat', 'h-tar', 'h-desde', 'h-hasta', 'h-orden'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('input', renderHistorial);
  });
  const limpiar = document.getElementById('h-limpiar');
  if (limpiar) limpiar.addEventListener('click', () => {
    document.getElementById('h-buscar').value = '';
    document.getElementById('h-cat').value = '';
    document.getElementById('h-tar').value = '';
    document.getElementById('h-desde').value = '';
    document.getElementById('h-hasta').value = '';
    document.getElementById('h-orden').value = 'fecha-desc';
    renderHistorial();
  });
}

function poblarFiltrosHistorial() {
  const cat = document.getElementById('h-cat');
  const tar = document.getElementById('h-tar');
  const lista = document.getElementById('h-buscar-list');
  if (lista) {
    const descripciones = Array.from(new Set(
      STORE.data.historial.map(m => m.descripcion).filter(Boolean)
    )).sort();
    lista.innerHTML = descripciones.map(d => `<option value="${escapeHtml(d)}"></option>`).join('');
  }
  if (!cat || !tar) return;

  const cats = categoriasActivas();
  cat.innerHTML = '<option value="">Todas</option>' +
    cats.map(c => `<option value="${c.nombre}">${(c.emoji || '')} ${c.nombre}</option>`).join('');
  const tars = STORE.data.tarjetas.filter(t => String(t.activa).toLowerCase() === 'si');
  tar.innerHTML = '<option value="">Todas</option>' +
    tars.map(t => `<option value="${t.nombre}">${t.nombre}</option>`).join('');
}

function movimientosFiltrados() {
  const buscar = val('h-buscar').toLowerCase().trim();
  const cat = val('h-cat');
  const tar = val('h-tar');
  const desde = val('h-desde');
  const hasta = val('h-hasta');
  const orden = val('h-orden') || 'fecha-desc';

  let movs = STORE.data.historial.filter(m => {
    if (buscar) {
      const texto = (String(m.descripcion || '') + ' ' + String(m.notas || '')).toLowerCase();
      if (!texto.includes(buscar)) return false;
    }
    if (cat && m.categoria !== cat) return false;
    if (tar && m.tarjeta !== tar) return false;
    if (desde && String(m.fecha).slice(0, 10) < desde) return false;
    if (hasta && String(m.fecha).slice(0, 10) > hasta) return false;
    return true;
  });

  movs.sort((a, b) => {
    if (orden === 'fecha-asc') return String(a.fecha).localeCompare(String(b.fecha));
    if (orden === 'monto-desc') return toNumber(b.monto) - toNumber(a.monto);
    if (orden === 'monto-asc') return toNumber(a.monto) - toNumber(b.monto);
    return String(b.fecha).localeCompare(String(a.fecha)); // fecha-desc default
  });
  return movs;
}

function renderHistorial() {
  const cont = document.getElementById('historial-body');
  if (!cont) return;
  const movs = movimientosFiltrados();

  if (!movs.length) {
    cont.innerHTML = '<p class="placeholder">No hay movimientos con estos filtros.</p>';
    return;
  }

  const grupos = {};
  movs.forEach(m => {
    const k = monthKey(m.fecha);
    if (!grupos[k]) grupos[k] = [];
    grupos[k].push(m);
  });
  const clavesMes = Object.keys(grupos).sort().reverse();

  if (mesesAbiertos.size === 0) mesesAbiertos.add(clavesMes[0]);

  cont.innerHTML = clavesMes.map(k => {
    const items = grupos[k];
    const total = items.reduce((s, m) => s + toNumber(m.monto), 0);
    const abierto = mesesAbiertos.has(k);
    return `
      <div class="mes-group ${abierto ? 'open' : ''}" data-mes="${k}">
        <div class="mes-header" data-toggle="${k}">
          <div class="mes-header-left">
            <span class="mes-caret">▶</span>
            <span class="mes-title">${monthLabel(k)}</span>
          </div>
          <span class="mes-total">${items.length} · ${formatMoney(total)}</span>
        </div>
        <div class="mes-body">
          ${items.map(m => movRowHtml(m)).join('')}
        </div>
      </div>`;
  }).join('');

  // Listeners de acordeón
  cont.querySelectorAll('[data-toggle]').forEach(h => {
    h.addEventListener('click', () => {
      const k = h.dataset.toggle;
      if (mesesAbiertos.has(k)) mesesAbiertos.delete(k); else mesesAbiertos.add(k);
      renderHistorial();
    });
  });

  // Listeners de acciones
  cont.querySelectorAll('[data-edit]').forEach(b => b.addEventListener('click', () => abrirEdicion(b.dataset.edit)));
  cont.querySelectorAll('[data-dup]').forEach(b => b.addEventListener('click', () => onDuplicar(b.dataset.dup)));
  cont.querySelectorAll('[data-del]').forEach(b => b.addEventListener('click', () => onEliminar(b.dataset.del)));
  cont.querySelectorAll('[data-save]').forEach(b => b.addEventListener('click', () => onGuardarEdicion(b.dataset.save)));
  cont.querySelectorAll('[data-cancel]').forEach(b => b.addEventListener('click', () => { editandoId = null; renderHistorial(); }));
}

function movRowHtml(m) {
  if (editandoId === m.id) return editRowHtml(m);
  const cat = STORE.data.categorias.find(c => c.nombre === m.categoria);
  return `
    <div class="mov-row">
      <div class="mov-left">
        <span class="mov-desc">${(cat && cat.emoji) || ''} ${escapeHtml(m.descripcion)}</span>
        <span class="mov-meta">${formatDate(m.fecha)} · ${escapeHtml(m.categoria || '')} · ${escapeHtml(m.tarjeta || '')}${m.notas ? ' · ' + escapeHtml(m.notas) : ''}</span>
      </div>
      <div class="mov-right">
        <span class="mov-monto">${formatMoney(m.monto)}</span>
        <div class="mov-actions">
          <button data-edit="${m.id}" title="Editar">✏️</button>
          <button data-dup="${m.id}" title="Duplicar">⧉</button>
          <button class="danger" data-del="${m.id}" title="Eliminar">🗑️</button>
        </div>
      </div>
    </div>`;
}

function editRowHtml(m) {
  const cats = categoriasActivas();
  const tars = STORE.data.tarjetas.filter(t => String(t.activa).toLowerCase() === 'si');
  return `
    <div class="edit-row">
      <div class="edit-grid">
        <input type="date" id="e-fecha-${m.id}" value="${String(m.fecha).slice(0,10)}">
        <input type="text" id="e-desc-${m.id}" value="${escapeHtml(m.descripcion)}" placeholder="Descripción">
        <select id="e-cat-${m.id}">
          ${cats.map(c => `<option value="${c.nombre}" ${c.nombre === m.categoria ? 'selected' : ''}>${(c.emoji||'')} ${c.nombre}</option>`).join('')}
        </select>
        <input type="number" id="e-monto-${m.id}" value="${toNumber(m.monto)}" inputmode="decimal">
        <select id="e-tar-${m.id}">
          ${tars.map(t => `<option value="${t.nombre}" ${t.nombre === m.tarjeta ? 'selected' : ''}>${t.nombre}</option>`).join('')}
        </select>
        <input type="text" id="e-notas-${m.id}" value="${escapeHtml(m.notas || '')}" placeholder="Notas">
      </div>
      <div class="edit-actions">
        <button class="btn-secondary" data-cancel="${m.id}">Cancelar</button>
        <button class="btn-primary" data-save="${m.id}">Guardar cambios</button>
      </div>
    </div>`;
}

function abrirEdicion(id) { editandoId = id; renderHistorial(); }

async function onGuardarEdicion(id) {
  const mov = {
    id,
    fecha:       val(`e-fecha-${id}`),
    descripcion: val(`e-desc-${id}`).trim(),
    categoria:   val(`e-cat-${id}`),
    monto:       toNumber(val(`e-monto-${id}`)),
    tarjeta:     val(`e-tar-${id}`),
    notas:       val(`e-notas-${id}`).trim(),
  };
  if (!mov.fecha || !mov.descripcion || mov.monto <= 0) {
    toast('Revisa fecha, descripción y monto.');
    return;
  }
  try {
    await actualizarMovimiento(mov);
    const idx = STORE.data.historial.findIndex(m => m.id === id);
    if (idx > -1) STORE.data.historial[idx] = Object.assign({}, STORE.data.historial[idx], mov);
    setData(STORE.data);
    editandoId = null;
    renderHistorial();
    renderDashboard();
    toast('Movimiento actualizado ✅');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

async function onDuplicar(id) {
  try {
    const res = await duplicarMovimiento(id);
    STORE.data.historial.push(res.movimiento);
    setData(STORE.data);
    renderHistorial();
    renderDashboard();
    toast('Movimiento duplicado ✅');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

async function onEliminar(id) {
  const mov = STORE.data.historial.find(m => m.id === id);
  const nombre = mov ? mov.descripcion : 'este movimiento';
  const ok = confirm(`¿Eliminar "${nombre}"? Esta acción no se puede deshacer.`);
  if (!ok) return;
  try {
    await eliminarMovimiento(id);
    STORE.data.historial = STORE.data.historial.filter(m => m.id !== id);
    setData(STORE.data);
    renderHistorial();
    renderDashboard();
    toast('Movimiento eliminado');
  } catch (e) {
    toast('Error: ' + e.message);
  }
}

function escapeHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
  ));
}

/* ---------- Helpers de UI ---------- */
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v; }
function val(id) { const el = document.getElementById(id); return el ? el.value : ''; }

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 2600);
}

document.addEventListener('DOMContentLoaded', init);
