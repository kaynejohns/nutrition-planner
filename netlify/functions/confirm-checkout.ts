// netlify/functions/confirm-checkout.ts
import Stripe from 'stripe';
import type { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });

async function setUserPremium(userId: string, isPremium: boolean) {
  const adminToken = process.env.IDENTITY_ADMIN_TOKEN!;
  const base = `${process.env.SITE_URL}/.netlify/identity`;

  const getRes = await fetch(`${base}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!getRes.ok) return { ok: false, reason: `Identity fetch ${getRes.status}` };
  const user = await getRes.json();

  const roles = Array.from(new Set([...(user.app_metadata?.roles || []), ...(isPremium ? ['premium'] : [])]));
  const body = { app_metadata: { ...(user.app_metadata || {}), isPremium, roles } };

  const upd = await fetch(`${base}/admin/users/${userId}`, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: upd.ok, reason: upd.ok ? 'ok' : `Identity update ${upd.status}` };
}

export const handler: Handler = async (event) => {
  try {
    const { session_id } = JSON.parse(event.body || '{}');
    if (!session_id) return { statusCode: 400, body: 'Missing session_id' };

    const session = await stripe.checkout.sessions.retrieve(session_id, { expand: ['subscription'] });

    // Guard rails
    if (session.payment_status !== 'paid' && session.status !== 'complete') {
      return { statusCode: 400, body: 'Session not paid/complete' };
    }

    const userId = (session.metadata?.userId || session.client_reference_id) as string;
    if (!userId) return { statusCode: 400, body: 'No userId on session' };

    const res = await setUserPremium(userId, true);
    if (!res.ok) return { statusCode: 500, body: res.reason };

    // optional: return plan info
    return { statusCode: 200, body: JSON.stringify({ ok: true, userId }) };
  } catch (e: any) {
    return { statusCode: 500, body: e.message };
  }
};

