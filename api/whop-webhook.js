import { createClient } from '@supabase/supabase-js';
import crypto from 'crypto';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const sig = req.headers['whop-signature'];
  const raw = JSON.stringify(req.body);
  const expected = crypto
    .createHmac('sha256', process.env.WHOP_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');

  if (sig !== expected) return res.status(401).json({ error: 'Invalid signature' });

  const { event, data } = req.body;
  const membershipId = data?.id;
  const userEmail    = data?.user?.email;

  if (!membershipId) return res.status(400).json({ error: 'Missing membership id' });

  if (event === 'membership.activated' || event === 'membership.went_valid') {
    await supabase
      .from('organizations')
      .update({ plan: 'active', whop_membership_id: membershipId })
      .eq('whop_membership_id', membershipId);

    if (userEmail) {
      const { data: org } = await supabase
        .from('organizations')
        .select('id')
        .eq('whop_membership_id', membershipId)
        .single();
      if (org) {
        await supabase
          .from('user_profiles')
          .update({ status: 'active' })
          .eq('org_id', org.id);
      }
    }
  }

  if (event === 'membership.deactivated' || event === 'membership.went_invalid') {
    const { data: org } = await supabase
      .from('organizations')
      .select('id')
      .eq('whop_membership_id', membershipId)
      .single();

    if (org) {
      await supabase.from('organizations').update({ plan: 'inactive' }).eq('id', org.id);
      await supabase.from('user_profiles').update({ status: 'inactive' }).eq('org_id', org.id);
    }
  }

  return res.status(200).json({ ok: true });
}
