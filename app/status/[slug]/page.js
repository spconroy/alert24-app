export const runtime = 'edge';

import { Pool } from 'pg';
import { notFound } from 'next/navigation';
import PublicStatusPage from '../../../components/PublicStatusPage';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function getStatusPageData(slug) {
  try {
    // Get status page by slug
    const statusPageQuery = `
      SELECT 
        sp.*,
        o.name as organization_name,
        o.slug as organization_slug
      FROM public.status_pages sp
      JOIN public.organizations o ON sp.organization_id = o.id
      WHERE sp.slug = $1 
        AND sp.deleted_at IS NULL
        AND o.deleted_at IS NULL
        AND sp.is_public = true
    `;

    const { rows: statusPageRows } = await pool.query(statusPageQuery, [slug]);

    if (statusPageRows.length === 0) {
      return null;
    }

    const statusPage = statusPageRows[0];

    // Get all services for this status page
    const servicesQuery = `
      SELECT *
      FROM public.services 
      WHERE status_page_id = $1 
        AND deleted_at IS NULL
      ORDER BY sort_order ASC, name ASC
    `;

    const { rows: services } = await pool.query(servicesQuery, [statusPage.id]);

    return {
      statusPage,
      services,
    };
  } catch (error) {
    console.error('Error fetching status page data:', error);
    throw error;
  }
}

export default async function StatusPagePublic({ params }) {
  const { slug } = params;

  const data = await getStatusPageData(slug);

  if (!data) {
    notFound();
  }

  return (
    <PublicStatusPage statusPage={data.statusPage} services={data.services} />
  );
}

export async function generateMetadata({ params }) {
  const { slug } = params;

  try {
    const data = await getStatusPageData(slug);

    if (!data) {
      return {
        title: 'Status Page Not Found',
      };
    }

    const { statusPage } = data;

    return {
      title: `${statusPage.name} - Status`,
      description:
        statusPage.description ||
        `Current status of ${statusPage.name} services`,
    };
  } catch (error) {
    return {
      title: 'Status Page',
    };
  }
}
