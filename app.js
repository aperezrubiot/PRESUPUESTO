// app.js — Punto de entrada de la aplicación.

async function init() {
  const status = document.getElementById('status');
  setupTabs();
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
  const d = STORE.data;
  document.getElementById('ingreso').textContent = formatMoney(getConfigValue('ingreso_mensual', 0));
  document.getElementById('nmov').textContent = d.historial.length;
  document.getElementById('ncat').textContent = d.categorias.length;
  document.getElementById('ntar').textContent = d.tarjetas.length;
}

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

document.addEventListener('DOMContentLoaded', init);
