# Database Configuration

## Supabase Configuration

**IMPORTANT: This application uses Supabase as the database provider. Direct PostgreSQL connections are not supported.**

## Environment Variables

For Next.js application, add these to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Legacy variables (not used)
# DATABASE_URL - Not used, remove if present
# POSTGRES_HOST - Not used, remove if present
# POSTGRES_DB - Not used, remove if present
# POSTGRES_USER - Not used, remove if present
# POSTGRES_PASSWORD - Not used, remove if present
# POSTGRES_PORT - Not used, remove if present
# POSTGRES_SCHEMA - Not used, remove if present
```

## Supabase Client Configuration

The application uses the Supabase client located at `lib/db-supabase.js`:

```javascript
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
```

## Schema Management

### Schema Updates
All schema changes should be made through:
1. **Supabase Dashboard** - SQL Editor (recommended)
2. **Supabase CLI** - Database migrations
3. **Never** use direct PostgreSQL connections

### Schema Files Location
- `docs/schema-updates/` - Contains all schema update files
- `docs/database_schema.sql` - Legacy schema file (reference only)

## Database Operations

### Supported Operations
- **CRUD Operations**: Via Supabase client methods
- **Real-time**: Via Supabase subscriptions
- **Row Level Security**: Configured via Supabase dashboard
- **Functions**: Via Supabase SQL editor

### Not Supported
- Direct PostgreSQL connections
- psql commands
- pg client usage
- Raw SQL execution outside Supabase

## Authentication Integration

The application uses NextAuth.js v5 with Supabase integration:

```javascript
// Example authentication check
const session = await auth();
if (!session?.user?.email) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}

// Get user via Supabase client
const user = await db.getUserByEmail(session.user.email);
```

## Multi-Tenant Architecture

### Organization Scoping
All database queries are scoped by organization_id:

```javascript
// Example organization-scoped query
const checks = await db.client
  .from('monitoring_checks')
  .select('*')
  .eq('organization_id', organizationId);
```

### Row Level Security
- All organization-scoped tables have RLS policies
- Users can only access data from their organizations
- Configured via Supabase dashboard

## Schema Structure

The database contains:

- **11+ Core Tables** - Organizations, users, members, services, etc.
- **25+ Indexes** - Performance optimizations
- **4+ Functions** - Helper functions for common operations
- **6+ Triggers** - Automatic timestamp updates
- **2+ Views** - Dashboard data aggregations
- **RLS Policies** - Row-level security for multi-tenancy

## Development Setup

### Prerequisites
- Supabase account
- Project created in Supabase dashboard
- Environment variables configured

### Setup Steps
1. Create Supabase project
2. Copy environment variables from Supabase dashboard
3. Add to `.env.local` file
4. Run schema updates via Supabase SQL editor
5. Test connection with `/api/test-supabase` endpoint

### Testing Connection
```bash
# Visit in browser to test connection
http://localhost:3000/api/test-supabase
```

## Security Notes

- Keep Supabase keys secure and never commit them to version control
- Use environment variables in production
- Service role key should only be used server-side
- Anonymous key is safe for client-side use
- RLS policies provide data isolation
- Supabase handles connection pooling automatically

## Migration Notes

### From PostgreSQL to Supabase
If migrating from direct PostgreSQL:
1. Remove all PostgreSQL connection strings
2. Remove pg client dependencies
3. Update all database calls to use Supabase client
4. Configure RLS policies in Supabase dashboard
5. Test all database operations

### Legacy Files
The following files are legacy and should not be used:
- `lib/db-postgres.js` - Direct PostgreSQL client
- `lib/db-http.js` - HTTP database client
- `lib/db-edge.js` - Edge database client
- Any psql connection strings or commands

## Support

For database configuration issues:
1. Check Supabase dashboard for errors
2. Verify environment variables are correct
3. Test connection with test endpoints
4. Check RLS policies are properly configured
5. Review Supabase documentation for specific features

---

**Important**: This application exclusively uses Supabase for database operations. All references to direct PostgreSQL connections are legacy and should be removed.