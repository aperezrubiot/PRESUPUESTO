// app.js — Punto de entrada + lógica del Dashboard.

let mesSeleccionado = null;

async function init() {
  const status = document.getElementById('status');
  setupTabs();
  setupForm();
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
    });
  });
}

/* ---------- Formulario ---------- */
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
    renderDashboard();
    toast('Gasto guardado ✅');
  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

/* ---------- Selector de mes ---------- */
function poblarSelectorMes() {
  const sel = document.getElementById('mes-selector');
  if (!sel) return;
  const meses = getMesesDisponibles();
  if (!mesSeleccionado || !meses.includes(mesSeleccionado)) mesSeleccionado = meses[0];
  sel.innerHTML = meses.map(m => `<option value="${m}">${monthLabel(m)}</option>`).join('');
  sel.value = mesSeleccionado;
}

/* ---------- Cálculos ---------- */
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

  return { totalGastado, ingreso, disponible, pct, numCompras, promCompra, promDiario, porCat, topCat, topVal };
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

/* ---------- Helpers de UI ---------- */
function setText(id, val) { const el = document.getElementById(id); if (el) el.textContent = val; }
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
