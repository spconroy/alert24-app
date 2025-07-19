import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { 
  scrapeStatusPage, 
  scrapeProviderServices, 
  formatStatusPageCheck 
} from '@/lib/status-page-scraper';

export const runtime = 'edge';

export async function POST(req) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { provider, service, regions, action = 'scrape' } = body;

    // Validate required fields
    if (!provider || !service) {
      return NextResponse.json(
        { error: 'Provider and service are required' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'scrape':
        // Scrape a single service
        try {
          const result = await scrapeStatusPage(provider, service, regions);
          return NextResponse.json({
            success: true,
            result
          });
        } catch (error) {
          console.error(`Error scraping ${provider}/${service}:`, error);
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to scrape status page',
              details: error.message
            },
            { status: 500 }
          );
        }

      case 'scrape_multiple':
        // Scrape multiple services for a provider
        const { services } = body;
        if (!services || !Array.isArray(services)) {
          return NextResponse.json(
            { error: 'Services array is required for scrape_multiple action' },
            { status: 400 }
          );
        }

        try {
          const results = await scrapeProviderServices(provider, services);
          return NextResponse.json({
            success: true,
            results
          });
        } catch (error) {
          console.error(`Error scraping multiple services for ${provider}:`, error);
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to scrape multiple services',
              details: error.message
            },
            { status: 500 }
          );
        }

      case 'format_check':
        // Format a status page check configuration
        const { check_name } = body;
        try {
          const checkConfig = formatStatusPageCheck(provider, service, regions, check_name);
          return NextResponse.json({
            success: true,
            check_config: checkConfig
          });
        } catch (error) {
          console.error(`Error formatting check for ${provider}/${service}:`, error);
          return NextResponse.json(
            {
              success: false,
              error: 'Failed to format check configuration',
              details: error.message
            },
            { status: 500 }
          );
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use "scrape", "scrape_multiple", or "format_check"' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Error in status page scraper API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}

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
    const regions = searchParams.get('regions')?.split(',') || [];

    if (!provider || !service) {
      return NextResponse.json(
        { error: 'Provider and service parameters are required' },
        { status: 400 }
      );
    }

    // Perform a quick status check
    try {
      const result = await scrapeStatusPage(provider, service, regions);
      return NextResponse.json({
        success: true,
        result
      });
    } catch (error) {
      console.error(`Error scraping ${provider}/${service}:`, error);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to scrape status page',
          details: error.message
        },
        { status: 500 }
      );
    }

  } catch (error) {
    console.error('Error in status page scraper GET API:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Internal server error',
        details: error.message
      },
      { status: 500 }
    );
  }
}