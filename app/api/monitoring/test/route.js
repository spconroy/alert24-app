import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { db } from '@/lib/db-supabase.js';
import { authOptions } from '@/app/api/auth/[...nextauth]/route.js';

export async function POST(req) {
  try {
    const session = await getServerSession(authOptions);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { check_id } = body;

    if (!check_id) {
      return NextResponse.json(
        { error: 'check_id is required for testing' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Get monitoring check to verify access
    const check = await db.getMonitoringCheckById(check_id);
    if (!check) {
      return NextResponse.json(
        { error: 'Monitoring check not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this organization
    const membership = await db.getOrganizationMember(
      check.organization_id,
      user.id
    );
    if (!membership) {
      return NextResponse.json(
        { error: 'Access denied - not a member of this organization' },
        { status: 403 }
      );
    }

    // Call the execution API internally
    const baseUrl = process.env.NEXTAUTH_URL || 'http://localhost:3000';
    const executeResponse = await fetch(`${baseUrl}/api/monitoring/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.INTERNAL_API_SECRET || 'test'}`,
      },
      body: JSON.stringify({
        check_id: check_id,
      }),
    });

    if (executeResponse.ok) {
      const result = await executeResponse.json();
      return NextResponse.json({
        success: true,
        message: 'Test execution completed',
        test_result: result,
        check_name: check.name,
        check_type: check.check_type,
        executed_at: new Date().toISOString(),
      });
    } else {
      const errorText = await executeResponse.text();
      return NextResponse.json(
        {
          success: false,
          error: 'Test execution failed',
          details: errorText,
        },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Test execution error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to execute test',
        details: error.message,
      },
      { status: 500 }
    );
  }
}

// GET endpoint to list all active checks for testing
export async function GET(req) {
  try {
    const checks = await db.getMonitoringChecksByStatus('active');

    return NextResponse.json(
      {
        message: 'Active monitoring checks',
        checks: checks,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Test listing error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
