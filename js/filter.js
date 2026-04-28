let mainFile = null;
let lastResults = [];

function initFilter() {
  const dzMain = document.getElementById('dzMain');
  const fileMain = document.getElementById('fileMain');

  dzMain.addEventListener('click', () => fileMain.click());
  dzMain.addEventListener('dragover', e => { e.preventDefault(); dzMain.classList.add('drag'); });
  dzMain.addEventListener('dragleave', () => dzMain.classList.remove('drag'));
  dzMain.addEventListener('drop', e => {
    e.preventDefault();
    dzMain.classList.remove('drag');
    const f = e.dataTransfer.files[0];
    if (f) setMainFile(f);
  });
  fileMain.addEventListener('change', e => { if (e.target.files[0]) setMainFile(e.target.files[0]); });
}

function setMainFile(f) {
  mainFile = f;
  const el = document.getElementById('dzFileName');
  if (el) el.textContent = f.name;
  updateRunBtn();
}

async function runFilter() {
  if (!mainFile || activeProvIds.size === 0) return;

  const btn = document.getElementById('runBtn');
  btn.disabled = true;
  btn.textContent = '⏳ FILTRANDO...';

  const selectedProvs = providers.filter(p => activeProvIds.has(p.id));
  const allKw = [
    ...baseKw,
    ...new Set(selectedProvs.flatMap(p => p.extraKw))
  ].map(w => w.toLowerCase());

  const data = await readFile(mainFile);
  const wb = XLSX.read(data, { type: 'array' });
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { defval: '' });

  lastResults = rows.filter(row => {
    const text = Object.values(row).join(' ').toLowerCase();
    return allKw.some(kw => text.includes(kw));
  });

  renderResults(lastResults, rows.length);

  btn.disabled = false;
  btn.textContent = '⚡ FILTRAR';
  document.getElementById('exportBtn').disabled = lastResults.length === 0;
  showToast(`${lastResults.length} artículos encontrados de ${rows.length}`, 'success');
}

function renderResults(results, total) {
  const statsEl = document.getElementById('resultsStats');
  const bodyEl  = document.getElementById('resultsBody');
  const emptyEl = document.getElementById('resultsEmpty');
  const headEl  = document.getElementById('resultsHead');

  statsEl.innerHTML = `<strong>${results.length}</strong> artículos encontrados de <strong>${total}</strong> total`;

  if (results.length === 0) {
    emptyEl.style.display = 'block';
    document.querySelector('.results-table-wrap').style.display = 'none';
    return;
  }

  emptyEl.style.display = 'none';
  document.querySelector('.results-table-wrap').style.display = 'block';

  const cols = Object.keys(results[0]);
  headEl.innerHTML = `<tr>${cols.map(c => `<th>${c}</th>`).join('')}</tr>`;
  bodyEl.innerHTML = results.slice(0, 2000).map(row =>
    `<tr>${cols.map(c => `<td>${row[c] ?? ''}</td>`).join('')}</tr>`
  ).join('');
}

function exportExcel() {
  if (!lastResults.length) return;
  const ws = XLSX.utils.json_to_sheet(lastResults);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Filtrado');
  const name = mainFile?.name?.replace(/\.[^/.]+$/, '') || 'filtrado';
  XLSX.writeFile(wb, `${name}_filtrado.xlsx`);
}

function readFile(file) {
  return new Promise((res, rej) => {
    const reader = new FileReader();
    reader.onload = e => res(new Uint8Array(e.target.result));
    reader.onerror = rej;
    reader.readAsArrayBuffer(file);
  });
}
