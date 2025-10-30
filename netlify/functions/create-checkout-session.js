// netlify/functions/create-checkout-session.js
const Stripe = require('stripe');

exports.handler = async (event) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  try {
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
    const { userId, email, priceId } = JSON.parse(event.body);

    if (!userId || !email) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing userId or email' }) 
      };
    }

    // Use priceId from request or fall back to environment variable
    const stripePriceId = priceId || process.env.STRIPE_PRICE_ID;

    if (!stripePriceId) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: 'Missing priceId' }) 
      };
    }

    // Create Stripe Checkout Session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      customer_email: email,
      metadata: {
        userId, // Store Netlify Identity user ID
      },
      line_items: [
        {
          price: stripePriceId,
          quantity: 1,
        },
      ],
      mode: 'subscription',
      success_url: `${process.env.SITE_URL}/?success=true`,
      cancel_url: `${process.env.SITE_URL}/?canceled=true`,
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ sessionUrl: session.url }),
    };
  } catch (error) {
    console.error('Error creating checkout session:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: error.message }),
    };
  }
};

