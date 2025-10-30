# Stripe & Netlify Identity Setup Guide

## Quick Answer
**Your buttons currently don't work because you need to configure Stripe and Netlify Identity first.**

## Step 1: Stripe Setup (Required for payment buttons to work)

### 1.1 Create a Stripe Account
1. Go to https://stripe.com
2. Sign up for a free account
3. You'll automatically be in "Test Mode" (perfect for testing)

### 1.2 Get Your Stripe Keys
1. Go to: https://dashboard.stripe.com/test/apikeys
2. Copy your **Publishable key** (starts with `pk_test_`)
3. Copy your **Secret key** (starts with `sk_test_`) - Keep this SECRET!

### 1.3 Create a Product & Price
1. Go to: https://dashboard.stripe.com/test/products
2. Click **"+ Add product"**
3. Fill in:
   - Name: "Nutrition Planner Premium"
   - Description: "Premium features for nutrition planning"
   - Pricing: Choose "Recurring" → Monthly → Enter amount (e.g., $9.99)
4. Click **"Save product"**
5. Copy the **Price ID** (starts with `price_`)

### 1.4 Get Webhook Secret
1. Go to: https://dashboard.stripe.com/test/webhooks
2. Click **"+ Add endpoint"**
3. Enter endpoint URL: `https://YOUR-SITE.netlify.app/.netlify/functions/stripe-webhook`
   - Replace `YOUR-SITE` with your actual Netlify site name
4. Select events to listen to:
   - `checkout.session.completed`
   - `customer.subscription.updated`
   - `customer.subscription.deleted`
5. Click **"Add endpoint"**
6. Copy the **Signing secret** (starts with `whsec_`)

## Step 2: Netlify Environment Variables

### 2.1 Add Environment Variables
1. Go to your Netlify site dashboard
2. Navigate to: **Site settings** → **Build & deploy** → **Environment**
3. Click **"Add a variable"** for each of these:

```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID=price_your_price_id_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
SITE_URL=https://your-site.netlify.app
```

### 2.2 Get Netlify Identity Admin Token
1. In Netlify dashboard, go to **Site settings** → **Identity**
2. Scroll down to **"Services and usage"**
3. Click **"Generate access token"** or **"Create access token"**
4. Copy the token (looks like a long string of characters)
5. Add it as an environment variable:
   ```
   IDENTITY_ADMIN_TOKEN=your_token_here
   ```

## Step 3: Enable Netlify Identity

### 3.1 Enable Identity
1. Go to **Site settings** → **Identity**
2. Click **"Enable Identity"**
3. Enable **"Enable Identity"** toggle

### 3.2 Configure Identity Settings
1. Scroll to **"Registration preferences"**
2. Set to **"Open"** (allow anyone to sign up)
3. Or choose **"Invite only"** if you want to control who can sign up

### 3.3 Enable External Providers (Optional)
- You can enable Google/GitHub login in **"External providers"**
- Or keep it simple with just email/password

## Step 4: Deploy

After adding all environment variables:
1. Go to **Deploys** tab
2. Click **"Trigger deploy"** → **"Clear cache and deploy site"**
3. Wait for deploy to complete

## Step 5: Test

### 5.1 Test Login
1. Go to your live site
2. Click **"Login / Sign Up"** button
3. Create an account with your email
4. You should see the login modal appear

### 5.2 Test Payment
1. Click **"Upgrade Now"** button
2. You should be redirected to Stripe checkout
3. Use test card: `4242 4242 4242 4242`
   - Any future expiry date
   - Any 3-digit CVC
   - Any ZIP code
4. Complete checkout
5. You should be redirected back and see premium features

## Troubleshooting

### Buttons don't do anything
- ✅ Check browser console for errors
- ✅ Make sure Netlify Identity is enabled
- ✅ Make sure all environment variables are set
- ✅ Try redeploying your site

### "Failed to start checkout" error
- ✅ Check that `STRIPE_SECRET_KEY` and `STRIPE_PRICE_ID` are set correctly
- ✅ Make sure you created a Price (not just a Product)
- ✅ Check Netlify function logs: **Site settings** → **Functions** → **View logs**

### Login modal doesn't appear
- ✅ Check that Netlify Identity is enabled
- ✅ Try refreshing the page
- ✅ Check browser console for errors

### "Identity fetch failed" error
- ✅ Check that `IDENTITY_ADMIN_TOKEN` is set
- ✅ Try regenerating the Identity access token

## Security Notes

⚠️ **IMPORTANT:**
- Never commit your secret keys to GitHub
- Environment variables starting with `VITE_` are exposed to the browser
- Only `VITE_STRIPE_PUBLISHABLE_KEY` should be public
- All other keys must start with `STRIPE_` (not `VITE_`) to be server-only

## Cost

- **Stripe**: Free for test mode, 2.9% + $0.30 per transaction in live mode
- **Netlify Identity**: Free tier includes up to 1,000 MAU (Monthly Active Users)
- **Netlify Functions**: Free tier includes 125,000 function invocations per month

## Need Help?

If you're stuck:
1. Check the Netlify function logs
2. Check the browser console
3. Make sure all steps above are completed
4. Try deploying again with all environment variables set

