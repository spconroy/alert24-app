# Cloudflare Google OAuth Authentication Fix Guide

## 🚀 **Quick Fix Applied**

I've just deployed a comprehensive fix for Google OAuth authentication on Cloudflare Pages. Here's what was changed and what you need to do:

## ✅ **What Was Fixed**

### 1. **Edge Runtime Compatibility**

- Removed database operations from NextAuth callbacks that were causing Edge Runtime issues
- Simplified auth configuration for better Cloudflare compatibility
- Moved user creation to a separate post-signin endpoint

### 2. **Enhanced Debugging**

- Added `/api/auth/debug` endpoint for session debugging
- Added `/api/auth/test-google` endpoint for Google OAuth verification
- Added comprehensive logging throughout the authentication process
- Enhanced debug page at `/debug` with authentication testing tools

### 3. **Better Error Handling**

- Improved error messages and logging
- Separate user creation flow that doesn't block authentication

## 🔧 **Required Configuration Steps**

### Step 1: Configure Environment Variables in Cloudflare Pages

Go to your Cloudflare Pages dashboard → Settings → Environment Variables and add:

```bash
# NextAuth Configuration
NEXTAUTH_SECRET=your-nextauth-secret-here
NEXTAUTH_URL=https://your-domain.pages.dev

# Google OAuth (REQUIRED)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret

# Supabase (for user data)
NEXT_PUBLIC_SUPABASE_URL=your-supabase-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-supabase-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-supabase-service-role-key
```

**Important:** Set these variables for both **Production** and **Preview** environments.

### Step 2: Configure Google OAuth Redirect URIs

In your [Google Cloud Console](https://console.cloud.google.com/):

1. Navigate to APIs & Services → Credentials
2. Edit your OAuth 2.0 Client ID
3. Add these Authorized redirect URIs:
   ```
   https://your-domain.pages.dev/api/auth/callback/google
   https://your-preview-branch--your-project.pages.dev/api/auth/callback/google
   ```

### Step 3: Generate NEXTAUTH_SECRET

Run this command to generate a secure secret:

```bash
openssl rand -base64 32
```

## 🐛 **Testing & Debugging**

### 1. **Use the Debug Page**

Visit `/debug` on your deployed app to run authentication tests:

- **Auth Debug**: Tests session and environment variables
- **Google OAuth Test**: Verifies Google configuration
- **Post-Signin Test**: Tests user creation flow

### 2. **Check Browser Console**

The authentication process now includes detailed logging. Check your browser's console for:

- `🔐 NextAuth SignIn callback triggered`
- `🔄 Session callback triggered`
- `✅ User data confirmed`

### 3. **Check Cloudflare Functions Logs**

In Cloudflare Pages → Functions, look for:

- Authentication callback logs
- Environment variable verification
- Database connection status

## 🔍 **Troubleshooting Common Issues**

### Issue 1: "Failed to create subscription"

This is likely due to the subscriptions table schema. Run this SQL in your Supabase SQL Editor:

```sql
-- Check if subscriptions table has required columns
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'subscriptions'
AND table_schema = 'public'
ORDER BY ordinal_position;
```

### Issue 2: Authentication redirects to wrong URL

- Verify `NEXTAUTH_URL` exactly matches your deployed domain
- Check Google OAuth redirect URIs are correctly configured
- Ensure no trailing slashes in URLs

### Issue 3: Environment variables not loading

- Double-check variables are set in Cloudflare Pages (not GitHub secrets)
- Verify variables are set for both Production and Preview
- Redeploy after adding variables

### Issue 4: Database connection errors

- Verify Supabase environment variables are correct
- Check Supabase project is active and accessible
- Test database connection using `/api/auth/debug`

## 🚀 **Deployment Checklist**

- [ ] Environment variables set in Cloudflare Pages
- [ ] Google OAuth redirect URIs configured
- [ ] NEXTAUTH_SECRET generated and set
- [ ] NEXTAUTH_URL matches deployed domain
- [ ] Latest code deployed from main branch
- [ ] Test authentication on deployed site
- [ ] Check `/debug` page for any issues
- [ ] Verify user creation in Supabase

## 🆘 **If Authentication Still Fails**

1. **Check Environment Variables**:

   ```
   Visit: https://your-domain.pages.dev/api/auth/test-google
   ```

2. **Test Authentication Flow**:

   ```
   Visit: https://your-domain.pages.dev/debug
   ```

3. **Check Logs**:
   - Browser console for client-side errors
   - Cloudflare Pages Functions logs for server-side errors

4. **Verify Database**:
   - Ensure Supabase project is accessible
   - Check users table exists and has correct schema

## 📞 **Next Steps**

After deploying, test the authentication flow:

1. Visit your deployed app
2. Click "Sign in with Google"
3. Complete Google OAuth flow
4. Check if you're successfully authenticated
5. If issues persist, check the debug endpoints and logs

The authentication should now work properly on Cloudflare Pages!
