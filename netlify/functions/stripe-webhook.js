// netlify/functions/stripe-webhook.js
const Stripe = require('stripe');
const { getStore } = require('@netlify/blobs');

const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

exports.handler = async (event) => {
  const sig = event.headers['stripe-signature'];
  let stripeEvent;

  try {
    // Verify webhook signature
    stripeEvent = stripe.webhooks.constructEvent(
      event.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    return { statusCode: 400, body: `Webhook Error: ${err.message}` };
  }

  try {
    // Handle the event
    switch (stripeEvent.type) {
      case 'checkout.session.completed':
        const session = stripeEvent.data.object;
        await handleCheckoutCompleted(session);
        break;

      case 'customer.subscription.updated':
      case 'customer.subscription.deleted':
        const subscription = stripeEvent.data.object;
        await handleSubscriptionChanged(subscription);
        break;

      default:
        console.log(`Unhandled event type: ${stripeEvent.type}`);
    }

    return { statusCode: 200, body: JSON.stringify({ received: true }) };
  } catch (error) {
    console.error('Error processing webhook:', error);
    return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
  }
};

async function handleCheckoutCompleted(session) {
  const userId = session.metadata?.userId;
  const customerEmail = session.customer_email;

  if (!userId) {
    console.error('No userId in session metadata');
    return;
  }

  // Store premium status in Netlify Blobs
  const store = getStore('user-data');
  await store.setJSON(`premium-${userId}`, {
    userId,
    email: customerEmail,
    isPremium: true,
    premiumSince: new Date().toISOString(),
    stripeCustomerId: session.customer,
    stripeSubscriptionId: session.subscription,
  });

  console.log(`Premium activated for user: ${userId}`);
}

async function handleSubscriptionChanged(subscription) {
  const customerId = subscription.customer;

  if (!customerId) {
    console.error('No customer ID in subscription');
    return;
  }

  // Retrieve customer to get metadata
  const customer = await stripe.customers.retrieve(customerId);
  const userId = customer.metadata?.userId;

  if (!userId) {
    console.error('No userId in customer metadata');
    return;
  }

  const store = getStore('user-data');
  const isActive = subscription.status === 'active';

  if (isActive) {
    await store.setJSON(`premium-${userId}`, {
      userId,
      email: customer.email,
      isPremium: true,
      premiumSince: new Date().toISOString(),
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
    });
  } else {
    // Subscription canceled or expired
    await store.setJSON(`premium-${userId}`, {
      userId,
      email: customer.email,
      isPremium: false,
      premiumUntil: new Date().toISOString(),
    });
  }

  console.log(`Premium status updated for user: ${userId} - Active: ${isActive}`);
}

