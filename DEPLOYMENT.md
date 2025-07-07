# Alert24 Deployment Guide

## Overview

Alert24 is a Next.js application that requires:

- Node.js runtime (not Edge Runtime)
- PostgreSQL database
- NextAuth.js for authentication
- Environment variables for configuration

## Why Not Cloudflare Pages?

Cloudflare Pages with `@cloudflare/next-on-pages` requires all API routes to use Edge Runtime, but our app uses:

- NextAuth.js (limited Edge Runtime support)
- PostgreSQL with `pg` library (requires Node.js built-ins)
- Complex database operations

## Recommended Deployment Platforms

### 1. Vercel (Recommended) ⭐

**Pros:**

- Best Next.js support
- Automatic deployments
- Built-in PostgreSQL support
- Easy environment variable management

**Steps:**

1. Install Vercel CLI: `npm install -g vercel`
2. Login: `vercel login`
3. Deploy: `vercel --prod`
4. Set environment variables in Vercel dashboard

**Environment Variables:**

```
DATABASE_URL=postgresql://...
NEXTAUTH_URL=https://your-app.vercel.app
NEXTAUTH_SECRET=your-secret-key
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### 2. Railway 🚂

**Pros:**

- Excellent PostgreSQL support
- One-click database provisioning
- Good Next.js support
- Simple pricing

**Steps:**

1. Install Railway CLI: `npm install -g @railway/cli`
2. Login: `railway login`
3. Initialize: `railway init`
4. Add PostgreSQL: `railway add postgresql`
5. Deploy: `railway up`

### 3. Netlify 🌐

**Pros:**

- Good Next.js support
- Easy setup
- Built-in forms and functions

**Steps:**

1. Install Netlify CLI: `npm install -g netlify-cli`
2. Login: `netlify login`
3. Build: `npm run build`
4. Deploy: `netlify deploy --prod --dir=.next`

### 4. Self-Hosted 🏠

**Requirements:**

- Node.js 18+
- PostgreSQL database
- Reverse proxy (nginx/Apache)

**Steps:**

1. Clone repository on server
2. Install dependencies: `npm install`
3. Set up environment variables
4. Build: `npm run build`
5. Start: `npm start`

## Database Setup

### PostgreSQL Schema

Run the SQL files in order:

```bash
# Connect to your PostgreSQL database
psql $DATABASE_URL

# Run schema files
\i docs/database_schema.sql
\i docs/schema-updates/01_incident_management_schema.sql
\i docs/schema-updates/02_monitoring_system_schema.sql
# ... continue with all numbered schema files
```

### Environment Variables

Create `.env.local` (or set in your deployment platform):

```env
# Database
DATABASE_URL="postgresql://username:password@host:port/database"

# NextAuth.js
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-very-secure-secret-key-here"

# Google OAuth
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"

# Optional: Email (SendGrid)
SENDGRID_API_KEY="your-sendgrid-api-key"
SENDGRID_FROM_EMAIL="noreply@yourdomain.com"
```

## Google OAuth Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URIs:
   - `https://your-domain.com/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for development)

## Security Checklist

- [ ] Use strong NEXTAUTH_SECRET (32+ characters)
- [ ] Set up proper CORS policies
- [ ] Use HTTPS in production
- [ ] Regularly update dependencies
- [ ] Monitor for security vulnerabilities
- [ ] Set up proper database backups
- [ ] Use environment variables for all secrets

## Monitoring & Maintenance

- Set up uptime monitoring
- Configure error tracking (Sentry recommended)
- Set up database backups
- Monitor resource usage
- Keep dependencies updated

## Troubleshooting

### Build Issues

- Ensure Node.js 18+ is used
- Check all environment variables are set
- Verify database connection

### Runtime Issues

- Check server logs
- Verify environment variables in production
- Test database connectivity
- Check NextAuth.js configuration

### Performance

- Enable database connection pooling
- Use CDN for static assets
- Monitor API response times
- Optimize database queries

## Quick Start Script

Run `./deploy.sh` for automated deployment preparation.
