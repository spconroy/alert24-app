# Supabase Migration Checklist

## Overview

Migration from HTTP Cloudflare client to Supabase client for all API endpoints.

**Current Status**: 10/31 endpoints migrated (32% complete)

---

## ✅ **COMPLETED - Already Using Supabase Client (10 endpoints)**

- [x] `app/api/auth/[...nextauth]/route.js` - NextAuth authentication
- [x] `app/api/auth/signup/route.js` - User registration
- [x] `app/api/incidents/route.js` - Incident listing/creation
- [x] `app/api/organizations/route.js` - Organization listing
- [x] `app/api/organizations/[id]/route.js` - Individual organization management
- [x] `app/api/services/route.js` - Service listing/creation
- [x] `app/api/status-pages/route.js` - Status page listing/creation
- [x] `app/api/status-updates/route.js` - Status update management
- [x] `app/api/user/profile/route.js` - User profile management
- [x] `app/api/test-supabase/route.js` - Supabase connection test

---

## 🔥 **HIGH PRIORITY - User-facing features (6 endpoints)**

Critical endpoints blocking current user workflow:

- [ ] `app/api/organizations/[id]/invitations/route.js` - Team invitations (blocking settings page)
- [ ] `app/api/incidents/[id]/route.js` - Individual incident management
- [ ] `app/api/incidents/[id]/updates/route.js` - Incident updates
- [ ] `app/api/services/[id]/route.js` - Individual service management
- [ ] `app/api/services/[id]/monitoring/route.js` - Service monitoring config
- [ ] `app/api/status-pages/[id]/route.js` - Individual status page management

---

## 🔸 **MEDIUM PRIORITY - Core functionality (6 endpoints)**

Important backend features:

- [ ] `app/api/monitoring/route.js` - Monitoring configuration
- [ ] `app/api/monitoring/execute/route.js` - Monitoring execution
- [ ] `app/api/monitoring/scheduler/route.js` - Monitoring scheduler
- [ ] `app/api/escalation-policies/route.js` - Escalation policy management
- [ ] `app/api/on-call-schedules/route.js` - On-call schedule management
- [ ] `app/api/on-call-schedules/[id]/route.js` - Individual schedule management

---

## 🔹 **LOWER PRIORITY - Advanced features (6 endpoints)**

Nice-to-have features:

- [ ] `app/api/accept-invitation/route.js` - Invitation acceptance
- [ ] `app/api/subscriptions/route.js` - Email subscriptions
- [ ] `app/api/status-pages/all/route.js` - All status pages (public)
- [ ] `app/api/services/[id]/sla/route.js` - SLA management
- [ ] `app/api/monitoring/test/route.js` - Monitoring test endpoint
- [ ] `app/api/test-cloudflare-db/route.js` - Legacy test endpoint

---

## 🧪 **TEST/DEBUG ENDPOINTS - No migration needed (3 endpoints)**

These can remain as-is or be removed:

- `app/api/debug-http/route.js` - Debug endpoint
- `app/api/test-edge/route.js` - Edge test endpoint
- `app/api/test-http-db/route.js` - HTTP DB test endpoint

---

## Migration Process

For each endpoint:

1. **Replace imports**:

   ```js
   // FROM:
   import { query, transaction } from '@/lib/db-http-cloudflare';

   // TO:
   import { SupabaseClient } from '../../../lib/db-supabase.js';
   const db = new SupabaseClient();
   ```

2. **Update authentication**:

   ```js
   // Add authOptions import for getServerSession
   import { authOptions } from '../../auth/[...nextauth]/route.js';
   const session = await getServerSession(authOptions);
   ```

3. **Convert SQL queries** to Supabase client methods
4. **Update error handling** to use NextResponse
5. **Test functionality** after migration

---

## Current Issues

- **JWT Session Errors**: Routes using old client can't authenticate properly
- **Database Connection Failures**: HTTP client no longer connects to Supabase
- **Settings Page Issues**: Organization invitations not working due to unmigrated route

---

## Next Steps

1. Start with **HIGH PRIORITY** endpoints to fix immediate user issues
2. Focus on `organizations/[id]/invitations` first (blocking settings page)
3. Migrate incident and service management endpoints
4. Test each migration thoroughly before moving to next endpoint
5. Update any missing Supabase client methods as needed

---

**Last Updated**: 2025-07-17
**Status**: In Progress - High priority migrations needed
