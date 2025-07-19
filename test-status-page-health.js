#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Read the compatibility report to get all the API endpoints
if (!fs.existsSync('statuspage-api-compatibility-report.json')) {
  console.error('❌ Compatibility report not found.');
  console.error('Please run the status page checker script first to generate statuspage-api-compatibility-report.json');
  process.exit(1);
}

const compatibilityReport = JSON.parse(fs.readFileSync('statuspage-api-compatibility-report.json', 'utf8'));

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
      'ocistatus.oraclecloud.com': 'Oracle Cloud Infrastructure'
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

// Function to make HTTP request with timeout and detailed response
function makeRequest(url, timeout = 10000) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;
    
    const req = client.get(url, { 
      timeout,
      headers: {
        'User-Agent': 'Alert24-HealthChecker/1.0',
        'Accept': 'application/json'
      }
    }, (res) => {
      let data = '';
      
      res.on('data', (chunk) => {
        data += chunk;
      });
      
      res.on('end', () => {
        const responseTime = Date.now() - startTime;
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
          responseTime: responseTime,
          success: res.statusCode >= 200 && res.statusCode < 300
        });
      });
    });
    
    req.on('timeout', () => {
      req.destroy();
      const responseTime = Date.now() - startTime;
      reject(new Error(`Request timeout after ${responseTime}ms`));
    });
    
    req.on('error', (err) => {
      const responseTime = Date.now() - startTime;
      err.responseTime = responseTime;
      reject(err);
    });
    
    req.setTimeout(timeout);
  });
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
      overallStatus = jsonData.status.indicator || jsonData.status.description || 'unknown';
      statusDescription = jsonData.status.description || jsonData.status.indicator || 'No description';
    } else if (jsonData.page) {
      overallStatus = jsonData.page.status_indicator || 'unknown';
      statusDescription = jsonData.page.status_description || 'No description';
    }
    
    // Parse components if available
    if (jsonData.components && Array.isArray(jsonData.components)) {
      components = jsonData.components.slice(0, 5).map(comp => ({
        name: comp.name,
        status: comp.status,
        description: comp.description
      }));
    }
    
    // Determine if the service is healthy
    const isHealthy = ['operational', 'none', 'normal'].includes(overallStatus.toLowerCase()) ||
                     overallStatus.toLowerCase().includes('operational');
    
    return {
      parsed: true,
      overallStatus,
      statusDescription,
      components,
      isHealthy,
      hasComponents: components.length > 0
    };
    
  } catch (error) {
    return {
      parsed: false,
      error: error.message,
      isHealthy: false
    };
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
    statusInfo: null
  };
  
  try {
    const response = await makeRequest(apiUrl, 8000);
    
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

// Function to test all status pages in batches
async function testAllStatusPages() {
  console.log('🔍 Testing Health of All Status Page APIs');
  console.log('=========================================\n');
  
  const compatible = compatibilityReport.compatible;
  console.log(`Testing ${compatible.length} status page APIs...\n`);
  
  const results = [];
  const batchSize = 8; // Process 8 at a time to avoid overwhelming servers
  
  for (let i = 0; i < compatible.length; i += batchSize) {
    const batch = compatible.slice(i, i + batchSize);
    const batchNum = Math.floor(i / batchSize) + 1;
    const totalBatches = Math.ceil(compatible.length / batchSize);
    
    console.log(`📦 Batch ${batchNum}/${totalBatches} (${batch.length} services)`);
    
    const batchPromises = batch.map(async (item) => {
      const serviceName = extractServiceName(item.url);
      const apiUrl = item.apis[0]?.endpoint;
      
      process.stdout.write(`   🔄 ${serviceName}... `);
      
      const result = await testStatusPageAPI(item.url, apiUrl, serviceName);
      
      // Output result for this service
      if (result.success && result.statusInfo?.isHealthy) {
        process.stdout.write(`✅ Healthy (${result.responseTime}ms)\n`);
      } else if (result.success) {
        const status = result.statusInfo?.overallStatus || 'unknown';
        process.stdout.write(`⚠️  ${status} (${result.responseTime}ms)\n`);
      } else {
        process.stdout.write(`❌ ${result.error} (${result.responseTime}ms)\n`);
      }
      
      return result;
    });
    
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
    
    console.log('');
    
    // Small delay between batches to be respectful
    if (i + batchSize < compatible.length) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  
  return results;
}

// Function to generate health report
function generateHealthReport(results) {
  console.log('\n' + '='.repeat(70));
  console.log('📊 STATUS PAGE HEALTH REPORT');
  console.log('='.repeat(70));
  
  const healthy = results.filter(r => r.success && r.statusInfo?.isHealthy);
  const degraded = results.filter(r => r.success && r.statusInfo && !r.statusInfo.isHealthy);
  const failed = results.filter(r => !r.success);
  
  console.log(`\n📈 OVERALL SUMMARY:`);
  console.log(`✅ Healthy Services: ${healthy.length}`);
  console.log(`⚠️  Degraded Services: ${degraded.length}`);
  console.log(`❌ Failed/Unreachable: ${failed.length}`);
  console.log(`📊 Total Tested: ${results.length}`);
  
  const healthPercentage = ((healthy.length / results.length) * 100).toFixed(1);
  console.log(`🏥 Health Score: ${healthPercentage}%`);
  
  // Performance stats
  const responseTimes = results.filter(r => r.responseTime > 0).map(r => r.responseTime);
  if (responseTimes.length > 0) {
    const avgResponseTime = (responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length).toFixed(0);
    const maxResponseTime = Math.max(...responseTimes);
    const minResponseTime = Math.min(...responseTimes);
    
    console.log(`\n⚡ PERFORMANCE:`);
    console.log(`Average Response Time: ${avgResponseTime}ms`);
    console.log(`Fastest Response: ${minResponseTime}ms`);
    console.log(`Slowest Response: ${maxResponseTime}ms`);
  }
  
  // Show degraded services
  if (degraded.length > 0) {
    console.log(`\n⚠️  DEGRADED SERVICES (${degraded.length}):`);
    console.log('='.repeat(40));
    degraded.forEach((result, index) => {
      const status = result.statusInfo?.overallStatus || 'unknown';
      const description = result.statusInfo?.statusDescription || 'No details';
      console.log(`${index + 1}. ${result.service}: ${status}`);
      console.log(`   ${description}`);
      console.log(`   Response Time: ${result.responseTime}ms`);
      console.log('');
    });
  }
  
  // Show failed services
  if (failed.length > 0) {
    console.log(`\n❌ FAILED/UNREACHABLE SERVICES (${failed.length}):`);
    console.log('='.repeat(40));
    failed.forEach((result, index) => {
      console.log(`${index + 1}. ${result.service}: ${result.error}`);
      console.log(`   API: ${result.apiUrl}`);
      if (result.responseTime > 0) {
        console.log(`   Response Time: ${result.responseTime}ms`);
      }
      console.log('');
    });
  }
  
  // Show healthy services with details
  if (healthy.length > 0) {
    console.log(`\n✅ HEALTHY SERVICES (${healthy.length}):`);
    console.log('='.repeat(40));
    
    // Group by response time for better readability
    const sortedHealthy = healthy.sort((a, b) => a.responseTime - b.responseTime);
    
    sortedHealthy.forEach((result, index) => {
      const components = result.statusInfo?.hasComponents ? 
        ` (${result.statusInfo.components.length} components)` : '';
      console.log(`${index + 1}. ${result.service}: ${result.statusInfo?.overallStatus}${components} - ${result.responseTime}ms`);
    });
  }
  
  // Save detailed results
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    summary: {
      total: results.length,
      healthy: healthy.length,
      degraded: degraded.length,
      failed: failed.length,
      healthPercentage: parseFloat(healthPercentage)
    },
    performance: responseTimes.length > 0 ? {
      averageResponseTime: Math.round(responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length),
      minResponseTime: Math.min(...responseTimes),
      maxResponseTime: Math.max(...responseTimes)
    } : null,
    results: results
  };
  
  fs.writeFileSync('status-page-health-report.json', JSON.stringify(report, null, 2));
  console.log(`\n📄 Detailed report saved to: status-page-health-report.json`);
  
  console.log(`\n🕐 Test completed at: ${new Date().toLocaleString()}`);
}

// Main function
async function main() {
  try {
    const results = await testAllStatusPages();
    generateHealthReport(results);
  } catch (error) {
    console.error('💥 Fatal error during health check:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}