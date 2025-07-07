import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { Pool } from 'pg';
import { authOptions } from '../../../auth/[...nextauth]/route.js';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export async function GET(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;

    // Get current monitoring associations for this service
    const query = `
      SELECT 
        smc.*,
        mc.name as monitoring_check_name,
        mc.check_type,
        mc.target_url,
        mc.current_status
      FROM public.service_monitoring_checks smc
      JOIN public.monitoring_checks mc ON smc.monitoring_check_id = mc.id
      WHERE smc.service_id = $1
      ORDER BY mc.name
    `;

    const result = await pool.query(query, [serviceId]);

    return NextResponse.json({
      success: true,
      associations: result.rows,
    });
  } catch (error) {
    console.error('Error fetching service monitoring associations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function PUT(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;
    const body = await request.json();
    const { associations } = body;

    if (!Array.isArray(associations)) {
      return NextResponse.json(
        { error: 'Associations must be an array' },
        { status: 400 }
      );
    }

    // Validate that the user has access to this service
    const serviceCheck = await pool.query(
      `
      SELECT s.id 
      FROM public.services s
      JOIN public.status_pages sp ON s.status_page_id = sp.id
      JOIN public.organizations o ON sp.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      JOIN public.users u ON om.user_id = u.id
      WHERE s.id = $1 AND u.email = $2 AND om.is_active = true
    `,
      [serviceId, session.user.email]
    );

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Service not found or access denied' },
        { status: 404 }
      );
    }

    // Begin transaction
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Delete existing associations
      await client.query(
        'DELETE FROM public.service_monitoring_checks WHERE service_id = $1',
        [serviceId]
      );

      // Insert new associations
      for (const assoc of associations) {
        const {
          monitoring_check_id,
          failure_threshold_minutes,
          failure_message,
        } = assoc;

        // Validate that the monitoring check exists and user has access
        const checkValidation = await client.query(
          `
          SELECT mc.id 
          FROM public.monitoring_checks mc
          JOIN public.organizations o ON mc.organization_id = o.id
          JOIN public.organization_members om ON o.id = om.organization_id
          JOIN public.users u ON om.user_id = u.id
          WHERE mc.id = $1 AND u.email = $2 AND om.is_active = true
        `,
          [monitoring_check_id, session.user.email]
        );

        if (checkValidation.rows.length === 0) {
          throw new Error(
            `Monitoring check ${monitoring_check_id} not found or access denied`
          );
        }

        await client.query(
          `
          INSERT INTO public.service_monitoring_checks 
          (service_id, monitoring_check_id, failure_threshold_minutes, failure_message, created_at, updated_at)
          VALUES ($1, $2, $3, $4, NOW(), NOW())
        `,
          [
            serviceId,
            monitoring_check_id,
            failure_threshold_minutes || 5,
            failure_message || '',
          ]
        );
      }

      await client.query('COMMIT');

      return NextResponse.json({
        success: true,
        message: 'Monitoring associations updated successfully',
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error updating service monitoring associations:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function DELETE(request, { params }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.email) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }

    const { id: serviceId } = params;

    // Validate that the user has access to this service
    const serviceCheck = await pool.query(
      `
      SELECT s.id 
      FROM public.services s
      JOIN public.status_pages sp ON s.status_page_id = sp.id
      JOIN public.organizations o ON sp.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      JOIN public.users u ON om.user_id = u.id
      WHERE s.id = $1 AND u.email = $2 AND om.is_active = true
    `,
      [serviceId, session.user.email]
    );

    if (serviceCheck.rows.length === 0) {
      return NextResponse.json(
        { error: 'Service not found or access denied' },
        { status: 404 }
      );
    }

    // Delete all associations for this service
    await pool.query(
      'DELETE FROM public.service_monitoring_checks WHERE service_id = $1',
      [serviceId]
    );

    return NextResponse.json({
      success: true,
      message: 'All monitoring associations removed successfully',
    });
  } catch (error) {
    console.error('Error removing service monitoring associations:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
