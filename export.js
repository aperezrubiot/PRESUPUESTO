// export.js — Exportar (Excel/CSV/JSON/PDF) e Importar movimientos.

function setupExport() {
  const bind = (id, fn) => { const b = document.getElementById(id); if (b) b.addEventListener('click', fn); };
  bind('exp-excel', exportarExcel);
  bind('exp-csv', exportarCSV);
  bind('exp-json', exportarJSON);
  bind('exp-pdf', exportarPDF);
  bind('imp-guardar', onImportar);
}

/* ---------- Datos comunes para exportar ---------- */
function datosExportar() {
  const mes = mesSeleccionado || getMesesDisponibles()[0];
  const d = computeDashboard(mes);
  const cats = categoriasActivas();

  const presupuestos = cats.map(c => {
    const presu = getPresupuesto(c.nombre);
    const gastado = d.porCat[c.nombre] || 0;
    return { categoria: c.nombre, presupuesto: presu, gastado, disponible: presu - gastado };
  });

  const kpis = {
    mes: monthLabel(mes),
    ingreso_mensual: d.ingreso,
    total_gastado: d.totalGastado,
    disponible: d.disponible,
    porcentaje_utilizado: d.pct.toFixed(1) + '%',
    compras: d.numCompras,
    promedio_por_compra: Math.round(d.promCompra),
    promedio_diario: Math.round(d.promDiario),
  };

  const historial = STORE.data.historial.map(m => ({
    fecha: String(m.fecha).slice(0, 10),
    descripcion: m.descripcion || '',
    categoria: m.categoria || '',
    monto: toNumber(m.monto),
    tarjeta: m.tarjeta || '',
    notas: m.notas || '',
  }));

  return { mes, kpis, presupuestos, historial };
}

function nombreArchivo(base, ext) {
  const mesTxt = (mesSeleccionado || getMesesDisponibles()[0]).replace(/[^0-9-]/g, '');
  return `${base}_${mesTxt}.${ext}`;
}

/* ---------- Excel (3 hojas) ---------- */
function exportarExcel() {
  const { kpis, presupuestos, historial } = datosExportar();
  const wb = XLSX.utils.book_new();

  const kpiRows = Object.entries(kpis).map(([campo, valor]) => ({ campo, valor }));
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(kpiRows), 'Resumen');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(presupuestos), 'Presupuestos');
  XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historial), 'Historial');

  XLSX.writeFile(wb, nombreArchivo('presupuesto', 'xlsx'));
  toast('Excel exportado ✅');
}

/* ---------- CSV (historial) ---------- */
function exportarCSV() {
  const { historial } = datosExportar();
  const ws = XLSX.utils.json_to_sheet(historial);
  const csv = XLSX.utils.sheet_to_csv(ws);
  descargarBlob(csv, nombreArchivo('historial', 'csv'), 'text/csv;charset=utf-8;');
  toast('CSV exportado ✅');
}

/* ---------- JSON ---------- */
function exportarJSON() {
  const { kpis, presupuestos, historial } = datosExportar();
  const contenido = JSON.stringify({ kpis, presupuestos, historial }, null, 2);
  descargarBlob(contenido, nombreArchivo('presupuesto', 'json'), 'application/json');
  toast('JSON exportado ✅');
}

/* ---------- PDF ---------- */
function exportarPDF() {
  const { mes, kpis, presupuestos, historial } = datosExportar();
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();

  doc.setFontSize(16);
  doc.text(`Presupuesto Familiar — ${monthLabel(mes)}`, 14, 18);

  doc.setFontSize(10);
  let y = 28;
  Object.entries(kpis).forEach(([k, v]) => {
    doc.text(`${k.replace(/_/g, ' ')}: ${v}`, 14, y);
    y += 6;
  });

  doc.autoTable({
    startY: y + 6,
    head: [['Categoría', 'Presupuesto', 'Gastado', 'Disponible']],
    body: presupuestos.map(r => [r.categoria, formatMoney(r.presupuesto), formatMoney(r.gastado), formatMoney(r.disponible)]),
    styles: { fontSize: 9 },
  });

  doc.autoTable({
    startY: doc.lastAutoTable.finalY + 10,
    head: [['Fecha', 'Descripción', 'Categoría', 'Monto', 'Tarjeta']],
    body: historial.map(h => [h.fecha, h.descripcion, h.categoria, formatMoney(h.monto), h.tarjeta]),
    styles: { fontSize: 8 },
  });

  doc.save(nombreArchivo('presupuesto', 'pdf'));
  toast('PDF exportado ✅');
}

function descargarBlob(contenido, filename, mime) {
  const blob = new Blob([contenido], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/* ---------- Importar ---------- */
async function onImportar() {
  const input = document.getElementById('imp-file');
  const status = document.getElementById('imp-status');
  const file = input.files[0];
  if (!file) { status.textContent = 'Selecciona un archivo primero.'; return; }

  status.textContent = 'Leyendo archivo…';
  try {
    const filas = await parseArchivoImportar(file);
    if (!filas.length) { status.textContent = 'No se encontraron movimientos válidos.'; return; }

    status.textContent = `Importando ${filas.length} movimientos…`;
    let ok = 0;
    for (const r of filas) {
      const mov = {
        fecha: normalizarFechaImport(r.fecha),
        descripcion: String(r.descripcion || '').trim(),
        categoria: String(r.categoria || '').trim(),
        monto: toNumber(r.monto),
        tarjeta: String(r.tarjeta || '').trim(),
        notas: String(r.notas || '').trim(),
      };
      if (!mov.fecha || !mov.descripcion || mov.monto <= 0) continue;
      const res = await crearMovimiento(mov);
      STORE.data.historial.push(res.movimiento);
      ok++;
    }
    setData(STORE.data);
    renderDashboard();
    poblarFiltrosHistorial();
    renderHistorial();
    status.textContent = `✅ ${ok} de ${filas.length} movimientos importados.`;
    input.value = '';
  } catch (e) {
    status.textContent = 'Error: ' + e.message;
  }
}

function parseArchivoImportar(file) {
  return new Promise((resolve, reject) => {
    const ext = file.name.split('.').pop().toLowerCase();
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'));

    if (ext === 'json') {
      reader.onload = () => {
        try {
          const parsed = JSON.parse(reader.result);
          resolve(Array.isArray(parsed) ? parsed : (parsed.historial || []));
        } catch (e) { reject(new Error('El JSON no es válido')); }
      };
      reader.readAsText(file);
    } else {
      reader.onload = () => {
        try {
          const data = new Uint8Array(reader.result);
          const wb = XLSX.read(data, { type: 'array' });
          const nombreHoja = wb.SheetNames.includes('Historial') ? 'Historial' : wb.SheetNames[0];
          resolve(XLSX.utils.sheet_to_json(wb.Sheets[nombreHoja]));
        } catch (e) { reject(new Error('No se pudo leer el archivo')); }
      };
      reader.readAsArrayBuffer(file);
    }
  });
}

function normalizarFechaImport(v) {
  if (!v) return '';
  if (typeof v === 'number') {
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, '0')}-${String(d.d).padStart(2, '0')}`;
  }
  return String(v).slice(0, 10);
}
