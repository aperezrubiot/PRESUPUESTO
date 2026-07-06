// settings.js — Lógica de Configuración: ingreso, presupuestos y tema de colores.

const THEME_KEY = 'presupuesto_theme_v1';
const TEMA_OSCURO = { '--bg': '#0b0b0f', '--card': '#16161d', '--text': '#f5f5f7', '--accent': '#6366f1' };
const TEMA_CLARO  = { '--bg': '#f2f2f5', '--card': '#ffffff', '--text': '#111116', '--accent': '#6366f1' };

function setupSettings() {
  const btnIngreso = document.getElementById('cfg-guardar-ingreso');
  if (btnIngreso) btnIngreso.addEventListener('click', onGuardarIngreso);

  const btnPresu = document.getElementById('cfg-guardar-presupuestos');
  if (btnPresu) btnPresu.addEventListener('click', onGuardarPresupuestos);

  document.querySelectorAll('[data-theme-preset]').forEach(b =>
    b.addEventListener('click', () => aplicarPreset(b.dataset.themePreset))
  );
  document.querySelectorAll('.color-picker').forEach(inp =>
    inp.addEventListener('input', onColorChange)
  );
  const btnReset = document.getElementById('cfg-reset-tema');
  if (btnReset) btnReset.addEventListener('click', resetTema);

  cargarTemaGuardado();
}

function renderSettings() {
  const ingresoInput = document.getElementById('cfg-ingreso');
  if (ingresoInput) ingresoInput.value = toNumber(getConfigValue('ingreso_mensual', 0));

  const cont = document.getElementById('cfg-presupuestos-body');
  if (cont) {
    const cats = categoriasActivas();
    cont.innerHTML = cats.map(c => `
      <label class="field">
        <span>${(c.emoji || '')} ${c.nombre}</span>
        <input type="number" inputmode="decimal" data-presu-cat="${escapeHtml(c.nombre)}" value="${getPresupuesto(c.nombre)}">
      </label>`).join('');
  }

  ['--bg', '--card', '--text', '--accent'].forEach(v => {
    const inp = document.querySelector(`.color-picker[data-var="${v}"]`);
    if (!inp) return;
    const actual = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
    if (actual) inp.value = rgbToHex(actual) || actual;
  });
}

async function onGuardarIngreso() {
  const btn = document.getElementById('cfg-guardar-ingreso');
  const valor = toNumber(val('cfg-ingreso'));
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await actualizarConfig('ingreso_mensual', valor);
    const row = STORE.data.config.find(r => r.clave === 'ingreso_mensual');
    if (row) row.valor = valor; else STORE.data.config.push({ clave: 'ingreso_mensual', valor });
    setData(STORE.data);
    renderDashboard();
    toast('Ingreso actualizado ✅');
  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

async function onGuardarPresupuestos() {
  const btn = document.getElementById('cfg-guardar-presupuestos');
  const inputs = document.querySelectorAll('[data-presu-cat]');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    for (const inp of inputs) {
      const cat = inp.dataset.presuCat;
      const valor = toNumber(inp.value);
      await actualizarPresupuesto(cat, valor);
      const row = STORE.data.presupuestos.find(p => p.categoria === cat);
      if (row) row.presupuesto = valor; else STORE.data.presupuestos.push({ categoria: cat, presupuesto: valor });
    }
    setData(STORE.data);
    renderDashboard();
    toast('Presupuestos actualizados ✅');
  } catch (e) {
    toast('Error: ' + e.message);
  } finally {
    btn.disabled = false; btn.textContent = 'Guardar presupuestos';
  }
}

/* ---------- Tema de colores ---------- */
function aplicarTema(vars) {
  Object.entries(vars).forEach(([k, v]) => document.documentElement.style.setProperty(k, v));
  try { localStorage.setItem(THEME_KEY, JSON.stringify(vars)); } catch (e) {}
}
function aplicarPreset(nombre) {
  aplicarTema(nombre === 'claro' ? TEMA_CLARO : TEMA_OSCURO);
  renderSettings();
}
function onColorChange(e) {
  document.documentElement.style.setProperty(e.target.dataset.var, e.target.value);
  guardarTemaActual();
}
function guardarTemaActual() {
  const vars = {};
  ['--bg', '--card', '--text', '--accent'].forEach(v => {
    vars[v] = getComputedStyle(document.documentElement).getPropertyValue(v).trim();
  });
  try { localStorage.setItem(THEME_KEY, JSON.stringify(vars)); } catch (e) {}
}
function cargarTemaGuardado() {
  try {
    const raw = localStorage.getItem(THEME_KEY);
    if (raw) aplicarTema(JSON.parse(raw));
  } catch (e) {}
}
function resetTema() {
  localStorage.removeItem(THEME_KEY);
  aplicarTema(TEMA_OSCURO);
  renderSettings();
}
function rgbToHex(color) {
  if (color.startsWith('#')) return color;
  const m = color.match(/\d+/g);
  if (!m) return null;
  return '#' + m.slice(0, 3).map(n => Number(n).toString(16).padStart(2, '0')).join('');
}
