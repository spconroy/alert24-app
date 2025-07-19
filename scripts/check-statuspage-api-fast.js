#!/usr/bin/env node

const fs = require('fs');
const https = require('https');
const http = require('http');
const { URL } = require('url');

// Read the status page list
const statusPageList = fs.readFileSync('status_page_list.txt', 'utf8');

// Extract URLs from the file
const urlPattern = /https?:\/\/[^\s\)]+/g;
const urls = statusPageList.match(urlPattern) || [];

// Remove duplicates
const uniqueUrls = [...new Set(urls)];

console.log(`Found ${uniqueUrls.length} unique URLs to check\n`);

// Results storage
const results = {
  compatible: [],
  incompatible: [],
  errors: [],
};

// Function to make HTTP request with timeout
function makeRequest(url, timeout = 5000) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(url);
    const client = parsedUrl.protocol === 'https:' ? https : http;

    const req = client.get(url, { timeout }, res => {
      let data = '';

      res.on('data', chunk => {
        data += chunk;
      });

      res.on('end', () => {
        resolve({
          statusCode: res.statusCode,
          headers: res.headers,
          data: data,
        });
      });
    });

    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Request timeout'));
    });

    req.on('error', err => {
      reject(err);
    });

    req.setTimeout(timeout);
  });
}

// Function to check if a URL has statuspage.io compatible API
async function checkStatuspageAPI(baseUrl) {
  const apiEndpoints = [
    '/api/v2/status.json',
    '/api/v2/summary.json',
    '/api/v2/components.json',
  ];

  const results = [];

  for (const endpoint of apiEndpoints) {
    try {
      const url = new URL(baseUrl);
      const testUrl = `${url.protocol}//${url.host}${endpoint}`;

      const response = await makeRequest(testUrl, 4000);

      if (response.statusCode === 200) {
        try {
          const jsonData = JSON.parse(response.data);

          // Check for statuspage.io API structure
          const hasStatus = jsonData.status || jsonData.page;
          const hasComponents = jsonData.components;
          const hasIndicator = jsonData.status?.indicator;
          const hasDescription =
            jsonData.status?.description || jsonData.page?.name;

          if (hasStatus || hasComponents) {
            results.push({
              endpoint: testUrl,
              structure: {
                hasStatus: !!hasStatus,
                hasComponents: !!hasComponents,
                hasIndicator: !!hasIndicator,
                hasDescription: !!hasDescription,
                keys: Object.keys(jsonData).slice(0, 10), // Limit keys for readability
              },
              sample: JSON.stringify(jsonData).substring(0, 150) + '...',
            });
            break; // Found working API, stop checking other endpoints for this URL
          }
        } catch (jsonError) {
          // Not valid JSON, skip
        }
      }
    } catch (error) {
      // Endpoint not available, continue
    }
  }

  return results;
}

// Process URLs in batches
async function processBatch(urls, batchSize = 5) {
  const batches = [];
  for (let i = 0; i < urls.length; i += batchSize) {
    batches.push(urls.slice(i, i + batchSize));
  }

  for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
    const batch = batches[batchIndex];
    console.log(
      `Processing batch ${batchIndex + 1}/${batches.length} (URLs ${batchIndex * batchSize + 1}-${Math.min((batchIndex + 1) * batchSize, urls.length)})`
    );

    const promises = batch.map(async url => {
      try {
        const apiResults = await checkStatuspageAPI(url);

        if (apiResults.length > 0) {
          console.log(`  ✅ ${url} - Compatible`);
          results.compatible.push({
            url: url,
            apis: apiResults,
          });
        } else {
          console.log(`  ❌ ${url} - No API`);
          results.incompatible.push(url);
        }
      } catch (error) {
        console.log(`  ⚠️  ${url} - Error: ${error.message}`);
        results.errors.push({
          url: url,
          error: error.message,
        });
      }
    });

    await Promise.all(promises);

    // Small delay between batches
    if (batchIndex < batches.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

// Main function to process all URLs
async function processUrls() {
  console.log('Checking statuspage.io API compatibility...\n');

  await processBatch(uniqueUrls, 10);

  // Generate report
  generateReport();
}

function generateReport() {
  console.log('\n' + '='.repeat(60));
  console.log('STATUSPAGE.IO API COMPATIBILITY REPORT');
  console.log('='.repeat(60));

  console.log(`\n📊 SUMMARY:`);
  console.log(`Total URLs checked: ${uniqueUrls.length}`);
  console.log(`Compatible: ${results.compatible.length}`);
  console.log(`Incompatible: ${results.incompatible.length}`);
  console.log(`Errors: ${results.errors.length}`);

  if (results.compatible.length > 0) {
    console.log(`\n✅ COMPATIBLE SERVICES (${results.compatible.length}):`);
    console.log('='.repeat(40));

    results.compatible.forEach((result, index) => {
      console.log(`${index + 1}. ${result.url}`);
      result.apis.forEach(api => {
        console.log(`   📡 API: ${api.endpoint}`);
        console.log(
          `   🔧 Has Status: ${api.structure.hasStatus}, Components: ${api.structure.hasComponents}`
        );
        console.log(`   📝 Keys: ${api.structure.keys.join(', ')}`);
        console.log('');
      });
    });
  }

  if (results.incompatible.length > 0) {
    console.log(`\n❌ INCOMPATIBLE SERVICES (${results.incompatible.length}):`);
    console.log('='.repeat(40));
    results.incompatible.forEach((url, index) => {
      console.log(`${index + 1}. ${url}`);
    });
  }

  if (results.errors.length > 0) {
    console.log(`\n⚠️  ERRORS (${results.errors.length}):`);
    console.log('='.repeat(40));
    results.errors.forEach((error, index) => {
      console.log(`${index + 1}. ${error.url} - ${error.error}`);
    });
  }

  // Save detailed results to JSON file
  const detailedResults = {
    timestamp: new Date().toISOString(),
    summary: {
      total: uniqueUrls.length,
      compatible: results.compatible.length,
      incompatible: results.incompatible.length,
      errors: results.errors.length,
    },
    compatible: results.compatible,
    incompatible: results.incompatible,
    errors: results.errors,
  };

  fs.writeFileSync(
    'statuspage-api-compatibility-report.json',
    JSON.stringify(detailedResults, null, 2)
  );
  console.log(
    `\n📄 Detailed report saved to: statuspage-api-compatibility-report.json`
  );

  // Also create a simple text file with just the compatible URLs
  const compatibleUrls = results.compatible.map(r => r.url).join('\n');
  fs.writeFileSync('compatible-statuspage-apis.txt', compatibleUrls);
  console.log(`📄 Compatible URLs saved to: compatible-statuspage-apis.txt`);
}

// Run the script
processUrls().catch(console.error);
