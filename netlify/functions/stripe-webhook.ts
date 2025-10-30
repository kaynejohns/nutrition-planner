import Stripe from "stripe";
import type { Handler } from "@netlify/functions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

/** Mark a Netlify Identity user as premium (true/false) */
async function setUserPremium(userId: string, isPremium: boolean) {
  const adminToken = process.env.IDENTITY_ADMIN_TOKEN!;
  const base = `${process.env.SITE_URL}/.netlify/identity`;

  // 1) fetch user
  const res = await fetch(`${base}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  if (!res.ok) throw new Error(`Identity fetch failed: ${res.status}`);
  const user = await res.json();

  // 2) update roles/app_metadata
  const existing = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
  const roles = Array.from(new Set([...(existing || []), ...(isPremium ? ["premium"] : [])]));
  const body = { app_metadata: { ...(user.app_metadata || {}), isPremium, roles } };

  const upd = await fetch(`${base}/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!upd.ok) throw new Error(`Identity update failed: ${upd.status}`);
}

export const handler: Handler = async (event) => {
  const sig = event.headers["stripe-signature"] as string;
  try {
    const whSec = process.env.STRIPE_WEBHOOK_SECRET!;
    const evt = stripe.webhooks.constructEvent(event.body as string, sig, whSec);

    if (evt.type === "checkout.session.completed") {
      const s = evt.data.object as Stripe.Checkout.Session;
      const userId = (s.metadata?.userId || s.client_reference_id) as string;
      if (userId) await setUserPremium(userId, true);
    }

    if (evt.type === "customer.subscription.updated") {
      const sub = evt.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.userId as string) || "";
      const active = sub.status === "active" || sub.status === "trialing";
      if (userId) await setUserPremium(userId, active);
    }

    if (evt.type === "customer.subscription.deleted") {
      const sub = evt.data.object as Stripe.Subscription;
      const userId = (sub.metadata?.userId as string) || "";
      if (userId) await setUserPremium(userId, false);
    }

    return { statusCode: 200, body: "ok" };
  } catch (err: any) {
    return { statusCode: 400, body: `Webhook error: ${err.message}` };
  }
};

