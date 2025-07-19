// Status Page Scraper
// Utility functions for scraping status pages from cloud providers

import { STATUS_PAGE_PROVIDERS } from './status-page-providers.js';

// Status mapping from provider status to our standard status
const STATUS_MAPPING = {
  // Common status values
  operational: 'up',
  degraded_performance: 'degraded',
  partial_outage: 'degraded',
  major_outage: 'down',
  under_maintenance: 'maintenance',
  investigating: 'degraded',
  identified: 'degraded',
  monitoring: 'degraded',
  resolved: 'up',
  postmortem: 'up',

  // Azure specific
  available: 'up',
  unavailable: 'down',
  degraded: 'degraded',
  information: 'up',
  warning: 'degraded',
  error: 'down',

  // AWS specific
  service_operating_normally: 'up',
  service_degradation: 'degraded',
  service_disruption: 'down',
  informational: 'up',

  // GCP specific
  available: 'up',
  disruption: 'down',
  outage: 'down',
  service_information: 'up',

  // Cloudflare and Supabase specific (using indicator values)
  none: 'up',
  minor: 'degraded',
  major: 'down',
  critical: 'down',
  maintenance: 'maintenance',
  'all_systems_operational': 'up',
  'minor_service_outage': 'degraded',
  'major_service_outage': 'down',
  'partial_system_outage': 'degraded',
  'major_system_outage': 'down',

  // Default
  unknown: 'unknown',
};

// Normalize status from provider to our standard format
export function normalizeStatus(providerStatus) {
  if (!providerStatus) return 'unknown';

  const normalized = providerStatus.toLowerCase().replace(/\s+/g, '_');
  return STATUS_MAPPING[normalized] || 'unknown';
}

// Generic status page scraper
export async function scrapeStatusPage(provider, service, regions = []) {
  const providerConfig = STATUS_PAGE_PROVIDERS[provider];
  if (!providerConfig) {
    throw new Error(`Unknown provider: ${provider}`);
  }

  const serviceConfig = providerConfig.services.find(s => s.id === service);
  if (!serviceConfig) {
    throw new Error(`Unknown service: ${service} for provider: ${provider}`);
  }

  try {
    // Check if provider has a JSON API
    if (providerConfig.api_url) {
      return await scrapeJsonApi(providerConfig, serviceConfig, regions);
    } else {
      // Fallback to HTML parsing
      return await scrapeHtmlPage(providerConfig, serviceConfig, regions);
    }
  } catch (error) {
    console.error(
      `Error scraping status page for ${provider}/${service}:`,
      error
    );
    return {
      provider: providerConfig.name,
      service: serviceConfig.name,
      regions: regions.length > 0 ? regions : ['global'],
      status: 'unknown',
      raw_status: null,
      last_updated: new Date().toISOString(),
      url: providerConfig.url,
      error: error.message,
    };
  }
}

// Scrape using JSON API
async function scrapeJsonApi(providerConfig, serviceConfig, regions) {
  const response = await fetch(providerConfig.api_url, {
    headers: {
      'User-Agent': 'Alert24-StatusMonitor/1.0',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const jsonData = await response.json();

  // Parse the JSON response based on provider
  let status = 'unknown';
  let rawStatus = null;

  if (providerConfig.id === 'azure') {
    // Azure API structure - look for overall status or service-specific status
    if (jsonData.status) {
      status =
        jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    } else if (jsonData.components) {
      // Look for the specific service in components
      const serviceComponent = findServiceInComponents(
        jsonData.components,
        serviceConfig
      );
      if (serviceComponent) {
        status = serviceComponent.status;
        rawStatus = status;
      } else {
        // Use overall page status as fallback
        status = jsonData.page?.status_indicator || 'operational';
        rawStatus = status;
      }
    }
  } else if (providerConfig.id === 'aws') {
    // AWS API structure
    if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'cloudflare') {
    // Cloudflare API structure - try to find specific service component first
    let serviceStatus = null;
    
    // Try to fetch components for service-specific status
    try {
      const componentsUrl = 'https://www.cloudflarestatus.com/api/v2/components.json';
      console.log(`Fetching Cloudflare components from: ${componentsUrl}`);
      
      const componentsResponse = await fetch(componentsUrl, {
        headers: {
          'User-Agent': 'Alert24-StatusMonitor/1.0',
          Accept: 'application/json',
        },
      });
      
      if (componentsResponse.ok) {
        const componentsData = await componentsResponse.json();
        console.log(`Found ${componentsData.components?.length || 0} components`);
        
        const serviceComponent = findCloudflareServiceComponent(componentsData.components, serviceConfig);
        if (serviceComponent) {
          serviceStatus = serviceComponent.status;
          console.log(`Found service component ${serviceComponent.name} with status: ${serviceStatus}`);
        } else {
          console.log(`No matching component found for service: ${serviceConfig.id}`);
        }
      } else {
        console.warn(`Components API returned ${componentsResponse.status}`);
      }
    } catch (error) {
      console.warn('Failed to fetch Cloudflare components, using overall status:', error.message);
    }
    
    // Use service-specific status if found, otherwise fall back to overall status
    if (serviceStatus) {
      status = serviceStatus;
      rawStatus = serviceStatus;
    } else if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
      console.log(`Using overall status: ${status} (indicator: ${jsonData.status.indicator}, description: ${jsonData.status.description})`);
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'supabase') {
    // Supabase API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'gcp') {
    // GCP API structure
    if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'github') {
    // GitHub API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'stripe') {
    // Stripe API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'netlify') {
    // Netlify API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'vercel') {
    // Vercel API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'digitalocean') {
    // DigitalOcean API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'sendgrid') {
    // SendGrid API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'slack') {
    // Slack API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'twilio') {
    // Twilio API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'paypal') {
    // PayPal API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'shopify') {
    // Shopify API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'zoom') {
    // Zoom API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'zendesk') {
    // Zendesk API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'heroku') {
    // Heroku API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'discord') {
    // Discord API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'fastly') {
    // Fastly API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  } else if (providerConfig.id === 'openai') {
    // OpenAI API structure
    if (jsonData.status) {
      status = jsonData.status.indicator || jsonData.status.description || 'unknown';
      rawStatus = status;
    } else if (jsonData.page && jsonData.page.status_indicator) {
      status = jsonData.page.status_indicator;
      rawStatus = status;
    }
  }

  return {
    provider: providerConfig.name,
    service: serviceConfig.name,
    regions: regions.length > 0 ? regions : ['global'],
    status: normalizeStatus(status),
    raw_status: rawStatus,
    last_updated: new Date().toISOString(),
    url: providerConfig.url,
  };
}

// Helper function to find service in components array
function findServiceInComponents(components, serviceConfig) {
  for (const component of components) {
    // Check if component name matches service
    if (
      component.name &&
      (component.name
        .toLowerCase()
        .includes(serviceConfig.name.toLowerCase()) ||
        serviceConfig.name.toLowerCase().includes(component.name.toLowerCase()))
    ) {
      return component;
    }

    // Check child components recursively if they exist
    if (component.components && component.components.length > 0) {
      const childResult = findServiceInComponents(
        component.components,
        serviceConfig
      );
      if (childResult) return childResult;
    }
  }
  return null;
}

// Helper function to find Cloudflare service component by matching service names
function findCloudflareServiceComponent(components, serviceConfig) {
  if (!components || !Array.isArray(components)) return null;
  
  // Map service IDs to component names that might appear in Cloudflare status
  const serviceNameMappings = {
    'cloudflare-workers': ['Durable Objects', 'Workers platform', 'Workers'],
    'cloudflare-cdn': ['CDN/Cache', 'CDN', 'Cache'],
    'cloudflare-dns': ['Authoritative DNS', 'DNS', 'Cloudflare DNS'],
    'cloudflare-pages': ['Pages', 'Cloudflare Pages'],
    'cloudflare-r2': ['R2', 'Object Storage', 'D1'],
    'cloudflare-zero-trust': ['Zero Trust', 'Access', 'WARP'],
    'cloudflare-stream': ['Stream', 'Video Stream'],
    'cloudflare-images': ['Images', 'Image Optimization'],
  };
  
  const possibleNames = serviceNameMappings[serviceConfig.id] || [serviceConfig.name];
  console.log(`Looking for Cloudflare service ${serviceConfig.id} with possible names:`, possibleNames);
  
  for (const component of components) {
    if (component.name) {
      const componentName = component.name.toLowerCase();
      
      // Check if component name matches any of the possible service names
      for (const possibleName of possibleNames) {
        if (componentName.includes(possibleName.toLowerCase()) || 
            possibleName.toLowerCase().includes(componentName)) {
          console.log(`Found matching component: ${component.name} (status: ${component.status})`);
          return component;
        }
      }
    }
  }
  
  console.log(`No matching component found for service ${serviceConfig.id}`);
  return null;
}

// Scrape using HTML parsing (fallback)
async function scrapeHtmlPage(providerConfig, serviceConfig, regions) {
  const response = await fetch(providerConfig.url, {
    headers: {
      'User-Agent': 'Alert24-StatusMonitor/1.0',
    },
  });

  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }

  const html = await response.text();
  const status = parseStatusFromHtml(html, providerConfig.id, serviceConfig.id);

  return {
    provider: providerConfig.name,
    service: serviceConfig.name,
    regions: regions.length > 0 ? regions : ['global'],
    status: normalizeStatus(status),
    raw_status: status,
    last_updated: new Date().toISOString(),
    url: providerConfig.url,
  };
}

// Parse status from HTML content (simplified approach)
function parseStatusFromHtml(html, provider, service) {
  // This is a very basic parser - in production you'd want to use proper HTML parsing
  // and provider-specific selectors

  const lowerHtml = html.toLowerCase();

  // Look for outage/issue indicators first
  if (
    lowerHtml.includes('major outage') ||
    lowerHtml.includes('service unavailable') ||
    lowerHtml.includes('complete outage')
  ) {
    return 'major_outage';
  }

  if (
    lowerHtml.includes('partial outage') ||
    lowerHtml.includes('service disruption') ||
    lowerHtml.includes('some services affected')
  ) {
    return 'partial_outage';
  }

  if (
    lowerHtml.includes('degraded performance') ||
    lowerHtml.includes('performance issues') ||
    lowerHtml.includes('investigating') ||
    lowerHtml.includes('identified issue')
  ) {
    return 'degraded_performance';
  }

  if (
    lowerHtml.includes('maintenance') ||
    lowerHtml.includes('scheduled maintenance')
  ) {
    return 'under_maintenance';
  }

  // Look for positive indicators
  if (
    lowerHtml.includes('all systems operational') ||
    lowerHtml.includes('no known issues') ||
    lowerHtml.includes('all services are operating normally') ||
    lowerHtml.includes('no current issues') ||
    lowerHtml.includes('services are running normally')
  ) {
    return 'operational';
  }

  // Default to operational if no issues are explicitly mentioned
  // Most status pages show issues prominently, so absence of issues likely means operational
  return 'operational';
}

// Check multiple services for a provider
export async function scrapeProviderServices(provider, services) {
  const results = [];

  for (const serviceConfig of services) {
    try {
      const result = await scrapeStatusPage(
        provider,
        serviceConfig.service,
        serviceConfig.regions
      );
      results.push(result);
    } catch (error) {
      console.error(
        `Error scraping ${provider}/${serviceConfig.service}:`,
        error
      );
      results.push({
        provider: provider,
        service: serviceConfig.service,
        regions: serviceConfig.regions || ['global'],
        status: 'unknown',
        error: error.message,
        last_updated: new Date().toISOString(),
      });
    }
  }

  return results;
}

// Format status page check configuration for the monitoring system
export function formatStatusPageCheck(provider, service, regions, checkName) {
  const providerConfig = STATUS_PAGE_PROVIDERS[provider];
  const serviceConfig = providerConfig?.services.find(s => s.id === service);

  if (!providerConfig || !serviceConfig) {
    throw new Error(`Invalid provider or service: ${provider}/${service}`);
  }

  return {
    name: checkName || `${providerConfig.name} - ${serviceConfig.name}`,
    check_type: 'status_page',
    target_url: providerConfig.url,
    description: `Monitor ${serviceConfig.description} status from ${providerConfig.name}`,
    check_interval_seconds: 300, // 5 minutes
    timeout_seconds: 30,
    status_page_config: {
      provider: provider,
      service: service,
      regions: regions,
      api_url: providerConfig.api_url,
    },
  };
}

// Extract incident information from status page
export function extractIncidentInfo(html, provider) {
  // This would parse incident information from the status page
  // For now, return a placeholder structure
  return {
    incidents: [],
    last_updated: new Date().toISOString(),
  };
}
