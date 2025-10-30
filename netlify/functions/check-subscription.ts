import Stripe from "stripe";
import type { Handler } from "@netlify/functions";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

async function setUserPremium(userId: string, isPremium: boolean) {
  const adminToken = process.env.IDENTITY_ADMIN_TOKEN!;
  const base = `${process.env.SITE_URL}/.netlify/identity`;
  const res = await fetch(`${base}/admin/users/${userId}`, { headers: { Authorization: `Bearer ${adminToken}` }});
  const user = await res.json();
  const existing = Array.isArray(user?.app_metadata?.roles) ? user.app_metadata.roles : [];
  const roles = Array.from(new Set([...(existing || []), ...(isPremium ? ["premium"] : [])]));
  await fetch(`${base}/admin/users/${userId}`, {
    method: "PUT",
    headers: { Authorization: `Bearer ${adminToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ app_metadata: { ...(user.app_metadata || {}), isPremium, roles } }),
  });
}

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
    const { email, userId } = JSON.parse(event.body || "{}");
    if (!email || !userId) return { statusCode: 400, body: "Missing email or userId" };

    // Find Stripe customer by email
    const customers = await stripe.customers.list({ email, limit: 1 });
    const customer = customers.data[0];
    let active = false;

    if (customer) {
      const subs = await stripe.subscriptions.list({ customer: customer.id, status: "all", limit: 1 });
      const sub = subs.data.find(s => ["active", "trialing", "past_due", "unpaid"].includes(s.status));
      active = !!sub && (sub.status === "active" || sub.status === "trialing");
    }

    await setUserPremium(userId, active);
    return { statusCode: 200, body: JSON.stringify({ active }) };
  } catch (e: any) {
    return { statusCode: 400, body: e.message };
  }
};

