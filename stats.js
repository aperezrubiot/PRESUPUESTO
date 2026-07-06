// stats.js — Cálculos y render de la pestaña Estadísticas.

function renderStats() {
  const cont = document.getElementById('stats-body');
  if (!cont) return;

  const historial = STORE.data.historial;
  if (!historial.length) {
    cont.innerHTML = '<p class="placeholder">Aún no hay movimientos para analizar.</p>';
    return;
  }

  const mesActual = mesSeleccionado || getMesesDisponibles()[0];
  cont.innerHTML =
    bloquePronostico(mesActual) +
    bloqueComparacion(mesActual) +
    bloquePromedios(mesActual) +
    bloqueGastoPorMes() +
    bloqueTarjetas(mesActual) +
    bloqueTopCompras(mesActual) +
    bloqueTopCategorias(mesActual);
}

/* ---- Helpers de fecha ---- */
function movsDeMes(mes) {
  return STORE.data.historial.filter(m => monthKey(m.fecha) === mes);
}
function totalDe(movs) {
  return movs.reduce((s, m) => s + toNumber(m.monto), 0);
}
function diasDelMes(mes) {
  const [y, mo] = mes.split('-').map(Number);
  return new Date(y, mo, 0).getDate();
}
function esMesActual(mes) {
  const [y, mo] = mes.split('-').map(Number);
  const hoy = new Date();
  return y === hoy.getFullYear() && mo === hoy.getMonth() + 1;
}
function mesAnterior(mes) {
  const [y, mo] = mes.split('-').map(Number);
  const d = new Date(y, mo - 2, 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
}

/* ---- 1. Pronóstico ---- */
function bloquePronostico(mes) {
  const movs = movsDeMes(mes);
  const gastado = totalDe(movs);
  const diasMes = diasDelMes(mes);
  const ingreso = toNumber(getConfigValue('ingreso_mensual', 0));

  let pronostico, nota;
  if (esMesActual(mes)) {
    const hoy = new Date().getDate();
    const ritmo = hoy > 0 ? gastado / hoy : 0;
    pronostico = ritmo * diasMes;
    nota = `Proyección basada en tu ritmo de ${formatMoney(ritmo)}/día (día ${hoy} de ${diasMes}).`;
  } else {
    pronostico = gastado;
    nota = 'Mes finalizado: total real.';
  }

  const sobrePresupuesto = ingreso > 0 && pronostico > ingreso;
  const claseP = sobrePresupuesto ? 'neg' : '';

  return `
    <div class="card">
      <h3 class="card-title">Pronóstico de fin de mes — ${monthLabel(mes)}</h3>
      <div class="stat-grid">
        <div class="stat-item"><span>${formatMoney(gastado)}</span><small>Gastado a hoy</small></div>
        <div class="stat-item"><span class="${claseP}">${formatMoney(pronostico)}</span><small>Proyección fin de mes</small></div>
        <div class="stat-item"><span>${formatMoney(ingreso)}</span><small>Ingreso mensual</small></div>
      </div>
      <p class="stat-nota">${nota}${sobrePresupuesto ? ' ⚠️ Vas encaminado a superar tu ingreso.' : ''}</p>
    </div>`;
}

/* ---- 2. Comparación con mes anterior ---- */
function bloqueComparacion(mes) {
  const prev = mesAnterior(mes);
  const actualMovs = movsDeMes(mes);
  const prevMovs = movsDeMes(prev);
  const totalActual = totalDe(actualMovs);
  const totalPrev = totalDe(prevMovs);

  if (totalPrev === 0) {
    return `
      <div class="card">
        <h3 class="card-title">Comparación con mes anterior</h3>
        <p class="stat-nota">No hay datos de ${monthLabel(prev)} para comparar.</p>
      </div>`;
  }

  const diff = totalActual - totalPrev;
  const pctDiff = (diff / totalPrev) * 100;
  const subio = diff > 0;

  // Por categoría
  const catActual = agrupaPorCat(actualMovs);
  const catPrev = agrupaPorCat(prevMovs);
  const todasCats = new Set([...Object.keys(catActual), ...Object.keys(catPrev)]);
  const filas = Array.from(todasCats).map(c => {
    const a = catActual[c] || 0;
    const p = catPrev[c] || 0;
    const d = a - p;
    return { cat: c, actual: a, prev: p, diff: d };
  }).filter(f => f.actual !== 0 || f.prev !== 0)
    .sort((x, y) => Math.abs(y.diff) - Math.abs(x.diff))
    .slice(0, 5);

  const filasHtml = filas.map(f => {
    const cls = f.diff > 0 ? 'neg' : 'pos';
    const signo = f.diff > 0 ? '+' : '';
    return `
      <div class="comp-row">
        <span class="comp-cat">${emojiDe(f.cat)} ${f.cat}</span>
        <span class="comp-nums">${formatMoney(f.actual)} <span class="res-sep">vs</span> ${formatMoney(f.prev)}</span>
        <span class="comp-diff ${cls}">${signo}${formatMoney(f.diff)}</span>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <h3 class="card-title">${monthLabel(mes)} vs ${monthLabel(prev)}</h3>
      <div class="stat-grid">
        <div class="stat-item"><span>${formatMoney(totalActual)}</span><small>${monthLabel(mes)}</small></div>
        <div class="stat-item"><span>${formatMoney(totalPrev)}</span><small>${monthLabel(prev)}</small></div>
        <div class="stat-item"><span class="${subio ? 'neg' : 'pos'}">${subio ? '+' : ''}${pctDiff.toFixed(1)}%</span><small>Variación</small></div>
      </div>
      <p class="stat-nota">Mayores cambios por categoría:</p>
      ${filasHtml}
    </div>`;
}

/* ---- 3. Promedios ---- */
function bloquePromedios(mes) {
  const movs = movsDeMes(mes);
  const total = totalDe(movs);
  const diasMes = diasDelMes(mes);
  const dias = esMesActual(mes) ? new Date().getDate() : diasMes;
  const promDiario = dias > 0 ? total / dias : 0;
  const promSemanal = promDiario * 7;
  const promMensual = promDiario * diasMes;

  return `
    <div class="card">
      <h3 class="card-title">Promedios de gasto</h3>
      <div class="stat-grid">
        <div class="stat-item"><span>${formatMoney(promDiario)}</span><small>Diario</small></div>
        <div class="stat-item"><span>${formatMoney(promSemanal)}</span><small>Semanal</small></div>
        <div class="stat-item"><span>${formatMoney(promMensual)}</span><small>Mensual (proy.)</small></div>
      </div>
    </div>`;
}

/* ---- 4. Gasto por mes (últimos 6) ---- */
function bloqueGastoPorMes() {
  const meses = getMesesDisponibles().slice(0, 6).reverse();
  const maxTotal = Math.max(...meses.map(m => totalDe(movsDeMes(m))), 1);

  const filas = meses.map(m => {
    const t = totalDe(movsDeMes(m));
    const w = (t / maxTotal) * 100;
    return `
      <div class="bar-row">
        <span class="bar-label">${monthLabel(m)}</span>
        <div class="bar-track"><div class="bar-fill" style="width:${w}%"></div></div>
        <span class="bar-value">${formatMoney(t)}</span>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <h3 class="card-title">Gasto por mes</h3>
      ${filas}
    </div>`;
}

/* ---- 5. Tarjeta más utilizada ---- */
function bloqueTarjetas(mes) {
  const movs = movsDeMes(mes);
  const porTarjeta = {};
  movs.forEach(m => {
    const t = m.tarjeta || 'Sin tarjeta';
    porTarjeta[t] = (porTarjeta[t] || 0) + toNumber(m.monto);
  });
  const entradas = Object.entries(porTarjeta).sort((a, b) => b[1] - a[1]);
  if (!entradas.length) return '';

  const filas = entradas.map(([t, v]) => `
      <div class="comp-row">
        <span class="comp-cat">${escapeHtml(t)}</span>
        <span class="comp-diff">${formatMoney(v)}</span>
      </div>`).join('');

  return `
    <div class="card">
      <h3 class="card-title">Uso por tarjeta — ${monthLabel(mes)}</h3>
      ${filas}
    </div>`;
}

/* ---- 6. Top compras ---- */
function bloqueTopCompras(mes) {
  const movs = movsDeMes(mes).slice().sort((a, b) => toNumber(b.monto) - toNumber(a.monto)).slice(0, 5);
  if (!movs.length) return '';
  const filas = movs.map(m => `
      <div class="comp-row">
        <span class="comp-cat">${emojiDe(m.categoria)} ${escapeHtml(m.descripcion)}</span>
        <span class="comp-sub">${formatDate(m.fecha)}</span>
        <span class="comp-diff">${formatMoney(m.monto)}</span>
      </div>`).join('');

  return `
    <div class="card">
      <h3 class="card-title">Top 5 compras — ${monthLabel(mes)}</h3>
      ${filas}
    </div>`;
}

/* ---- 7. Top categorías ---- */
function bloqueTopCategorias(mes) {
  const movs = movsDeMes(mes);
  const porCat = agrupaPorCat(movs);
  const entradas = Object.entries(porCat).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (!entradas.length) return '';
  const total = totalDe(movs);

  const filas = entradas.map(([c, v]) => {
    const pct = total > 0 ? (v / total) * 100 : 0;
    return `
      <div class="comp-row">
        <span class="comp-cat">${emojiDe(c)} ${c}</span>
        <span class="comp-sub">${pct.toFixed(0)}%</span>
        <span class="comp-diff">${formatMoney(v)}</span>
      </div>`;
  }).join('');

  return `
    <div class="card">
      <h3 class="card-title">Top categorías — ${monthLabel(mes)}</h3>
      ${filas}
    </div>`;
}

/* ---- Utilidades ---- */
function agrupaPorCat(movs) {
  const r = {};
  movs.forEach(m => {
    const c = m.categoria || 'Sin categoría';
    r[c] = (r[c] || 0) + toNumber(m.monto);
  });
  return r;
}
function emojiDe(nombreCat) {
  const cat = STORE.data.categorias.find(c => c.nombre === nombreCat);
  return (cat && cat.emoji) || '';
}
