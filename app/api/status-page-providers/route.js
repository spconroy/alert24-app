import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import {
  getStatusPageProviders,
  getStatusPageProvider,
  getProviderServices,
  getServiceRegions,
} from '@/lib/status-page-providers';

export const runtime = 'edge';

export async function GET(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const provider = searchParams.get('provider');
    const service = searchParams.get('service');

    // If no provider specified, return all providers
    if (!provider) {
      const providers = getStatusPageProviders();
      return NextResponse.json({
        success: true,
        providers: providers.map(p => ({
          id: p.id,
          name: p.name,
          description: p.description,
          url: p.url,
          service_count: p.services.length,
        })),
      });
    }

    // If provider specified but no service, return provider services
    if (provider && !service) {
      const providerData = getStatusPageProvider(provider);
      if (!providerData) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }

      const services = getProviderServices(provider);
      return NextResponse.json({
        success: true,
        provider: {
          id: providerData.id,
          name: providerData.name,
          description: providerData.description,
          url: providerData.url,
        },
        services: services.map(s => ({
          id: s.id,
          name: s.name,
          description: s.description,
          region_count: s.regions.length,
        })),
      });
    }

    // If both provider and service specified, return service regions
    if (provider && service) {
      const providerData = getStatusPageProvider(provider);
      if (!providerData) {
        return NextResponse.json(
          { error: 'Provider not found' },
          { status: 404 }
        );
      }

      const serviceData = providerData.services.find(s => s.id === service);
      if (!serviceData) {
        return NextResponse.json(
          { error: 'Service not found' },
          { status: 404 }
        );
      }

      const regions = getServiceRegions(provider, service);
      return NextResponse.json({
        success: true,
        provider: {
          id: providerData.id,
          name: providerData.name,
        },
        service: {
          id: serviceData.id,
          name: serviceData.name,
          description: serviceData.description,
        },
        regions: regions,
      });
    }
  } catch (error) {
    console.error('Error fetching status page providers:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to fetch status page providers',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
