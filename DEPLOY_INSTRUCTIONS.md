# Deployment Instructions

## 🚀 Deploy to Netlify

Your site is already connected to GitHub and will auto-deploy when you push changes.

### Check Current Deployment Status

1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. Check the **"Deploys"** tab to see if it's deploying

### Manual Deployment (if auto-deploy isn't working)

If you need to manually trigger a deployment:

#### Option 1: Via Netlify Dashboard
1. Go to [Netlify Dashboard](https://app.netlify.com)
2. Select your site
3. Go to the **"Deploys"** tab
4. Click **"Trigger deploy"** → **"Clear cache and deploy site"**

#### Option 2: Via Netlify CLI (if installed)
```bash
npm install -g netlify-cli
netlify login
netlify deploy --prod
```

### ⚠️ BEFORE DEPLOYING - Complete These Steps:

#### 1. Add Environment Variables

Go to your Netlify site dashboard → **Site settings** → **Build & deploy** → **Environment**

Add these variables:

```
STRIPE_SECRET_KEY=sk_test_your_secret_key_here
STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret_here
STRIPE_PRICE_ID=price_your_price_id_here
VITE_STRIPE_PUBLISHABLE_KEY=pk_test_your_publishable_key_here
SITE_URL=https://your-site.netlify.app
```

**⚠️ IMPORTANT:**
- Replace `your-site` with your actual Netlify site name
- Get these values from your Stripe Dashboard (see `STRIPE_SETUP_GUIDE.md`)

#### 2. Enable Netlify Identity

1. Go to **Site settings** → **Identity**
2. Click **"Enable Identity"**
3. Set **Registration preferences** to **"Open"**
4. Save changes

#### 3. Verify Build Settings

Your `netlify.toml` is already configured correctly:
- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

### After Deployment

1. **Test the login button** - Should open the login modal
2. **Create a test account** - Sign up with your email
3. **Test the upgrade button** - Should redirect to Stripe checkout
4. **Complete a test payment** - Use Stripe test card: `4242 4242 4242 4242`

### Troubleshooting

#### Site doesn't build
- Check the **Deploys** tab for error logs
- Make sure all environment variables are set

#### Buttons don't work
- Check that Netlify Identity is enabled
- Verify environment variables are set correctly
- Check browser console for errors

#### Functions not working
- Check **Site settings** → **Functions** tab
- Look for error logs
- Verify environment variables are set

### Your Site URL

Your site will be live at:
```
https://your-site.netlify.app
```

(Replace `your-site` with your actual Netlify site name)

