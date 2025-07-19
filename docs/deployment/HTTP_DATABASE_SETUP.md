# HTTP Database Setup Guide

This guide helps you configure your Alert24 app to use HTTP database access through your Cloudflare tunnel with JWT authentication.

## 1. Environment Configuration

Create a `.env.local` file in your project root with the following variables:

```env
# HTTP Database Configuration (Cloudflare Tunnel)
HTTP_DATABASE_URL="https://pgdb1.alert24.net/"

# JWT Authentication Secret for Database Access
JWT_SECRET="your-super-secret-jwt-key-here-min-32-chars"

# Alternative variable name (backup)
DATABASE_JWT_SECRET="your-super-secret-jwt-key-here-min-32-chars"

# NextAuth Configuration
NEXTAUTH_URL="https://your-domain.com"
NEXTAUTH_SECRET="your-nextauth-secret"

# OAuth Providers
GOOGLE_CLIENT_ID="your-google-client-id"
GOOGLE_CLIENT_SECRET="your-google-client-secret"
```

## 2. Database Permissions Setup

Run the permissions script on your PostgreSQL database:

```bash
# Connect to your PostgreSQL database
psql "postgresql://user:password@host:port/database"

# Run the permissions setup script
\i scripts/setup-http-permissions.sql
```

Or execute via your database administration tool.

## 3. JWT Secret Generation

Generate a strong JWT secret (minimum 32 characters):

```bash
# Option 1: OpenSSL
openssl rand -base64 32

# Option 2: Node.js
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Option 3: Manual (ensure it's at least 32 characters)
echo "your-very-long-and-secure-secret-key-here-32chars-minimum"
```

## 4. Test the Connection

Start your development server and test the HTTP database connection:

```bash
npm run dev
```

Then visit: `http://localhost:3002/api/test-http-db`

You should see a successful response with database information.

## 5. Cloudflare Tunnel Configuration

Ensure your Cloudflare tunnel is properly configured to forward requests to your PostgreSQL HTTP API. Your tunnel should:

1. **Forward HTTPS requests** from `https://pgdb1.alert24.net/` to your PostgreSQL HTTP service
2. **Handle JWT authentication** by extracting the `Authorization: Bearer <token>` header
3. **Route API calls** to the appropriate PostgreSQL functions

### Expected Endpoints

Your HTTP database service should expose these endpoints:

- `POST /rpc/execute_sql` - Execute raw SQL queries
- `GET /rpc/health_check` - Health check endpoint
- `GET /{table_name}` - REST-style table access (if using PostgREST)

## 6. Security Considerations

### JWT Token Configuration

Tokens are generated with these claims:

```json
{
  "role": "authenticated",
  "iat": 1640995200,
  "exp": 1641081600,
  "user_id": "uuid-here",
  "organization_id": "uuid-here"
}
```

### Database Role Mapping

- `anon` - Anonymous access (read-only public data)
- `authenticated` - Logged-in users (full CRUD on owned data)
- `service_role` - Admin operations (bypass RLS)

### Row Level Security (RLS)

The setup script enables RLS on sensitive tables:

- Users can only see their own data
- Organization members can see organization data
- Public status pages are accessible to all

## 7. API Migration

Update your existing API routes to use the new HTTP database client:

```javascript
// Before (using pg)
import { Pool } from 'pg';
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

// After (using HTTP)
import { query } from '@/lib/db-http';
export const runtime = 'edge';
```

## 8. Error Handling

Common issues and solutions:

### "JWT_SECRET is required"

- Ensure `JWT_SECRET` is set in your environment variables
- JWT secret must be at least 32 characters long

### "HTTP 401: Unauthorized"

- Check JWT token generation
- Verify database roles exist (`anon`, `authenticated`, `service_role`)
- Ensure proper permissions are granted

### "HTTP 404: Not Found"

- Verify your Cloudflare tunnel is running
- Check the `HTTP_DATABASE_URL` endpoint
- Ensure your PostgreSQL HTTP service is accessible

### "Function does not exist"

- Run the permissions setup script
- Verify `alert24_schema.execute_sql` function exists
- Check function permissions

## 9. Testing Commands

Test different aspects of your setup:

```bash
# Test basic connection
curl http://localhost:3002/api/test-http-db

# Test with custom SQL
curl -X POST http://localhost:3002/api/test-http-db \
  -H "Content-Type: application/json" \
  -d '{"sql": "SELECT COUNT(*) FROM alert24_schema.users", "params": []}'

# Test health check (direct to tunnel)
curl -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  https://pgdb1.alert24.net/rpc/health_check
```

## 10. Production Deployment

For Cloudflare Pages deployment:

1. Set environment variables in Cloudflare Pages dashboard
2. Ensure all API routes have `export const runtime = 'edge';`
3. Update `wrangler.toml` with environment variables
4. Deploy with: `npm run build && npx wrangler pages deploy`

## 11. Monitoring and Logs

Monitor your HTTP database connection:

- Check Cloudflare tunnel logs
- Monitor PostgreSQL connection logs
- Use the health check endpoint for uptime monitoring
- Set up alerts for authentication failures

## Troubleshooting

If you encounter issues:

1. Check the test endpoint: `/api/test-http-db`
2. Verify environment variables are set
3. Ensure database permissions are properly configured
4. Check JWT token generation and validation
5. Verify Cloudflare tunnel is operational

Contact your database administrator if you need help with PostgreSQL permissions or Cloudflare tunnel configuration.
