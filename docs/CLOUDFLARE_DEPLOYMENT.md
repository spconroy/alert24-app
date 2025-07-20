# Cloudflare Pages Deployment Guide for Alert24

This guide covers deploying Alert24 to Cloudflare Pages with proper configuration for Edge Runtime compatibility and cron job alternatives.

## 🚨 **Important Cloudflare Limitations**

### What Works
- ✅ Edge Runtime API routes
- ✅ Static site generation
- ✅ Environment variables
- ✅ Custom domains
- ✅ Global CDN distribution

### What Doesn't Work
- ❌ **Native cron jobs** (Cloudflare Pages doesn't support scheduled functions)
- ❌ **Node.js runtime** (only Edge Runtime supported)
- ❌ **File system operations** (Edge Runtime limitations)
- ❌ **Long-running processes** (15-minute timeout)

## 📋 **Prerequisites**

- Cloudflare account with Pages access
- GitHub repository with Alert24 codebase
- Supabase project set up
- External services configured (Twilio, SendGrid, Stripe)

## 🚀 **Deployment Steps**

### 1. **Prepare Repository**

Ensure your repository has these configurations:

**`next.config.js`** - Verify Edge Runtime configuration:
```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    runtime: 'experimental-edge',
  },
  // Cloudflare Pages compatibility
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
}

module.exports = nextConfig
```

**`package.json`** - Ensure correct build script:
```json
{
  "scripts": {
    "build": "next build",
    "export": "next export"
  }
}
```

### 2. **Create Cloudflare Pages Project**

1. Log into Cloudflare Dashboard
2. Go to **Pages** section
3. Click **"Create a project"**
4. Connect to your GitHub repository
5. Configure build settings:
   - **Framework preset**: Next.js
   - **Build command**: `npm run build`
   - **Build output directory**: `.next`
   - **Root directory**: `/` (or subdirectory if applicable)

### 3. **Configure Environment Variables**

In Cloudflare Pages dashboard, go to **Settings > Environment Variables**:

#### **Production Environment Variables**
```bash
# Database
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Authentication
NEXTAUTH_SECRET=your-nextauth-secret
NEXTAUTH_URL=https://your-domain.pages.dev
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# External Services
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
TWILIO_ACCOUNT_SID=your-twilio-account-sid
TWILIO_AUTH_TOKEN=your-twilio-auth-token
TWILIO_PHONE_NUMBER=+1234567890

# Billing (if using Stripe)
STRIPE_SECRET_KEY=your-stripe-secret-key
STRIPE_PUBLISHABLE_KEY=your-stripe-publishable-key

# Optional: Webhook authentication
WEBHOOK_SECRET=your-webhook-secret

# Optional: API rate limiting
UPSTASH_REDIS_REST_URL=your-upstash-url
UPSTASH_REDIS_REST_TOKEN=your-upstash-token
```

#### **Preview Environment Variables**
Set the same variables for preview deployments, using development/staging service credentials.

### 4. **Custom Domain Setup**

1. In Pages dashboard, go to **Custom domains**
2. Add your domain (e.g., `alert24.yourdomain.com`)
3. Configure DNS records as instructed by Cloudflare
4. Update `NEXTAUTH_URL` environment variable to match your custom domain

## ⏰ **Cron Job Alternatives**

Since Cloudflare Pages doesn't support native cron jobs, use these alternatives:

### **Option 1: GitHub Actions (Recommended)**

Create `.github/workflows/cron-monitoring.yml`:
```yaml
name: Monitoring Cron Jobs

on:
  schedule:
    # Run monitoring checks every 5 minutes
    - cron: '*/5 * * * *'
    # Run escalation processing every 2 minutes
    - cron: '*/2 * * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  monitoring-checks:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/5 * * * *'
    steps:
      - name: Trigger Monitoring Cron
        run: |
          curl -X GET https://your-domain.pages.dev/api/monitoring/cron

  escalation-processing:
    runs-on: ubuntu-latest
    if: github.event.schedule == '*/2 * * * *'
    steps:
      - name: Trigger Escalation Cron
        run: |
          curl -X GET https://your-domain.pages.dev/api/escalations/cron
```

### **Option 2: External Cron Service**

Use services like [cron-job.org](https://cron-job.org/) or [EasyCron](https://www.easycron.com/):

**Monitoring Checks**: 
- URL: `https://your-domain.pages.dev/api/monitoring/cron`
- Schedule: Every 5 minutes

**Escalation Processing**:
- URL: `https://your-domain.pages.dev/api/escalations/cron`
- Schedule: Every 2 minutes

### **Option 3: Cloudflare Workers (Advanced)**

Create a separate Cloudflare Worker to handle cron jobs:

**`worker.js`**:
```javascript
export default {
  async scheduled(event, env, ctx) {
    // Trigger monitoring checks every 5 minutes
    if (event.cron === '*/5 * * * *') {
      await fetch('https://your-domain.pages.dev/api/monitoring/cron');
    }
    
    // Trigger escalation processing every 2 minutes
    if (event.cron === '*/2 * * * *') {
      await fetch('https://your-domain.pages.dev/api/escalations/cron');
    }
  },
};
```

**`wrangler.toml`**:
```toml
name = "alert24-cron"
main = "worker.js"

[triggers]
crons = ["*/2 * * * *", "*/5 * * * *"]
```

Deploy with: `wrangler publish`

## 🔧 **Build Optimizations**

### **Edge Runtime Compatibility**

Ensure all API routes use Edge Runtime:
```javascript
export const runtime = 'edge';
```

### **Bundle Size Optimization**

Add to `next.config.js`:
```javascript
const nextConfig = {
  experimental: {
    outputFileTracingRoot: path.join(__dirname, '../../'),
  },
  webpack: (config) => {
    config.resolve.fallback = {
      ...config.resolve.fallback,
      fs: false,
      net: false,
      tls: false,
    };
    return config;
  },
}
```

## 🚦 **Health Checks & Monitoring**

### **Deployment Health Check**

Create `/api/health/route.js`:
```javascript
import { NextResponse } from 'next/server';

export const runtime = 'edge';

export const GET = async () => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV,
    deployment: 'cloudflare-pages',
    features: {
      database: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      email: !!process.env.SENDGRID_API_KEY,
      sms: !!process.env.TWILIO_ACCOUNT_SID,
      auth: !!process.env.GOOGLE_CLIENT_ID,
    }
  };

  return NextResponse.json(health);
};
```

### **Monitor Cron Job Status**

Add monitoring to your external cron service to alert if jobs fail.

## 🛠️ **Troubleshooting**

### **Common Issues**

1. **Build Failures**
   - Check Edge Runtime compatibility
   - Verify all dependencies support Edge Runtime
   - Review build logs in Cloudflare dashboard

2. **Environment Variable Issues**
   - Ensure all required variables are set
   - Check variable names match exactly
   - Verify preview vs production environment variables

3. **Authentication Problems**
   - Verify `NEXTAUTH_URL` matches your domain
   - Check Google OAuth redirect URIs
   - Ensure secrets are properly set

4. **Database Connection Issues**
   - Verify Supabase project is accessible
   - Check RLS policies are configured
   - Ensure service role key has proper permissions

5. **Cron Jobs Not Running**
   - Verify external cron service is configured
   - Check cron endpoint URLs are correct
   - Monitor cron job execution logs

### **Debug Endpoints**

Use these endpoints to verify deployment:
- `/api/health` - Overall system health
- `/api/debug/test-escalations` - Escalation system status
- `/api/monitoring/cron` - Manual monitoring trigger
- `/api/escalations/cron` - Manual escalation trigger

## 📊 **Performance Monitoring**

### **Cloudflare Analytics**

Monitor your deployment through:
1. **Cloudflare Analytics** - Traffic and performance metrics
2. **Pages Analytics** - Build and deployment metrics
3. **Worker Analytics** (if using Workers for cron)

### **Application Monitoring**

Consider integrating:
- **Sentry** for error tracking
- **LogFlare** for Cloudflare-specific logging
- **UptimeRobot** for external uptime monitoring

## 🔄 **Continuous Deployment**

### **Automatic Deployments**

Cloudflare Pages automatically deploys when you push to your connected branch:
- **Production**: Pushes to `main` branch
- **Preview**: Pushes to other branches

### **Deploy Hooks**

Use Cloudflare's deploy hooks for external triggering:
1. Go to **Settings > Builds & deployments**
2. Create a **Deploy hook**
3. Use the webhook URL for external CI/CD systems

## 🚀 **Post-Deployment Checklist**

- [ ] Verify health check endpoint responds correctly
- [ ] Test authentication flow with Google OAuth
- [ ] Create test incident and verify notifications work
- [ ] Set up external cron jobs for monitoring and escalations
- [ ] Configure custom domain and SSL certificate
- [ ] Test all major features in production environment
- [ ] Set up monitoring and alerting for the application itself
- [ ] Document any Cloudflare-specific configurations for your team

## 📞 **Support & Resources**

- **Cloudflare Pages Documentation**: https://developers.cloudflare.com/pages/
- **Next.js Edge Runtime**: https://nextjs.org/docs/api-reference/edge-runtime
- **Cloudflare Workers**: https://developers.cloudflare.com/workers/
- **GitHub Actions**: https://docs.github.com/en/actions