// netlify/functions/create-checkout-session.ts
import Stripe from 'stripe';
import type { Handler } from '@netlify/functions';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string, { apiVersion: '2024-06-20' });

export const handler: Handler = async (event) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  const { priceId, userId, email } = JSON.parse(event.body || '{}');

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer_email: email,
    line_items: [{ price: priceId, quantity: 1 }],
    success_url: `${process.env.SITE_URL}/premium/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${process.env.SITE_URL}/premium/cancel`,
    client_reference_id: userId,
    metadata: { userId },
  });

  return { statusCode: 200, body: JSON.stringify({ sessionUrl: session.url }) };
};

