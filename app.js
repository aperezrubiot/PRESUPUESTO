// app.js — Punto de entrada de la aplicación.

async function init() {
  const status = document.getElementById('status');
  if (loadCache()) render();           // muestra caché al instante
  try {
    status.textContent = 'Conectando con Google Sheets…';
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

document.addEventListener('DOMContentLoaded', init);
