// Status Page Scraper
// Utility functions for scraping status pages from cloud providers

import { STATUS_PAGE_PROVIDERS } from './status-page-providers.js';

// Status mapping from provider status to our standard status
const STATUS_MAPPING = {
  // Common status values
  'operational': 'up',
  'degraded_performance': 'degraded',
  'partial_outage': 'degraded',
  'major_outage': 'down',
  'under_maintenance': 'maintenance',
  'investigating': 'degraded',
  'identified': 'degraded',
  'monitoring': 'degraded',
  'resolved': 'up',
  'postmortem': 'up',
  
  // Azure specific
  'available': 'up',
  'unavailable': 'down',
  'degraded': 'degraded',
  'information': 'up',
  'warning': 'degraded',
  'error': 'down',
  
  // AWS specific
  'service_operating_normally': 'up',
  'service_degradation': 'degraded',
  'service_disruption': 'down',
  'informational': 'up',
  
  // GCP specific
  'available': 'up',
  'disruption': 'down',
  'outage': 'down',
  'service_information': 'up',
  
  // Default
  'unknown': 'unknown'
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
    // For now, we'll use a simplified approach that checks the main status page
    // In a production environment, you'd want to use the actual APIs
    const response = await fetch(providerConfig.url, {
      headers: {
        'User-Agent': 'Alert24-StatusMonitor/1.0'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    const html = await response.text();
    
    // This is a simplified parser - in production you'd want more sophisticated parsing
    const status = parseStatusFromHtml(html, provider, service);
    
    return {
      provider: providerConfig.name,
      service: serviceConfig.name,
      regions: regions.length > 0 ? regions : ['global'],
      status: normalizeStatus(status),
      raw_status: status,
      last_updated: new Date().toISOString(),
      url: providerConfig.url
    };
    
  } catch (error) {
    console.error(`Error scraping status page for ${provider}/${service}:`, error);
    return {
      provider: providerConfig.name,
      service: serviceConfig.name,
      regions: regions.length > 0 ? regions : ['global'],
      status: 'unknown',
      raw_status: null,
      last_updated: new Date().toISOString(),
      url: providerConfig.url,
      error: error.message
    };
  }
}

// Parse status from HTML content (simplified approach)
function parseStatusFromHtml(html, provider, service) {
  // This is a very basic parser - in production you'd want to use proper HTML parsing
  // and provider-specific selectors
  
  const lowerHtml = html.toLowerCase();
  
  // Look for common status indicators
  if (lowerHtml.includes('all systems operational') || 
      lowerHtml.includes('no known issues') ||
      lowerHtml.includes('all services are operating normally')) {
    return 'operational';
  }
  
  if (lowerHtml.includes('degraded performance') ||
      lowerHtml.includes('performance issues') ||
      lowerHtml.includes('investigating')) {
    return 'degraded_performance';
  }
  
  if (lowerHtml.includes('partial outage') ||
      lowerHtml.includes('service disruption')) {
    return 'partial_outage';
  }
  
  if (lowerHtml.includes('major outage') ||
      lowerHtml.includes('service unavailable')) {
    return 'major_outage';
  }
  
  if (lowerHtml.includes('maintenance') ||
      lowerHtml.includes('scheduled maintenance')) {
    return 'under_maintenance';
  }
  
  return 'unknown';
}

// Check multiple services for a provider
export async function scrapeProviderServices(provider, services) {
  const results = [];
  
  for (const serviceConfig of services) {
    try {
      const result = await scrapeStatusPage(provider, serviceConfig.service, serviceConfig.regions);
      results.push(result);
    } catch (error) {
      console.error(`Error scraping ${provider}/${serviceConfig.service}:`, error);
      results.push({
        provider: provider,
        service: serviceConfig.service,
        regions: serviceConfig.regions || ['global'],
        status: 'unknown',
        error: error.message,
        last_updated: new Date().toISOString()
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
      api_url: providerConfig.api_url
    }
  };
}

// Extract incident information from status page
export function extractIncidentInfo(html, provider) {
  // This would parse incident information from the status page
  // For now, return a placeholder structure
  return {
    incidents: [],
    last_updated: new Date().toISOString()
  };
}