// charts.js — Gráficas con Chart.js.

const CHART_COLORS = ['#6366F1','#10B981','#F59E0B','#3B82F6','#8B5CF6','#EC4899','#14B8A6','#F43F5E','#22C55E','#EF4444'];

let chartDona = null, chartBarras = null, chartLinea = null, chartHorizontal = null;

Chart.defaults.color = '#9a9aa5';
Chart.defaults.font.family = "-apple-system, 'Segoe UI', Roboto, sans-serif";
Chart.defaults.borderColor = '#24242c';

function colorDeCategoria(nombre, index) {
  const cat = STORE.data.categorias.find(c => c.nombre === nombre);
  return (cat && cat.color) ? cat.color : CHART_COLORS[index % CHART_COLORS.length];
}

/* ---------- Dona: distribución por categoría ---------- */
function renderChartDona(porCat) {
  const ctx = document.getElementById('chart-dona');
  if (!ctx) return;
  const entradas = Object.entries(porCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const labels = entradas.map(e => e[0]);
  const data = entradas.map(e => e[1]);
  const colors = labels.map((l, i) => colorDeCategoria(l, i));

  if (chartDona) chartDona.destroy();
  if (!labels.length) return;
  chartDona = new Chart(ctx, {
    type: 'doughnut',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderColor: '#16161d', borderWidth: 2 }] },
    options: {
      responsive: true, maintainAspectRatio: false, cutout: '65%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 12, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.label}: ${formatMoney(c.parsed)}` } },
      },
    },
  });
}

/* ---------- Barras: presupuesto vs gastado ---------- */
function renderChartBarras(cats, porCat) {
  const ctx = document.getElementById('chart-barras');
  if (!ctx) return;
  const labels = cats.map(c => c.nombre);
  const presu = cats.map(c => getPresupuesto(c.nombre));
  const gastado = cats.map(c => porCat[c.nombre] || 0);

  if (chartBarras) chartBarras.destroy();
  chartBarras = new Chart(ctx, {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Presupuesto', data: presu, backgroundColor: '#2a2a35', borderRadius: 6 },
        { label: 'Gastado', data: gastado, backgroundColor: '#6366F1', borderRadius: 6 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { font: { size: 10 }, maxRotation: 40, minRotation: 40 }, grid: { display: false } },
        y: { ticks: { callback: v => formatMoney(v) }, grid: { color: '#20202a' } },
      },
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: { callbacks: { label: c => ` ${c.dataset.label}: ${formatMoney(c.parsed.y)}` } },
      },
    },
  });
}

/* ---------- Línea: evolución acumulada en el mes ---------- */
function renderChartLinea(movs, mes) {
  const ctx = document.getElementById('chart-linea');
  if (!ctx) return;
  const [y, mo] = mes.split('-').map(Number);
  const diasMes = new Date(y, mo, 0).getDate();

  const porDia = new Array(diasMes + 1).fill(0);
  movs.forEach(m => {
    const d = parseDate(m.fecha);
    if (d) porDia[d.getDate()] += toNumber(m.monto);
  });

  const acumulado = [];
  let sum = 0;
  for (let i = 1; i <= diasMes; i++) { sum += porDia[i]; acumulado.push(sum); }

  if (chartLinea) chartLinea.destroy();
  chartLinea = new Chart(ctx, {
    type: 'line',
    data: {
      labels: acumulado.map((_, i) => i + 1),
      datasets: [{
        label: 'Gasto acumulado', data: acumulado,
        borderColor: '#6366F1', backgroundColor: 'rgba(99,102,241,0.12)',
        fill: true, tension: 0.3, pointRadius: 0, pointHoverRadius: 4, borderWidth: 2,
      }],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      scales: {
        x: { title: { display: true, text: 'Día del mes', font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { callback: v => formatMoney(v) }, grid: { color: '#20202a' } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${formatMoney(c.parsed.y)}` } },
      },
    },
  });
}

/* ---------- Horizontal: categorías ordenadas ---------- */
function renderChartHorizontal(porCat) {
  const ctx = document.getElementById('chart-horizontal');
  if (!ctx) return;
  const entradas = Object.entries(porCat).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
  const labels = entradas.map(e => e[0]);
  const data = entradas.map(e => e[1]);
  const colors = labels.map((l, i) => colorDeCategoria(l, i));

  if (chartHorizontal) chartHorizontal.destroy();
  if (!labels.length) return;
  chartHorizontal = new Chart(ctx, {
    type: 'bar',
    data: { labels, datasets: [{ data, backgroundColor: colors, borderRadius: 6, barThickness: 22 }] },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      scales: {
        x: { ticks: { callback: v => formatMoney(v) }, grid: { color: '#20202a' } },
        y: { grid: { display: false }, ticks: { font: { size: 11 } } },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: c => ` ${formatMoney(c.parsed.x)}` } },
      },
    },
  });
}

/* ---------- Punto de entrada: dibuja las 4 ---------- */
function renderCharts(d, movsDelMes, mes, cats) {
  renderChartDona(d.porCat);
  renderChartBarras(cats, d.porCat);
  renderChartLinea(movsDelMes, mes);
  renderChartHorizontal(d.porCat);
}
