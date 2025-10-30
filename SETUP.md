# Setup Checklist

This checklist covers setting up Stripe payments and Netlify configuration for Fuel Factor Premium.

## 1. Stripe Setup

### Create Product
- [ ] Create Product in Stripe Dashboard: `Fuel Factor Premium`
  - Go to Stripe Dashboard → Products
  - Click "Add product"
  - Name: `Fuel Factor Premium`
  - Description: "Premium nutrition planning features"

### Create Recurring Price
- [ ] Create recurring price for monthly subscription
  - Add pricing to the product
  - Choose "Recurring" billing
  - Set amount (e.g., $9.99/month)
  - Save the price ID (e.g., `price_xxx`)

### Get API Keys
- [ ] Get STRIPE_SECRET_KEY from Stripe Dashboard
  - Go to Stripe Dashboard → Developers → API keys
  - Copy "Publishable key" and "Secret key"
  - Secret key starts with `sk_test_` (test) or `sk_live_` (production)

### Setup Webhook
- [ ] Add webhook endpoint in Stripe Dashboard
  - Go to Stripe Dashboard → Developers → Webhooks
  - Click "Add endpoint"
  - Endpoint URL: (paste later from Netlify)
  - Select events to listen to:
    - `checkout.session.completed`
    - `customer.subscription.updated`
    - `customer.subscription.deleted`
  - Click "Add endpoint"
  - Copy the "Signing secret" (starts with `whsec_`)

## 2. Netlify Setup

### Enable Netlify Identity
- [ ] Enable Netlify Identity
  - Go to Netlify Dashboard → Identity
  - Click "Enable Identity"
  - Settings → Registration → "Allow public signups" (turn OFF invite-only if you want email signups)

### Environment Variables
- [ ] Add STRIPE_SECRET_KEY
  - Go to Netlify Dashboard → Site Settings → Environment variables
  - Add: `STRIPE_SECRET_KEY` = your Stripe secret key (sk_test_xxx or sk_live_xxx)
  
- [ ] Add STRIPE_WEBHOOK_SECRET
  - Add: `STRIPE_WEBHOOK_SECRET` = your webhook signing secret (whsec_xxx)
  - (Fill this after creating the Stripe webhook)

- [ ] Add SITE_URL
  - Add: `SITE_URL` = https://fuelfactor.com.au
  - (Or your Netlify site URL: https://<your-site>.netlify.app)

- [ ] Add IDENTITY_ADMIN_TOKEN
  - Go to Netlify Dashboard → Identity → Settings → API
  - Click "Generate Admin Token"
  - Copy the token
  - Add: `IDENTITY_ADMIN_TOKEN` = the generated token

### Enable Netlify Functions & Blobs
- [ ] Enable Netlify Functions
  - Already enabled if functions are working
  - Verify in Netlify Dashboard → Functions

- [ ] Enable Netlify Blobs (if needed for data storage)
  - Go to Netlify Dashboard → Blobs
  - Enable if you plan to store data server-side

### Link Stripe Webhook to Netlify
- [ ] Get Netlify Function URL
  - Deploy the webhook function
  - Go to Netlify Dashboard → Functions
  - Find the webhook function URL
  - Copy the URL

- [ ] Update Stripe Webhook endpoint
  - Go back to Stripe Dashboard → Developers → Webhooks
  - Click on your webhook endpoint
  - Update the endpoint URL with your Netlify function URL
  - Save changes

## 3. Testing

- [ ] Test Stripe Checkout in test mode
  - Use Stripe test cards (4242 4242 4242 4242)
  - Complete a test purchase
  - Verify webhook events are received

- [ ] Test Netlify Identity signup
  - Sign up with a test email
  - Verify confirmation email is sent

- [ ] Test premium feature access
  - Verify premium features are locked for free users
  - Verify premium users can access all features

## Notes

- Keep Stripe test mode active until you're ready for production
- Test thoroughly before switching to live mode
- Keep your API keys and secrets secure - never commit them to git
- The webhook secret ensures requests are actually coming from Stripe

