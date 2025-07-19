# Environment Variables for Alert24 App

This document outlines the environment variables required for the Alert24 application to work properly with Google OAuth authentication and Cloudflare Pages deployment.

## Required Environment Variables

### NextAuth.js Configuration

```
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://your-domain.pages.dev
```

### Google OAuth Configuration (Required)

```
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Supabase Configuration

```
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

### SendGrid Configuration (for email notifications)

```
SENDGRID_API_KEY=your-sendgrid-api-key
SENDGRID_FROM_EMAIL=noreply@yourdomain.com
```

### Optional: Monitoring Configuration

```
MONITORING_SECRET=your-monitoring-webhook-secret
```

## Setting Up Google OAuth

1. Go to the [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the Google+ API
4. Go to the Credentials page
5. Create an OAuth 2.0 Client ID
6. Add your domain to the authorized domains
7. Add the following redirect URIs:
   - `https://your-domain.pages.dev/api/auth/callback/google`
   - `http://localhost:3000/api/auth/callback/google` (for development)

## Cloudflare Pages Configuration

In your Cloudflare Pages dashboard:

1. Go to Settings → Environment Variables
2. Add all the environment variables listed above
3. Make sure to set them for both Production and Preview environments

## Security Notes

- Never commit your actual environment variables to version control
- Use different values for development, staging, and production
- Rotate your secrets regularly
- The `NEXTAUTH_SECRET` should be a random string (you can generate one with `openssl rand -base64 32`)

## Migration from Credentials Auth

This application has been migrated from credentials-based authentication to Google OAuth for Edge Runtime compatibility. Users who previously had accounts will need to sign in with Google OAuth. The application will automatically create user records for new Google OAuth users.
