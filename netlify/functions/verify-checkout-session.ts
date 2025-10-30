import Stripe from "stripe";
import type { Handler } from "@netlify/functions";
import { blobs } from "@netlify/blobs";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: "2024-06-20" });

export const handler: Handler = async (event) => {
  try {
    if (event.httpMethod !== "POST") return { statusCode: 405, body: "Method not allowed" };
    const { sessionId } = JSON.parse(event.body || "{}");
    if (!sessionId) return { statusCode: 400, body: "Missing sessionId" };

    // Get checkout + subscription state
    const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["subscription"] });
    const userId = (session.metadata?.userId || session.client_reference_id) as string | undefined;
    if (!userId) return { statusCode: 400, body: "Missing userId in session" };

    let isPremium = false;
    if (session.mode === "subscription" && session.subscription) {
      const sub = session.subscription as Stripe.Subscription;
      isPremium = sub.status === "active" || sub.status === "trialing";
    } else if (session.mode === "payment") {
      isPremium = session.payment_status === "paid";
    }

    // Save entitlement server-side (no Identity admin API needed)
    const store = blobs();
    await store.setJSON(`entitlements/${userId}.json`, {
      isPremium,
      updatedAt: new Date().toISOString(),
      source: "checkout-success",
    });

    return { statusCode: 200, body: JSON.stringify({ ok: true, isPremium }) };
  } catch (e: any) {
    return { statusCode: 400, body: e.message };
  }
};

