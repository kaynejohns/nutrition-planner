// netlify/functions/stripe-webhook.ts
import Stripe from "stripe";
import type { Handler } from "@netlify/functions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
  apiVersion: "2024-06-20",
});

// helper to set Netlify Identity role
async function setUserPremium(userId: string, isPremium: boolean) {
  const adminToken = process.env.IDENTITY_ADMIN_TOKEN!;
  const base = `${process.env.SITE_URL}/.netlify/identity`;

  // 1. get user
  const res = await fetch(`${base}/admin/users/${userId}`, {
    headers: { Authorization: `Bearer ${adminToken}` },
  });
  const user = await res.json();

  // 2. update their roles
  const roles = Array.from(
    new Set([...(user.app_metadata?.roles || []), ...(isPremium ? ["premium"] : [])])
  );
  const body = {
    app_metadata: { ...(user.app_metadata || {}), isPremium, roles },
  };

  await fetch(`${base}/admin/users/${userId}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${adminToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

export const handler: Handler = async (event) => {
  const sig = event.headers["stripe-signature"];
  const secret = process.env.STRIPE_WEBHOOK_SECRET!;
  let evt: Stripe.Event;

  try {
    evt = stripe.webhooks.constructEvent(event.body as string, sig!, secret);
  } catch (err: any) {
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  // Handle key Stripe events
  if (evt.type === "checkout.session.completed") {
    const session = evt.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId || session.client_reference_id;
    if (userId) await setUserPremium(userId, true);
  }

  if (evt.type === "customer.subscription.deleted") {
    const sub = evt.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    if (userId) await setUserPremium(userId, false);
  }

  if (evt.type === "customer.subscription.updated") {
    const sub = evt.data.object as Stripe.Subscription;
    const userId = sub.metadata?.userId;
    const active = sub.status === "active" || sub.status === "trialing";
    if (userId) await setUserPremium(userId, active);
  }

  return { statusCode: 200, body: "ok" };
};

