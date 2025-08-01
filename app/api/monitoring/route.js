import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { STATUS_PAGE_PROVIDERS } from '@/lib/status-page-providers';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET(req) {
  try {
    console.log('🔍 Monitoring API GET - Environment check:', {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasSupabaseKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      runtime: process.env.NODE_ENV,
      userAgent: req.headers.get('user-agent')?.substring(0, 50),
      hasNextAuthSecret: !!process.env.NEXTAUTH_SECRET,
      cookies: req.headers.get('cookie')?.length || 0,
    });

    // Use custom session manager instead of NextAuth
    const sessionManager = new SessionManager();
    let session;
    try {
      session = await sessionManager.getSessionFromRequest(req);
      console.log('🔍 Session result:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        hasEmail: !!session?.user?.email,
        email: session?.user?.email,
        sessionKeys: session ? Object.keys(session) : [],
        userKeys: session?.user ? Object.keys(session.user) : [],
      });
    } catch (sessionError) {
      console.error('🔥 Session error:', sessionError);
      return NextResponse.json(
        {
          error: 'Session verification failed',
          details: sessionError.message,
          code: 'SESSION_ERROR',
        },
        { status: 401 }
      );
    }

    if (!session || !session.user?.email) {
      console.log('❌ No valid session found');
      return NextResponse.json(
        {
          error: 'Unauthorized - No valid session',
          debug: {
            hasSession: !!session,
            hasUser: !!session?.user,
            hasEmail: !!session?.user?.email,
            cookieCount: req.headers.get('cookie')?.length || 0,
            authSystem: 'custom-session-manager',
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const organizationId = searchParams.get('organization_id');
    const checkType = searchParams.get('check_type');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit')) || 10;
    const offset = parseInt(searchParams.get('offset')) || 0;

    // Get user
    let user;
    try {
      user = await db.getUserByEmail(session.user.email);
      console.log('🔍 User lookup result:', {
        userFound: !!user,
        email: session.user.email,
      });
    } catch (dbError) {
      console.error('🔥 Database connection error in getUserByEmail:', dbError);
      return NextResponse.json(
        {
          error: 'Database connection failed',
          details: dbError.message,
          code: dbError.code,
        },
        { status: 500 }
      );
    }

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring checks with filters
    const filters = {
      organization_id: organizationId,
      check_type: checkType,
      status,
      limit,
      offset,
    };

    console.log('Monitoring API - Filters:', filters);
    console.log('Monitoring API - User ID:', user.id);

    let monitoringChecks = [];
    try {
      monitoringChecks = await db.getMonitoringChecks(user.id, filters);
      console.log(
        'Monitoring API - Raw result count:',
        monitoringChecks.length
      );
    } catch (dbError) {
      console.warn(
        'Database error fetching monitoring checks, returning empty array:',
        dbError
      );
      monitoringChecks = [];
    }

    // Debug: Check STATUS_PAGE_PROVIDERS availability
    console.log(
      '🔧 STATUS_PAGE_PROVIDERS available in API:',
      !!STATUS_PAGE_PROVIDERS
    );
    console.log(
      '🔧 STATUS_PAGE_PROVIDERS keys:',
      Object.keys(STATUS_PAGE_PROVIDERS || {})
    );

    // Transform the data to match expected format
    const formattedChecks = (monitoringChecks || []).map(check => {
      let status_page_url = null;

      // Debug: Log each check transformation
      if (check.check_type === 'status_page') {
        console.log('🎯 Processing status page check:', {
          name: check.name,
          check_type: check.check_type,
          has_status_page_config: !!check.status_page_config,
          provider: check.status_page_config?.provider,
          STATUS_PAGE_PROVIDERS_available: !!STATUS_PAGE_PROVIDERS,
        });
      }

      // For status page checks, populate the URL based on provider
      if (
        check.check_type === 'status_page' &&
        check.status_page_config?.provider
      ) {
        const provider = check.status_page_config.provider;
        const providerConfig = STATUS_PAGE_PROVIDERS[provider];
        console.log('🔗 Provider lookup:', {
          provider,
          providerConfig: !!providerConfig,
          providerUrl: providerConfig?.url,
        });
        if (providerConfig) {
          status_page_url = providerConfig.url;
          console.log('✅ Setting status_page_url:', status_page_url);
        }
      }

      return {
        ...check,
        is_active: check.status === 'active' || check.is_active,
        organization_name: check.organization_name || check.organizations?.name,
        created_by_name: check.created_by_user?.name,
        created_by_email: check.created_by_user?.email,
        status_page_url: status_page_url, // Add the populated URL
      };
    });

    // Debug: Check if status_page_config is present in the final response
    const statusPageChecks = formattedChecks.filter(
      check => check.check_type === 'status_page'
    );
    console.log('🔍 Total checks returned:', formattedChecks.length);
    console.log('🔍 Status page checks found:', statusPageChecks.length);

    if (statusPageChecks.length > 0) {
      console.log(
        '🔍 Status page checks in API response:',
        statusPageChecks.map(check => ({
          name: check.name,
          check_type: check.check_type,
          has_status_page_config: !!check.status_page_config,
          status_page_config: check.status_page_config,
          status_page_url: check.status_page_url, // ← This is the key field!
        }))
      );
    }

    return NextResponse.json({
      success: true,
      monitoring_checks: formattedChecks,
      count: formattedChecks.length,
    });
  } catch (error) {
    console.error('Error fetching monitoring checks:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch monitoring checks',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const {
      name,
      check_type,
      target_url,
      check_interval_seconds = 300, // Form sends seconds, default 5 minutes
      timeout_seconds = 30,
      organization_id,
      expected_status_codes = [200],
      keyword_match,
      keyword_match_type,
      http_method = 'GET',
      http_headers = {},
      follow_redirects = true,
      ssl_check_enabled = false,
      is_active = true,
      monitoring_locations = [],
      target_port,
      // Incident creation fields
      auto_create_incidents = false,
      incident_severity = 'medium',
      incident_threshold_minutes = 5,
      incident_title_template,
      incident_description_template,
      auto_resolve_incidents = true,
      assigned_on_call_schedule_id,
      assigned_escalation_policy_id,
      // Service association fields
      linked_service_id,
      update_service_status = false,
      service_failure_status = 'down',
      service_recovery_status = 'operational',
    } = body;

    // Validation
    if (!name || !check_type || !organization_id) {
      return NextResponse.json(
        { error: 'Name, check_type, and organization_id are required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check organization membership
    const membership = await db.getOrganizationMember(organization_id, user.id);
    if (
      !membership ||
      !['owner', 'admin', 'responder'].includes(membership.role)
    ) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Start with minimal required fields
    const checkData = {
      name,
      check_type,
      target_url, // Use target_url directly, not url
      organization_id,
      is_active: is_active !== undefined ? is_active : true,
      // SSL Certificate checking
      ssl_check_enabled: ssl_check_enabled || false,
      // HTTP specific settings
      http_method: http_method || 'GET',
      expected_status_codes: expected_status_codes || [200],
      follow_redirects:
        follow_redirects !== undefined ? follow_redirects : true,
      keyword_match,
      keyword_match_type,
      http_headers: http_headers || {},
      // Set timing fields directly in seconds
      check_interval_seconds: check_interval_seconds || 300,
      timeout_seconds: timeout_seconds || 30,
      // Status page configuration for status_page check type
      status_page_config: body.status_page_config || null,
      // Link to service if provided
      linked_service_id: body.linked_service_id || null,
      // Incident creation settings
      auto_create_incidents: auto_create_incidents || false,
      incident_severity: incident_severity || 'medium',
      incident_threshold_minutes: incident_threshold_minutes || 5,
      incident_title_template: incident_title_template || null,
      incident_description_template: incident_description_template || null,
      auto_resolve_incidents: auto_resolve_incidents !== undefined ? auto_resolve_incidents : true,
      assigned_on_call_schedule_id: assigned_on_call_schedule_id || null,
      assigned_escalation_policy_id: assigned_escalation_policy_id || null,
      // Service association settings
      linked_service_id: linked_service_id || null,
      update_service_status: update_service_status || false,
      service_failure_status: service_failure_status || 'down',
      service_recovery_status: service_recovery_status || 'operational',
      // Set required fields for RLS
      created_by: user.id,
    };

    console.log('Monitoring API - Request body:', body);
    console.log('Monitoring API - Processed checkData:', checkData);

    console.log('Creating monitoring check with minimal data:', checkData);
    const monitoringCheck = await db.createMonitoringCheck(checkData);

    return NextResponse.json(
      {
        success: true,
        monitoring_check: monitoringCheck,
        message: 'Monitoring check created successfully',
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error creating monitoring check:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create monitoring check',
        details: error.message || 'Unknown error occurred',
        debug: {
          code: error.code,
          details: error.details,
          hint: error.hint,
        },
      },
      { status: 500 }
    );
  }
}

export async function PUT(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get('id');

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    const body = await req.json();

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Update monitoring check
    const updatedCheck = await db.updateMonitoringCheck(checkId, {
      ...body,
      updated_at: new Date().toISOString(),
    });

    return NextResponse.json({
      success: true,
      monitoring_check: updatedCheck,
      message: 'Monitoring check updated successfully',
    });
  } catch (error) {
    console.error('Error updating monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to update monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const checkId = searchParams.get('id');

    if (!checkId) {
      return NextResponse.json(
        { error: 'Monitoring check ID is required' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Delete monitoring check
    await db.deleteMonitoringCheck(checkId);

    return NextResponse.json({
      success: true,
      message: 'Monitoring check deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting monitoring check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to delete monitoring check',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
