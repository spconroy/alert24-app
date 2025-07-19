import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';

export const runtime = 'edge';

// Function to make HTTP request with timeout
async function makeRequest(url, timeout = 8000) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  const startTime = Date.now();

  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'User-Agent': 'Alert24-HealthChecker/1.0',
        Accept: 'application/json',
      },
      signal: controller.signal,
    });

    const responseTime = Date.now() - startTime;
    const data = await response.text();

    clearTimeout(timeoutId);

    return {
      statusCode: response.status,
      success: response.ok,
      data: data,
      responseTime: responseTime,
    };
  } catch (error) {
    clearTimeout(timeoutId);
    const responseTime = Date.now() - startTime;

    if (error.name === 'AbortError') {
      throw new Error(`Request timeout after ${timeout}ms`);
    }

    error.responseTime = responseTime;
    throw error;
  }
}

// Function to parse statuspage.io API response
function parseStatusPageResponse(data, serviceName) {
  try {
    const jsonData = JSON.parse(data);

    let overallStatus = 'unknown';
    let statusDescription = 'Unknown status';
    let components = [];

    // Parse status from different API formats
    if (jsonData.status) {
      overallStatus =
        jsonData.status.indicator || jsonData.status.description || 'unknown';
      statusDescription =
        jsonData.status.description ||
        jsonData.status.indicator ||
        'No description';
    } else if (jsonData.page) {
      overallStatus = jsonData.page.status_indicator || 'unknown';
      statusDescription = jsonData.page.status_description || 'No description';
    }

    // Parse components if available
    if (jsonData.components && Array.isArray(jsonData.components)) {
      components = jsonData.components.slice(0, 3).map(comp => ({
        name: comp.name,
        status: comp.status,
        description: comp.description,
      }));
    }

    // Determine if the service is healthy
    const isHealthy =
      ['operational', 'none', 'normal'].includes(overallStatus.toLowerCase()) ||
      overallStatus.toLowerCase().includes('operational');

    return {
      parsed: true,
      overallStatus,
      statusDescription,
      components,
      isHealthy,
      hasComponents: components.length > 0,
    };
  } catch (error) {
    return {
      parsed: false,
      error: error.message,
      isHealthy: false,
    };
  }
}

// Function to extract service name from URL
function extractServiceName(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '');

    // Handle special cases
    const specialCases = {
      'cloudflarestatus.com': 'Cloudflare',
      'netlifystatus.com': 'Netlify',
      'vercel-status.com': 'Vercel',
      'githubstatus.com': 'GitHub',
      'paypal-status.com': 'PayPal',
      'issquareup.com': 'Square',
      'redditstatus.com': 'Reddit',
      'discordstatus.com': 'Discord',
      'ocistatus.oraclecloud.com': 'Oracle Cloud Infrastructure',
    };

    if (specialCases[domain]) {
      return specialCases[domain];
    }

    // Remove common status page prefixes/suffixes
    domain = domain.replace(/^status\./, '');
    domain = domain.replace(/-status$/, '');
    domain = domain.replace(/status$/, '');
    domain = domain.replace(/\.(com|org|io|us|net)$/, '');

    // Split on dots and take meaningful parts
    const parts = domain.split('.');
    const mainPart = parts.length > 1 ? parts[0] : domain;

    // Capitalize first letter
    let name = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);

    return name;
  } catch (error) {
    return 'Unknown Service';
  }
}

// Function to test a single status page API
async function testStatusPageAPI(url, apiUrl, serviceName) {
  const result = {
    service: serviceName,
    url: url,
    apiUrl: apiUrl,
    success: false,
    responseTime: 0,
    statusCode: null,
    error: null,
    statusInfo: null,
  };

  try {
    const response = await makeRequest(apiUrl, 6000);

    result.success = response.success;
    result.responseTime = response.responseTime;
    result.statusCode = response.statusCode;

    if (response.success) {
      result.statusInfo = parseStatusPageResponse(response.data, serviceName);
    } else {
      result.error = `HTTP ${response.statusCode}`;
    }
  } catch (error) {
    result.error = error.message;
    result.responseTime = error.responseTime || 0;
  }

  return result;
}

export async function GET(req) {
  try {
    // For debug purposes, let's make this more permissive
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(req);
    if (!session || !session.user?.email) {
      return NextResponse.json(
        {
          error: 'Unauthorized - Please sign in first',
          authDebug: {
            hasSession: !!session,
            hasUser: !!session?.user,
            hasEmail: !!session?.user?.email,
          },
        },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(req.url);
    const quick = searchParams.get('quick') === 'true';

    // Sample of status pages to test (use a subset for quick tests)
    const statusPages = [
      {
        url: 'https://www.githubstatus.com/',
        apiUrl: 'https://www.githubstatus.com/api/v2/status.json',
        service: 'GitHub',
      },
      {
        url: 'https://status.stripe.com/',
        apiUrl: 'https://status.stripe.com/api/v2/status.json',
        service: 'Stripe',
      },
      {
        url: 'https://www.cloudflarestatus.com/',
        apiUrl: 'https://www.cloudflarestatus.com/api/v2/status.json',
        service: 'Cloudflare',
      },
      {
        url: 'https://status.digitalocean.com/',
        apiUrl: 'https://status.digitalocean.com/api/v2/status.json',
        service: 'DigitalOcean',
      },
      {
        url: 'https://status.openai.com/',
        apiUrl: 'https://status.openai.com/api/v2/status.json',
        service: 'OpenAI',
      },
    ];

    // For quick tests, only test first 3
    const pagesToTest = quick ? statusPages.slice(0, 3) : statusPages;

    const results = [];

    // Test pages in batches to avoid timeout
    for (const page of pagesToTest) {
      const result = await testStatusPageAPI(
        page.url,
        page.apiUrl,
        page.service
      );
      results.push(result);
    }

    // Calculate summary stats
    const healthy = results.filter(r => r.success && r.statusInfo?.isHealthy);
    const degraded = results.filter(
      r => r.success && r.statusInfo && !r.statusInfo.isHealthy
    );
    const failed = results.filter(r => !r.success);

    const responseTimes = results
      .filter(r => r.responseTime > 0)
      .map(r => r.responseTime);
    const avgResponseTime =
      responseTimes.length > 0
        ? Math.round(
            responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
          )
        : 0;

    const healthPercentage =
      results.length > 0
        ? Math.round((healthy.length / results.length) * 100)
        : 0;

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      quick: quick,
      summary: {
        total: results.length,
        healthy: healthy.length,
        degraded: degraded.length,
        failed: failed.length,
        healthPercentage: healthPercentage,
        avgResponseTime: avgResponseTime,
      },
      results: results,
    });
  } catch (error) {
    console.error('Error in status page health check:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to check status page health',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
