# Edge Runtime Migration Guide - PostgreSQL

This guide explains how to migrate our Alert24 app to Edge Runtime while keeping PostgreSQL.

## Overview

We're replacing the Node.js `pg` library with Edge Runtime-compatible PostgreSQL clients that use HTTP/WebSocket instead of direct TCP connections.

## Database Client Options

### Option 1: Neon Database (Recommended)

- **Pros**: Serverless PostgreSQL, excellent Edge Runtime support, connection pooling
- **Cons**: Requires using Neon as your database provider
- **Client**: `@neondatabase/serverless`

### Option 2: Postgres.js

- **Pros**: Works with any PostgreSQL, lightweight, good Edge support
- **Cons**: May need WebSocket configuration
- **Client**: `postgres`

### Option 3: Supabase

- **Pros**: Full PostgreSQL + Auth + Realtime
- **Cons**: More complex setup, might be overkill
- **Client**: `@supabase/supabase-js`

## Migration Steps

### Step 1: Choose Your Database Client

We've installed both options:

- `@neondatabase/serverless` (recommended)
- `postgres` (alternative)

### Step 2: Update Database Configuration

**For Neon:**

```env
DATABASE_URL="postgresql://user:pass@ep-cool-darkness-123456.us-east-1.aws.neon.tech/neondb?sslmode=require"
```

**For existing PostgreSQL with postgres.js:**

```env
DATABASE_URL="postgresql://user:pass@your-host:5432/database?sslmode=require"
```

### Step 3: Run Migration Script

```bash
node scripts/migrate-to-edge.js
```

This will:

- Add `export const runtime = 'edge';` to all API routes
- Replace `pg` imports with Edge-compatible imports
- Update query patterns

### Step 4: Manual Updates Needed

#### 4.1 NextAuth.js Configuration

Update `app/api/auth/[...nextauth]/route.js`:

```javascript
export const runtime = 'edge';

import NextAuth from 'next-auth';
import GoogleProvider from 'next-auth/providers/google';
import { query } from '@/lib/db-edge';

// Custom adapter for Edge Runtime
const EdgeAdapter = {
  async createUser(user) {
    const result = await query(
      'INSERT INTO users (email, name, image, email_verified) VALUES ($1, $2, $3, $4) RETURNING *',
      [user.email, user.name, user.image, user.emailVerified]
    );
    return result.rows[0];
  },
  // ... implement other adapter methods
};

const handler = NextAuth({
  adapter: EdgeAdapter,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    }),
  ],
  session: { strategy: 'jwt' }, // Use JWT for Edge Runtime
});

export { handler as GET, handler as POST };
```

#### 4.2 Update Transaction Patterns

**Before (pg):**

```javascript
const client = await pool.connect();
try {
  await client.query('BEGIN');
  const result1 = await client.query('INSERT ...');
  const result2 = await client.query('UPDATE ...');
  await client.query('COMMIT');
} catch (error) {
  await client.query('ROLLBACK');
  throw error;
} finally {
  client.release();
}
```

**After (Edge):**

```javascript
await transaction(async client => {
  const result1 = await client.query('INSERT ...');
  const result2 = await client.query('UPDATE ...');
  return { result1, result2 };
});
```

### Step 5: Test Edge Runtime Compatibility

1. **Test database connection:**

   ```bash
   curl http://localhost:3000/api/test-edge
   ```

2. **Build for production:**

   ```bash
   npm run build
   ```

3. **Test with Cloudflare adapter:**
   ```bash
   npx @cloudflare/next-on-pages@1
   ```

## Database Provider Setup

### Setting up Neon (Recommended)

1. Go to [Neon Console](https://console.neon.tech)
2. Create a new project
3. Get connection string from dashboard
4. Run our existing schema migrations:
   ```bash
   psql "postgresql://user:pass@ep-xxx.neon.tech/neondb" -f docs/database_schema.sql
   ```

### Using Existing PostgreSQL

If you want to keep your current PostgreSQL:

1. Ensure SSL is enabled
2. Use `postgres` client instead of `@neondatabase/serverless`
3. Update `lib/db-edge.js` to use postgres.js

## Common Issues & Solutions

### Issue: "Module not found: Can't resolve 'fs'"

**Solution**: Make sure all API routes have `export const runtime = 'edge';`

### Issue: NextAuth.js not working

**Solution**:

- Use JWT strategy instead of database sessions
- Implement custom adapter for Edge Runtime
- Consider switching to a simpler auth solution

### Issue: Connection timeouts

**Solution**:

- Use connection pooling
- Implement retry logic
- Check SSL configuration

## Performance Considerations

1. **Connection Pooling**: Edge Runtime clients handle this automatically
2. **Query Optimization**: Same as before, but consider HTTP overhead
3. **Caching**: Implement response caching for frequently accessed data
4. **Error Handling**: Network errors are more common with HTTP-based clients

## Testing Checklist

- [ ] All API routes build without errors
- [ ] Database connections work in Edge Runtime
- [ ] Authentication flow works
- [ ] Transaction handling works
- [ ] All existing features function correctly
- [ ] Performance is acceptable
- [ ] Cloudflare deployment succeeds

## Rollback Plan

If migration fails:

1. Remove `export const runtime = 'edge';` from all files
2. Restore original `pg` imports
3. Restore original query patterns
4. Deploy to Node.js-compatible platform

## Next Steps After Migration

1. Deploy to Cloudflare Pages
2. Set up monitoring and error tracking
3. Optimize query performance
4. Implement proper error handling for network failures
