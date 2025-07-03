# Database Configuration

## Connection Details

**Host:** 34.223.13.196  
**Database:** alert24  
**Username:** alert24  
**Password:** Sg47^kLm9@wPz!rT  
**Port:** 5432 (default PostgreSQL port)  
**Schema:** alert24_schema

## Connection String

```
postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24?options=-csearch_path%3Dalert24_schema
```

## Environment Variables

For Next.js application, add these to your `.env.local` file:

```env
DATABASE_URL="postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24?options=-csearch_path%3Dalert24_schema"
POSTGRES_HOST=34.223.13.196
POSTGRES_DB=alert24
POSTGRES_USER=alert24
POSTGRES_PASSWORD=Sg47^kLm9@wPz!rT
POSTGRES_PORT=5432
POSTGRES_SCHEMA=alert24_schema
```

## Prisma Configuration

If using Prisma ORM, update your `prisma/schema.prisma`:

```prisma
datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

generator client {
  provider = "prisma-client-js"
  previewFeatures = ["postgresqlExtensions"]
}

// Set the schema for all models
model Organizations {
  @@schema("alert24_schema")
  // ... rest of model definition
}
```

## Drizzle Configuration

If using Drizzle ORM, update your database configuration:

```typescript
import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';

const connectionString =
  'postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24?options=-csearch_path%3Dalert24_schema';
const client = postgres(connectionString);
export const db = drizzle(client);

// Set default schema for all queries
export const schema = 'alert24_schema';
```

## Schema Setup Commands

### Create Schema

```sql
CREATE SCHEMA IF NOT EXISTS alert24_schema AUTHORIZATION alert24;
```

### Set Search Path

```sql
SET search_path TO alert24_schema, public;
```

### Run Schema Creation

```bash
psql "postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24" -f docs/database_schema.sql
```

### Verify Schema

```bash
psql "postgresql://alert24:Sg47^kLm9@wPz!rT@34.223.13.196:5432/alert24" -f docs/verify_schema.sql
```

## Schema Structure

The `alert24_schema` contains:

- **11 Tables** - Core entities for multi-tenant SaaS
- **25+ Indexes** - Performance optimizations
- **4 Functions** - Helper functions for common operations
- **6 Triggers** - Automatic timestamp updates
- **2 Views** - Dashboard data aggregations
- **3 Subscription Plans** - Pre-populated pricing tiers

## Security Notes

- Keep database credentials secure and never commit them to version control
- Use environment variables in production
- Consider using connection pooling for production applications
- Ensure the database server has proper firewall rules configured
- The `alert24_schema` is owned by the `alert24` user for proper permissions

## Schema Files

- `database_schema.sql` - Complete PostgreSQL schema with alert24_schema
- `verify_schema.sql` - Verification script for schema components
- This file contains all the database structure for the Alert24 multi-tenant SaaS application
