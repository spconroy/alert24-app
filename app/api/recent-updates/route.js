import { NextResponse } from 'next/server';
import { SupabaseClient, db } from '@/lib/db-supabase';
import {
  withErrorHandler,
  ApiResponse,
  Auth,
  Validator,
} from '@/lib/api-utils';

export const runtime = 'edge';

export const GET = withErrorHandler(async request => {
  const session = await Auth.requireAuth(request);
  const user = await Auth.requireUser(db, session.user.email);

  const { searchParams } = new URL(request.url);
  const organizationId = searchParams.get('organization_id');
  const limit = Math.min(parseInt(searchParams.get('limit')) || 20, 50);

  if (!organizationId) {
    return ApiResponse.badRequest('Organization ID is required');
  }

  // Validate parameters
  Validator.uuid(organizationId, 'organization_id');

  // Verify user has access to this organization
  await Auth.requireOrganizationMember(db, organizationId, user.id);

  // Get recent updates from incidents and status pages
  const recentUpdates = await db.getRecentUpdates(organizationId, limit);

  return ApiResponse.success({
    updates: recentUpdates,
    organization_id: organizationId,
  });
});