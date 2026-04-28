async function getSession() {
  const { data: { session } } = await db.auth.getSession();
  return session;
}

async function getProfile(userId) {
  const { data } = await db
    .from('user_profiles')
    .select('*, organizations(*)')
    .eq('id', userId)
    .single();
  return data;
}

async function requireAuth(redirectTo = '/index.html') {
  const session = await getSession();
  if (!session) { window.location.href = redirectTo; return null; }
  return session;
}

async function requireAdmin(redirectTo = '/app.html') {
  const session = await requireAuth();
  if (!session) return null;
  const profile = await getProfile(session.user.id);
  if (!profile || profile.role !== 'admin') {
    window.location.href = redirectTo;
    return null;
  }
  return { session, profile };
}

async function logout() {
  await db.auth.signOut();
  window.location.href = '/index.html';
}

function showToast(msg, type = 'info') {
  let el = document.getElementById('toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'toast';
    el.className = 'toast';
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.className = `toast toast-${type}`;
  el.classList.add('show');
  setTimeout(() => el.classList.remove('show'), 3200);
}
