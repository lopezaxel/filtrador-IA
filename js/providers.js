let orgId = null;
let providers = [];
let baseKw = [];
let activeProvIds = new Set();
let modalEditId = null;

async function initProviders(organizationId) {
  orgId = organizationId;
  await loadFromDB();
  renderAll();
}

async function loadFromDB() {
  const [provRes, baseRes] = await Promise.all([
    db.from('providers').select('*, keywords(*)').eq('org_id', orgId),
    db.from('base_keywords').select('word').eq('org_id', orgId)
  ]);
  providers = (provRes.data || []).map(p => ({
    id: p.id,
    name: p.name,
    extraKw: (p.keywords || []).map(k => k.word)
  }));
  baseKw = (baseRes.data || []).map(r => r.word);
}

function renderAll() {
  renderProvList();
  renderProvSelector();
  renderBaseKw();
  renderProvEditor();
}

function renderProvList() {
  const el = document.getElementById('provList');
  if (!el) return;
  const selCount = activeProvIds.size;
  const headerHtml = selCount > 0
    ? `<div style="padding:8px 12px 4px;font-size:11px;color:var(--muted);text-transform:uppercase;letter-spacing:1px;font-weight:700">${selCount} activo${selCount > 1 ? 's' : ''} <button onclick="clearProvSelection()" style="margin-left:8px;background:none;border:none;color:var(--danger);font-size:11px;font-weight:700;cursor:pointer">Limpiar</button></div>`
    : '';
  el.innerHTML = headerHtml + providers.map(p => {
    const isActive = activeProvIds.has(p.id);
    return `<div class="prov-item ${isActive ? 'active' : ''}" onclick="selectProvider('${p.id}')">
      <div>
        <div class="prov-name">${p.name}</div>
        <div class="prov-kw-count">${p.extraKw.length} palabras clave</div>
      </div>
    </div>`;
  }).join('');
}

function clearProvSelection() {
  activeProvIds.clear();
  renderAll();
  updateRunBtn();
}

function selectProvider(id) {
  if (activeProvIds.has(id)) activeProvIds.delete(id);
  else activeProvIds.add(id);
  renderAll();
  updateRunBtn();
}

function renderProvSelector() {
  const nameEl = document.getElementById('provSelName');
  const bodyEl = document.getElementById('provSelBody');
  if (!nameEl || !bodyEl) return;
  const selectedProvs = providers.filter(p => activeProvIds.has(p.id));
  if (selectedProvs.length === 0) {
    nameEl.textContent = 'Ningún proveedor seleccionado';
    bodyEl.innerHTML = '<span style="color:var(--muted);font-size:13px">Seleccioná un proveedor del panel izquierdo para ver sus palabras clave.</span>';
    return;
  }
  nameEl.textContent = selectedProvs.length === 1 ? selectedProvs[0].name : `${selectedProvs.length} proveedores`;
  const allExtraKw = [...new Set(selectedProvs.flatMap(p => p.extraKw))];
  const total = baseKw.length + allExtraKw.length;
  const tags = baseKw.map(w => `<span class="kw-tag base">${w}</span>`).join('')
    + allExtraKw.map(w => `<span class="kw-tag">${w}</span>`).join('');
  bodyEl.innerHTML = `<div style="font-size:11px;color:var(--muted);margin-bottom:8px;text-transform:uppercase;letter-spacing:1px;font-weight:700">${total} palabras clave activas</div><div class="kw-preview">${tags}</div>`;
}

function updateRunBtn() {
  const btn = document.getElementById('runBtn');
  const fileMain = document.getElementById('fileMain');
  if (!btn) return;
  btn.disabled = activeProvIds.size === 0 || !fileMain?.files?.length;
}

/* ── Providers modal ── */
function openAddProvider() {
  modalEditId = null;
  document.getElementById('modalTitle').textContent = 'NUEVO PROVEEDOR';
  document.getElementById('modalProvName').value = '';
  window._modalKw = [];
  renderModalKw();
  document.getElementById('provModal').classList.add('open');
  setTimeout(() => document.getElementById('modalProvName').focus(), 100);
}

function openEditProvider(id) {
  const prov = providers.find(p => p.id === id);
  if (!prov) return;
  modalEditId = id;
  document.getElementById('modalTitle').textContent = 'EDITAR PROVEEDOR';
  document.getElementById('modalProvName').value = prov.name;
  window._modalKw = [...prov.extraKw];
  renderModalKw();
  document.getElementById('provModal').classList.add('open');
}

function closeModal() {
  document.getElementById('provModal').classList.remove('open');
  document.getElementById('modalKwInp').value = '';
}

async function saveProvider() {
  const name = document.getElementById('modalProvName').value.trim().toUpperCase();
  if (!name) return;
  const kws = window._modalKw || [];

  if (modalEditId) {
    await db.from('providers').update({ name }).eq('id', modalEditId);
    await db.from('keywords').delete().eq('provider_id', modalEditId);
    if (kws.length) await db.from('keywords').insert(kws.map(w => ({ provider_id: modalEditId, word: w })));
  } else {
    const { data } = await db.from('providers').insert({ org_id: orgId, name }).select().single();
    if (data && kws.length) await db.from('keywords').insert(kws.map(w => ({ provider_id: data.id, word: w })));
  }

  closeModal();
  await loadFromDB();
  renderAll();
  showToast(modalEditId ? 'Proveedor actualizado' : 'Proveedor creado', 'success');
}

async function deleteProvider(id) {
  if (!confirm('¿Eliminar este proveedor?')) return;
  await db.from('providers').delete().eq('id', id);
  activeProvIds.delete(id);
  await loadFromDB();
  renderAll();
  updateRunBtn();
  showToast('Proveedor eliminado', 'info');
}

/* ── Provider editor (config tab) ── */
function renderProvEditor() {
  const el = document.getElementById('provEditorGrid');
  if (!el) return;
  el.innerHTML = providers.map(p => `
    <div class="config-block">
      <div class="config-block-header">
        <span class="config-block-title">${p.name}</span>
        <div style="display:flex;gap:6px">
          <button class="btn-ghost" style="font-size:12px;padding:5px 10px" onclick="openEditProvider('${p.id}')">Editar</button>
          <button class="btn-danger" style="font-size:12px;padding:5px 10px" onclick="deleteProvider('${p.id}')">Borrar</button>
        </div>
      </div>
      <div class="config-block-body">
        <div class="kw-grid">${p.extraKw.map(w => `<span class="kw-chip">${w}</span>`).join('') || '<span style="color:var(--muted);font-size:12px">Sin palabras clave</span>'}</div>
      </div>
    </div>`).join('');
}

/* ── Base keywords ── */
function renderBaseKw() {
  const el = document.getElementById('baseKwGrid');
  if (!el) return;
  el.innerHTML = baseKw.map(w => `
    <span class="kw-chip">${w}
      <button onclick="removeBaseKw('${w}')">×</button>
    </span>`).join('');
  const countEl = document.getElementById('baseCount');
  if (countEl) countEl.textContent = `(${baseKw.length})`;
}

async function addBaseKw(val) {
  const inp = document.getElementById('baseKwInp');
  const word = (val || inp.value).trim().toUpperCase();
  if (!word || baseKw.includes(word)) { if (inp) inp.value = ''; return; }
  await db.from('base_keywords').insert({ org_id: orgId, word });
  baseKw.push(word);
  if (inp) inp.value = '';
  renderBaseKw();
  renderProvSelector();
}

async function removeBaseKw(kw) {
  await db.from('base_keywords').delete().eq('org_id', orgId).eq('word', kw);
  baseKw = baseKw.filter(w => w !== kw);
  renderBaseKw();
  renderProvSelector();
}

/* ── Modal keywords ── */
function renderModalKw() {
  const el = document.getElementById('modalKwGrid');
  if (!el) return;
  el.innerHTML = (window._modalKw || []).map(w => `
    <span class="kw-chip">${w}
      <button onclick="removeModalKw('${w}')">×</button>
    </span>`).join('');
}

function addModalKw(val) {
  const inp = document.getElementById('modalKwInp');
  const word = (val || inp.value).trim().toUpperCase();
  if (!word || (window._modalKw || []).includes(word)) { if (inp) inp.value = ''; return; }
  window._modalKw = window._modalKw || [];
  window._modalKw.push(word);
  if (inp) inp.value = '';
  renderModalKw();
}

function removeModalKw(kw) {
  window._modalKw = (window._modalKw || []).filter(w => w !== kw);
  renderModalKw();
}
