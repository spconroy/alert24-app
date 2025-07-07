
import { getServerSession } from 'next-auth/next';
import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function GET(req) {
  try {
    const session = await getServerSession();
    if (!session || !session.user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
      });
    }

    // First, get the user ID from the database using the email
    const { rows: userRows } = await pool.query(
      'SELECT id, email FROM public.users WHERE email = $1',
      [session.user.email]
    );

    if (userRows.length === 0) {
      return new Response(
        JSON.stringify({ error: 'User not found in database' }),
        { status: 404 }
      );
    }

    const userId = userRows[0].id;

    // Get all status pages from organizations the user is a member of
    const statusPagesQuery = `
      SELECT 
        sp.*,
        o.name as organization_name,
        o.slug as organization_slug
      FROM public.status_pages sp
      JOIN public.organizations o ON sp.organization_id = o.id
      JOIN public.organization_members om ON o.id = om.organization_id
      WHERE om.user_id = $1 
        AND om.is_active = true 
        AND sp.deleted_at IS NULL
        AND o.deleted_at IS NULL
      ORDER BY o.name ASC, sp.name ASC
    `;

    const { rows: statusPages } = await pool.query(statusPagesQuery, [userId]);

    // For each status page, get service summary
    const statusPagesWithServices = await Promise.all(
      statusPages.map(async statusPage => {
        const servicesQuery = `
          SELECT 
            COUNT(*) as total_services,
            SUM(CASE WHEN status = 'operational' THEN 1 ELSE 0 END) as operational,
            SUM(CASE WHEN status = 'degraded' THEN 1 ELSE 0 END) as degraded,
            SUM(CASE WHEN status = 'down' THEN 1 ELSE 0 END) as down,
            SUM(CASE WHEN status = 'maintenance' THEN 1 ELSE 0 END) as maintenance
          FROM public.services 
          WHERE status_page_id = $1 AND deleted_at IS NULL
        `;

        const { rows: serviceSummary } = await pool.query(servicesQuery, [
          statusPage.id,
        ]);

        return {
          ...statusPage,
          service_summary: {
            total: parseInt(serviceSummary[0].total_services) || 0,
            operational: parseInt(serviceSummary[0].operational) || 0,
            degraded: parseInt(serviceSummary[0].degraded) || 0,
            down: parseInt(serviceSummary[0].down) || 0,
            maintenance: parseInt(serviceSummary[0].maintenance) || 0,
          },
        };
      })
    );

    return new Response(
      JSON.stringify({ statusPages: statusPagesWithServices }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Status pages all GET error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
