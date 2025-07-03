import { Pool } from 'pg';
import { getServerSession } from 'next-auth';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req, { params }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const serviceId = params.id;

    // Get the service and verify access
    const serviceQuery = `
      SELECT 
        s.*,
        sp.name as status_page_name,
        sp.organization_id,
        o.name as organization_name
      FROM public.services s
      JOIN public.status_pages sp ON s.status_page_id = sp.id
      JOIN public.organizations o ON sp.organization_id = o.id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND sp.deleted_at IS NULL
    `;
    
    const { rows: services } = await pool.query(serviceQuery, [serviceId]);
    
    if (services.length === 0) {
      return new Response(JSON.stringify({ error: 'Service not found' }), { status: 404 });
    }

    const service = services[0];

    // Check if user has access to this organization
    const userQuery = `SELECT id FROM public.users WHERE email = $1`;
    const { rows: userRows } = await pool.query(userQuery, [session.user.email]);
    
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 403 });
    }

    const userId = userRows[0].id;

    const membershipQuery = `
      SELECT role FROM public.organization_members 
      WHERE organization_id = $1 AND user_id = $2 AND is_active = true
    `;
    const { rows: memberRows } = await pool.query(membershipQuery, [service.organization_id, userId]);

    if (memberRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    return new Response(JSON.stringify({ service }), { status: 200 });
  } catch (err) {
    console.error('Service GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function PUT(req, { params }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const serviceId = params.id;
    const body = await req.json();
    const { name, description, status, sort_order } = body;

    // Get the service and verify access
    const serviceQuery = `
      SELECT 
        s.*,
        sp.organization_id
      FROM public.services s
      JOIN public.status_pages sp ON s.status_page_id = sp.id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND sp.deleted_at IS NULL
    `;
    
    const { rows: services } = await pool.query(serviceQuery, [serviceId]);
    
    if (services.length === 0) {
      return new Response(JSON.stringify({ error: 'Service not found' }), { status: 404 });
    }

    const service = services[0];

    // Check if user has access to this organization
    const userQuery = `SELECT id FROM public.users WHERE email = $1`;
    const { rows: userRows } = await pool.query(userQuery, [session.user.email]);
    
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 403 });
    }

    const userId = userRows[0].id;

    const membershipQuery = `
      SELECT role FROM public.organization_members 
      WHERE organization_id = $1 AND user_id = $2 AND is_active = true
    `;
    const { rows: memberRows } = await pool.query(membershipQuery, [service.organization_id, userId]);

    if (memberRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    // Update the service
    const updateQuery = `
      UPDATE public.services 
      SET 
        name = COALESCE($2, name),
        description = COALESCE($3, description),
        status = COALESCE($4, status),
        sort_order = COALESCE($5, sort_order),
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING *
    `;
    
    const { rows: updatedServices } = await pool.query(updateQuery, [
      serviceId,
      name || null,
      description || null,
      status || null,
      sort_order || null
    ]);

    if (updatedServices.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to update service' }), { status: 500 });
    }

    return new Response(JSON.stringify({
      message: 'Service updated successfully',
      service: updatedServices[0]
    }), { status: 200 });

  } catch (err) {
    console.error('Service PUT error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
}

export async function DELETE(req, { params }) {
  try {
    const session = await getServerSession();
    if (!session) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
    }

    const serviceId = params.id;

    // Get the service and verify access
    const serviceQuery = `
      SELECT 
        s.*,
        sp.organization_id
      FROM public.services s
      JOIN public.status_pages sp ON s.status_page_id = sp.id
      WHERE s.id = $1 AND s.deleted_at IS NULL AND sp.deleted_at IS NULL
    `;
    
    const { rows: services } = await pool.query(serviceQuery, [serviceId]);
    
    if (services.length === 0) {
      return new Response(JSON.stringify({ error: 'Service not found' }), { status: 404 });
    }

    const service = services[0];

    // Check if user has access to this organization
    const userQuery = `SELECT id FROM public.users WHERE email = $1`;
    const { rows: userRows } = await pool.query(userQuery, [session.user.email]);
    
    if (userRows.length === 0) {
      return new Response(JSON.stringify({ error: 'User not found' }), { status: 403 });
    }

    const userId = userRows[0].id;

    const membershipQuery = `
      SELECT role FROM public.organization_members 
      WHERE organization_id = $1 AND user_id = $2 AND is_active = true
    `;
    const { rows: memberRows } = await pool.query(membershipQuery, [service.organization_id, userId]);

    if (memberRows.length === 0) {
      return new Response(JSON.stringify({ error: 'Access denied' }), { status: 403 });
    }

    // Soft delete the service
    const deleteQuery = `
      UPDATE public.services 
      SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND deleted_at IS NULL
      RETURNING id, name
    `;
    
    const { rows: deletedServices } = await pool.query(deleteQuery, [serviceId]);

    if (deletedServices.length === 0) {
      return new Response(JSON.stringify({ error: 'Failed to delete service' }), { status: 500 });
    }

    return new Response(JSON.stringify({
      message: 'Service deleted successfully',
      service: deletedServices[0]
    }), { status: 200 });

  } catch (err) {
    console.error('Service DELETE error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
} 