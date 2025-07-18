# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

- **Development server**: `npm run dev`
- **Build**: `npm run build` 
- **Lint**: `npm run lint`
- **Format code**: `npm run format`
- **Format check**: `npm run format:check`
- **Cloudflare Pages build**: `npm run pages:build`
- **Preview locally**: `npm run preview`
- **Deploy**: `npm run deploy`

## Technology Stack

- **Framework**: Next.js 14+ with App Router
- **Language**: JavaScript (.js/.jsx files) - NOT TypeScript
- **Styling**: Tailwind CSS + Material UI (MUI)
- **Database**: PostgreSQL with multiple connection methods (Neon, Supabase, direct HTTP)
- **Authentication**: NextAuth.js v5 with Google OAuth
- **Deployment**: Cloudflare Pages with edge runtime
- **Email**: SendGrid for transactional emails

## Database Architecture

The app uses a multi-tenant PostgreSQL database with the `alert24_schema` schema:

- **Connection methods**: The app supports multiple database connection strategies:
  - `lib/db-edge.js` - Neon serverless for edge runtime (primary)
  - `lib/db-supabase.js` - Supabase client
  - `lib/db-http.js` - Direct HTTP connections
  - `lib/db-postgres.js` - Traditional pg client

- **Key tables**: organizations, users, organization_members, services, monitoring_checks, incidents, status_pages, etc.
- **Multi-tenant isolation**: All data is scoped by organization_id
- **Schema location**: `docs/database_schema.sql` and `docs/schema-updates/`

## Application Architecture

### Authentication Flow
- Google OAuth via NextAuth.js (`auth.js`)
- Session strategy: JWT
- User creation happens automatically on first login
- Session includes user ID and organization context

### Multi-Tenant Organization System
- Users can belong to multiple organizations
- Organization context managed via `contexts/OrganizationContext.js`
- Default organization setting per user
- Organization switching in navbar

### Key Features
1. **Incident Management**: Create, track, and resolve incidents
2. **Monitoring**: HTTP/ping monitoring with automated checks
3. **On-Call Schedules**: Team rotation management
4. **Status Pages**: Public status communication
5. **Real-time Updates**: Live incident and status updates

### API Route Patterns
- All API routes in `app/api/`
- Organization-scoped endpoints require authentication
- RESTful conventions: GET/POST/PUT/DELETE
- Error handling with consistent JSON responses

### Component Structure
- **NavBar.jsx**: Main navigation with org selector
- **ProtectedRoute.jsx**: Authentication wrapper
- **Providers.jsx**: Context providers (Organization, MUI theme)
- Form components use Material UI with validation

## Development Guidelines

### Code Style
- Use JavaScript (.js/.jsx), NOT TypeScript
- Prettier config: single quotes, 80 char width, semicolons
- ESLint with Next.js and Prettier integration
- Functional components with hooks
- Use @/ alias for app directory imports

### Database Operations
- Always scope queries by organization_id for multi-tenancy
- Use parameterized queries to prevent SQL injection
- Test database connections before operations
- Handle edge runtime constraints (prefer HTTP-based connections)

### Security Considerations
- All protected routes require authentication check
- Validate user belongs to organization before data access
- Environment variables for all secrets
- Never commit credentials to git

### Cloudflare Pages Deployment
- Configured for edge runtime compatibility
- Uses `@cloudflare/next-on-pages` for builds
- Images set to unoptimized for static export
- External packages like 'pg' configured for serverless

### File Organization
```
app/                    # Next.js App Router
├── api/               # API routes (organization-scoped)
├── (dashboard)/       # Protected dashboard pages  
├── globals.css        # Global styles
└── layout.js          # Root layout with providers

components/            # Reusable React components
contexts/              # React contexts (Organization)
lib/                   # Database clients and utilities
docs/                  # Database schema and documentation
```

### Testing Database Connections
Use test endpoints:
- `/api/test-edge` - Test Neon edge connection
- `/api/test-supabase` - Test Supabase connection
- `/api/debug-http` - Debug HTTP database operations

### Important Notes
- Postgres MCP is read-only - use psql CLI for database writes
- After major features, commit and push changes
- Update help page when UI changes significantly
- Properly escape passwords in CLI commands