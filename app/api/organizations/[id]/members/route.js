import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { rbac } from '@/lib/rbac-middleware';
import { auditLogger, ACTIVITY_TYPES } from '@/lib/audit-logger';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizationId = params.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user has permission to read members
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'members.read');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.read', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    const members = await db.getOrganizationMembers(organizationId);
    return NextResponse.json(members);
  } catch (error) {
    console.error('Error fetching organization members:', error);
    return NextResponse.json({ error: 'Failed to fetch organization members' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizationId = params.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user has permission to perform bulk operations
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'members.bulk_operations');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.bulk_operations', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { memberIds, role } = body;

    if (!memberIds || !Array.isArray(memberIds) || memberIds.length === 0) {
      return NextResponse.json({ error: 'Member IDs array required' }, { status: 400 });
    }

    if (!role || !['stakeholder', 'responder', 'admin'].includes(role)) {
      return NextResponse.json({ error: 'Valid role required' }, { status: 400 });
    }

    // Update member roles
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const memberId of memberIds) {
      try {
        await db.updateOrganizationMemberRole(organizationId, memberId, role);
        results.push({ memberId, success: true });
        successful++;
      } catch (error) {
        console.error(`Failed to update member ${memberId}:`, error);
        results.push({ memberId, success: false, error: error.message });
        failed++;
      }
    }

    // Log the bulk operation
    await auditLogger.logBulkOperation(
      user.id,
      organizationId,
      ACTIVITY_TYPES.MEMBER_BULK_ROLE_CHANGE,
      {
        newRole: role,
        memberIds,
        successful,
        failed,
        total: memberIds.length,
        results
      }
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error updating organization members:', error);
    return NextResponse.json({ error: 'Failed to update organization members' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user by email
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const organizationId = params.id;
    if (!organizationId) {
      return NextResponse.json({ error: 'Organization ID required' }, { status: 400 });
    }

    // Check if user has permission to remove members
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'members.remove');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'members.remove', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    const url = new URL(request.url);
    const memberIds = url.searchParams.get('memberIds')?.split(',') || [];

    if (memberIds.length === 0) {
      return NextResponse.json({ error: 'Member IDs required' }, { status: 400 });
    }

    // Remove members
    const results = [];
    let successful = 0;
    let failed = 0;

    for (const memberId of memberIds) {
      try {
        await db.removeOrganizationMember(organizationId, memberId);
        results.push({ memberId, success: true });
        successful++;
      } catch (error) {
        console.error(`Failed to remove member ${memberId}:`, error);
        results.push({ memberId, success: false, error: error.message });
        failed++;
      }
    }

    // Log the bulk operation
    await auditLogger.logBulkOperation(
      user.id,
      organizationId,
      ACTIVITY_TYPES.MEMBER_BULK_REMOVE,
      {
        memberIds,
        successful,
        failed,
        total: memberIds.length,
        results
      }
    );

    return NextResponse.json({ results });
  } catch (error) {
    console.error('Error removing organization members:', error);
    return NextResponse.json({ error: 'Failed to remove organization members' }, { status: 500 });
  }
}