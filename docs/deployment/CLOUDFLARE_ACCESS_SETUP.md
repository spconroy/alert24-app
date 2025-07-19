# Cloudflare Access Authentication Setup

Your HTTP database connection is being blocked by Cloudflare Access. Here are solutions to resolve this.

## Current Status ✅

- ✅ HTTP_DATABASE_URL configured correctly
- ✅ JWT_SECRET configured correctly
- ✅ Cloudflare tunnel is reachable
- ✅ JWT token generation working
- ❌ Cloudflare Access blocking API endpoints

## Solution Options

### Option 1: Configure Cloudflare Access Service Auth (Recommended)

This allows your application to authenticate with Cloudflare Access programmatically.

#### Step 1: Create Service Auth in Cloudflare Dashboard

1. Go to **Cloudflare Zero Trust Dashboard** → **Access** → **Service Auth**
2. Click **"Add a Service Token"**
3. Name: `alert24-database-api`
4. Copy the **Client ID** and **Client Secret**

#### Step 2: Add to Environment Variables

Add these to your `.env.local`:

```env
# Existing configuration
HTTP_DATABASE_URL="https://pgdb1.alert24.net/"
JWT_SECRET="alert24-super-secret-jwt-key-for-database-access-32chars"

# NEW: Cloudflare Access Service Auth
CF_ACCESS_CLIENT_ID="your-service-token-client-id"
CF_ACCESS_CLIENT_SECRET="your-service-token-client-secret"
```

#### Step 3: Update Access Policy

In Cloudflare Zero Trust → Access → Applications:

1. Find your database application policy
2. Add a new rule: **Service Auth**
3. Include your service token: `alert24-database-api`

### Option 2: IP Allowlist (Alternative)

If you prefer IP-based access instead of Service Auth:

1. **Cloudflare Zero Trust** → **Access** → **Applications**
2. Find your database application
3. Add IP allowlist rule for your application's deployment IPs
4. For development: Add your current IP

### Option 3: Disable Cloudflare Access (Least Secure)

**⚠️ Only recommended for development or if you have other security measures**

1. **Cloudflare Zero Trust** → **Access** → **Applications**
2. Find your database application
3. Temporarily disable the policy
4. **Important**: Ensure your database has other security measures

### Option 4: Use Different Endpoint

Create a separate endpoint without Cloudflare Access:

1. Set up `pgdb-api.alert24.net` (different subdomain)
2. Configure tunnel without Access policy
3. Update `HTTP_DATABASE_URL` to use new endpoint

## Testing After Configuration

Once you've implemented a solution, test it:

```bash
# Test the connection
curl http://localhost:3002/api/test-cloudflare-db

# Should return success: true with database connection working
```

## Recommended Approach

**For Production**: Use Option 1 (Service Auth) - most secure and scalable  
**For Development**: Use Option 2 (IP Allowlist) - simpler setup

## Service Auth Setup Commands

### Generate Service Auth Token (Cloudflare Dashboard)

1. Navigate to: https://dash.teams.cloudflare.com/
2. Go to **Access** → **Service Auth**
3. Create new service token for `alert24-database-api`

### Test Service Auth

```bash
# Add credentials to environment
echo "CF_ACCESS_CLIENT_ID=your-client-id" >> .env.local
echo "CF_ACCESS_CLIENT_SECRET=your-client-secret" >> .env.local

# Restart development server
npm run dev

# Test connection
curl http://localhost:3002/api/test-cloudflare-db
```

## Expected Success Response

After proper configuration, you should see:

```json
{
  "success": true,
  "tests": {
    "simple_connectivity": { "status": "reachable" },
    "full_health_check": { "status": "healthy" },
    "connection_test": true
  }
}
```

## Troubleshooting

### Still getting 400 errors?

- Verify service token is added to Access policy
- Check the Client ID and Secret are correct
- Ensure the application policy includes your service token

### Connection timeout?

- Verify the tunnel is running
- Check DNS resolution for pgdb1.alert24.net
- Ensure the database service is accessible behind the tunnel

### Need help?

Check the `/api/debug-http` endpoint for detailed diagnostics.
