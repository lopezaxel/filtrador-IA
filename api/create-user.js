import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { email, password, org_id } = req.body;
  if (!email || !password || !org_id) {
    return res.status(400).json({ error: 'Faltan campos requeridos' });
  }

  const { data: user, error } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true
  });

  if (error) return res.status(400).json({ error: error.message });

  await supabase.from('user_profiles').insert({
    id: user.user.id,
    org_id,
    role: 'client',
    status: 'active'
  });

  return res.status(200).json({ ok: true, user_id: user.user.id });
}
