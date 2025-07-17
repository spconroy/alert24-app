import { notFound } from 'next/navigation';
import PublicStatusPage from '../../../components/PublicStatusPage';
import { SupabaseClient } from '../../../lib/db-supabase.js';

const db = new SupabaseClient();

async function getStatusPageData(slug) {
  try {
    // Get status page by slug with organization info
    const { data: statusPages, error: statusPageError } = await db.client
      .from('status_pages')
      .select(
        `
        *,
        organizations (
          name,
          slug
        )
      `
      )
      .eq('slug', slug)
      .eq('is_public', true)
      .is('deleted_at', null)
      .single();

    if (statusPageError || !statusPages) {
      return null;
    }

    // Get all services for this status page (excluding monitoring check workarounds)
    const { data: services, error: servicesError } = await db.client
      .from('services')
      .select('*')
      .eq('status_page_id', statusPages.id)
      .is('deleted_at', null)
      .not('name', 'like', '[MONITORING]%')
      .order('sort_order', { ascending: true })
      .order('name', { ascending: true });

    if (servicesError) {
      console.error('Error fetching services:', servicesError);
      // Don't fail if services can't be loaded, just return empty array
    }

    return {
      statusPage: {
        ...statusPages,
        organization_name: statusPages.organizations?.name,
        organization_slug: statusPages.organizations?.slug,
      },
      services: services || [],
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
