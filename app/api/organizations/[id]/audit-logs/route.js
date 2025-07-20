import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { rbac } from '@/lib/rbac-middleware';
import { auditLogger, ACTIVITY_TYPES } from '@/lib/audit-logger';

const db = new SupabaseClient();

export const runtime = 'edge';

/**
 * Get audit logs for an organization
 */
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

    // Check if user has permission to read audit logs
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'audit.read');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'audit.read', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    // Parse query parameters
    const url = new URL(request.url);
    const filters = {
      organizationId,
      userId: url.searchParams.get('userId') || undefined,
      activityType: url.searchParams.get('activityType') || undefined,
      startDate: url.searchParams.get('startDate') || undefined,
      endDate: url.searchParams.get('endDate') || undefined,
      search: url.searchParams.get('search') || undefined,
      limit: parseInt(url.searchParams.get('limit')) || 50,
      offset: parseInt(url.searchParams.get('offset')) || 0,
    };

    // Get activity logs
    const logs = await auditLogger.getActivityLogs(filters);

    // Log the audit access
    await auditLogger.log({
      userId: user.id,
      organizationId,
      activityType: ACTIVITY_TYPES.DATA_EXPORTED,
      description: 'Accessed audit logs',
      details: {
        filters,
        recordCount: logs.data.length
      }
    });

    return NextResponse.json({
      success: true,
      logs: logs.data,
      pagination: {
        hasMore: logs.hasMore,
        offset: logs.offset,
        limit: filters.limit,
        total: logs.data.length
      },
      filters
    });

  } catch (error) {
    console.error('Error fetching audit logs:', error);
    return NextResponse.json({ error: 'Failed to fetch audit logs' }, { status: 500 });
  }
}

/**
 * Export audit logs for compliance
 */
export async function POST(request, { params }) {
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

    // Check if user has permission to export audit logs
    const permissionCheck = await rbac.checkPermission(user.id, organizationId, 'audit.export');
    if (!permissionCheck.allowed) {
      await auditLogger.logSecurity(
        user.id, 
        organizationId, 
        ACTIVITY_TYPES.SECURITY_PERMISSION_DENIED,
        { permission: 'audit.export', reason: permissionCheck.reason },
        request
      );
      return NextResponse.json(
        { error: 'Forbidden - ' + permissionCheck.reason },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { format = 'csv', filters = {} } = body;

    if (!['csv', 'json'].includes(format)) {
      return NextResponse.json({ error: 'Invalid format. Supported: csv, json' }, { status: 400 });
    }

    // Export audit logs
    const exportData = await auditLogger.exportActivityLogs(organizationId, filters);

    // Log the export activity
    await auditLogger.log({
      userId: user.id,
      organizationId,
      activityType: ACTIVITY_TYPES.DATA_EXPORTED,
      description: `Exported audit logs in ${format.toUpperCase()} format`,
      details: {
        format,
        filters,
        recordCount: exportData.length,
        exportedAt: new Date().toISOString()
      }
    });

    if (format === 'csv') {
      // Convert to CSV format
      const headers = Object.keys(exportData[0] || {});
      const csvContent = [
        headers.join(','),
        ...exportData.map(row => 
          headers.map(header => {
            const value = row[header] || '';
            // Escape CSV values that contain commas or quotes
            if (typeof value === 'string' && (value.includes(',') || value.includes('"'))) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value;
          }).join(',')
        )
      ].join('\n');

      return new Response(csvContent, {
        headers: {
          'Content-Type': 'text/csv',
          'Content-Disposition': `attachment; filename="audit-logs-${organizationId}-${Date.now()}.csv"`
        }
      });
    } else {
      // Return JSON format
      return NextResponse.json({
        success: true,
        format: 'json',
        data: exportData,
        exportedAt: new Date().toISOString(),
        recordCount: exportData.length
      });
    }

  } catch (error) {
    console.error('Error exporting audit logs:', error);
    return NextResponse.json({ error: 'Failed to export audit logs' }, { status: 500 });
  }
}