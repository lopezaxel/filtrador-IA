let allOrgs = [];
let allUsers = [];

async function loadAdminData() {
  const [orgsRes, usersRes] = await Promise.all([
    db.from('organizations').select('*').order('created_at', { ascending: false }),
    db.from('user_profiles').select('*, organizations(name)').order('created_at', { ascending: false })
  ]);
  allOrgs = orgsRes.data || [];
  allUsers = usersRes.data || [];
  renderStats();
  renderUsersTable();
}

function renderStats() {
  const active   = allOrgs.filter(o => o.plan === 'active').length;
  const trial    = allOrgs.filter(o => o.plan === 'trial').length;
  const inactive = allOrgs.filter(o => o.plan === 'inactive').length;
  document.getElementById('statActive').textContent   = active;
  document.getElementById('statTrial').textContent    = trial;
  document.getElementById('statInactive').textContent = inactive;
  document.getElementById('statTotal').textContent    = allOrgs.length;
}

function renderUsersTable(filter = '') {
  const tbody = document.getElementById('usersBody');
  const f = filter.toLowerCase();
  const rows = allUsers.filter(u =>
    !f ||
    u.id?.toLowerCase().includes(f) ||
    u.organizations?.name?.toLowerCase().includes(f) ||
    u.role?.toLowerCase().includes(f)
  );

  if (rows.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center;color:var(--muted);padding:24px">Sin usuarios</td></tr>`;
    return;
  }

  tbody.innerHTML = rows.map(u => {
    const org = allOrgs.find(o => o.id === u.org_id);
    const plan = org?.plan || '—';
    const trialExp = org?.trial_expires_at ? new Date(org.trial_expires_at).toLocaleDateString('es-AR') : '—';
    const badgeClass = plan === 'active' ? 'badge-active' : plan === 'trial' ? 'badge-trial' : 'badge-inactive';
    return `<tr>
      <td style="font-family:var(--font-mono);font-size:11px;color:var(--muted)">${u.id?.slice(0,8)}…</td>
      <td><strong>${org?.name || '—'}</strong></td>
      <td><span class="badge ${u.role === 'admin' ? 'badge-active' : 'badge-trial'}">${u.role}</span></td>
      <td><span class="badge ${badgeClass}">${plan}</span></td>
      <td style="color:var(--muted);font-size:12px">${trialExp}</td>
      <td>
        <div class="action-btns">
          ${u.status === 'active'
            ? `<button class="btn-ghost" style="font-size:12px;padding:4px 10px" onclick="toggleUserStatus('${u.id}', 'inactive')">Desactivar</button>`
            : `<button class="btn-primary" style="font-size:12px;padding:4px 10px" onclick="toggleUserStatus('${u.id}', 'active')">Activar</button>`}
          <button class="btn-danger" style="font-size:12px;padding:4px 10px" onclick="deleteUser('${u.id}')">Borrar</button>
        </div>
      </td>
    </tr>`;
  }).join('');
}

async function toggleUserStatus(userId, newStatus) {
  await db.from('user_profiles').update({ status: newStatus }).eq('id', userId);
  await loadAdminData();
  showToast(`Usuario ${newStatus === 'active' ? 'activado' : 'desactivado'}`, newStatus === 'active' ? 'success' : 'info');
}

async function deleteUser(userId) {
  if (!confirm('¿Eliminar este usuario? Esta acción no se puede deshacer.')) return;
  await db.from('user_profiles').delete().eq('id', userId);
  await loadAdminData();
  showToast('Usuario eliminado', 'info');
}

/* ── Create user modal ── */
function openCreateUser() {
  document.getElementById('createUserModal').classList.add('open');
  document.getElementById('newUserEmail').value = '';
  document.getElementById('newUserPassword').value = '';
  document.getElementById('newOrgName').value = '';
  document.getElementById('newUserPlan').value = 'trial';
  document.getElementById('trialRow').style.display = 'flex';
}

function closeCreateUser() {
  document.getElementById('createUserModal').classList.remove('open');
}

document.addEventListener('DOMContentLoaded', () => {
  const planSel = document.getElementById('newUserPlan');
  if (planSel) {
    planSel.addEventListener('change', () => {
      document.getElementById('trialRow').style.display =
        planSel.value === 'trial' ? 'flex' : 'none';
    });
  }
});

async function createUser() {
  const email    = document.getElementById('newUserEmail').value.trim();
  const password = document.getElementById('newUserPassword').value;
  const orgName  = document.getElementById('newOrgName').value.trim().toUpperCase();
  const plan     = document.getElementById('newUserPlan').value;
  const trialDays= parseInt(document.getElementById('trialDays').value) || 3;

  if (!email || !password || !orgName) {
    showToast('Completá todos los campos', 'error'); return;
  }

  const btn = document.getElementById('createUserBtn');
  btn.disabled = true;

  try {
    const trialExpiresAt = plan === 'trial'
      ? new Date(Date.now() + trialDays * 864e5).toISOString()
      : null;

    const { data: orgData, error: orgErr } = await db.from('organizations')
      .insert({ name: orgName, plan, trial_expires_at: trialExpiresAt })
      .select().single();

    if (orgErr) throw orgErr;

    const res = await fetch('/api/create-user', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, org_id: orgData.id })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.error);

    closeCreateUser();
    await loadAdminData();
    showToast(`Usuario ${email} creado`, 'success');
  } catch (err) {
    showToast(err.message || 'Error al crear usuario', 'error');
  } finally {
    btn.disabled = false;
  }
}
