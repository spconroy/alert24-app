#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

// Load environment variables from both .env and .env.local
require('dotenv').config();
require('dotenv').config({ path: '.env.local' });

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Missing Supabase configuration.');
  console.error('NEXT_PUBLIC_SUPABASE_URL not found in environment variables.');
  process.exit(1);
}

// Try service role key first, fallback to anon key
const apiKey = supabaseServiceKey || supabaseAnonKey;
if (!apiKey) {
  console.error('❌ Missing Supabase API key.');
  console.error(
    'Please ensure either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is set.'
  );
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.log(
    '⚠️  Using anon key - some operations may be restricted by RLS policies.'
  );
}

const supabase = createClient(supabaseUrl, apiKey);

// Read the compatibility report
if (!fs.existsSync('statuspage-api-compatibility-report.json')) {
  console.error('❌ Compatibility report not found.');
  console.error(
    'Please run the status page checker script first to generate statuspage-api-compatibility-report.json'
  );
  process.exit(1);
}

const compatibilityReport = JSON.parse(
  fs.readFileSync('statuspage-api-compatibility-report.json', 'utf8')
);

// Function to extract service name from URL
function extractServiceName(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '');

    // Remove common status page prefixes/suffixes
    domain = domain.replace(/^status\./, '');
    domain = domain.replace(/-status$/, '');
    domain = domain.replace(/status$/, '');

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

    // Remove common TLDs and format
    domain = domain.replace(/\.(com|org|io|us|net)$/, '');

    // Split on dots and take meaningful parts
    const parts = domain.split('.');
    const mainPart = parts.length > 1 ? parts[0] : domain;

    // Capitalize first letter and handle common patterns
    let name = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);

    // Handle specific patterns
    if (name.includes('cloud')) {
      name = name.replace('cloud', 'Cloud');
    }

    return name;
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error);
    return 'Unknown Service';
  }
}

// Function to get the default organization (we'll need one to create services)
async function getDefaultOrganization() {
  console.log('🔍 Finding default organization...');

  const { data: orgs, error } = await supabase
    .from('organizations')
    .select('id, name')
    .limit(1);

  if (error) {
    console.error('❌ Error fetching organizations:', error);
    return null;
  }

  if (!orgs || orgs.length === 0) {
    console.error(
      '❌ No organizations found. Please create an organization first.'
    );
    return null;
  }

  console.log(`✅ Using organization: ${orgs[0].name} (${orgs[0].id})`);
  return orgs[0];
}

// Function to create monitoring checks for external status pages
async function createMonitoringCheck(serviceId, url, apiUrl, serviceName) {
  try {
    // Create a monitoring check for the status page API
    const { data, error } = await supabase
      .from('monitoring_checks')
      .insert({
        service_id: serviceId,
        name: `${serviceName} Status API`,
        check_type: 'http',
        url: apiUrl,
        method: 'GET',
        expected_status_code: 200,
        check_interval: 300, // 5 minutes
        timeout: 30,
        enabled: true,
        headers: JSON.stringify({
          'User-Agent': 'Alert24-StatusChecker/1.0',
        }),
      })
      .select()
      .single();

    if (error) {
      console.error(
        `    ⚠️  Failed to create monitoring check: ${error.message}`
      );
      return null;
    }

    console.log(`    ✅ Created monitoring check for API endpoint`);
    return data;
  } catch (error) {
    console.error(`    ⚠️  Exception creating monitoring check:`, error);
    return null;
  }
}

// Function to import compatible status pages as services
async function importStatusPages(organizationId) {
  console.log('📥 Starting import of compatible status pages...');

  const compatible = compatibilityReport.compatible;
  console.log(`Found ${compatible.length} compatible status pages to import`);

  let imported = 0;
  let skipped = 0;
  let errors = 0;

  for (const item of compatible) {
    const url = item.url;
    const apiUrl = item.apis[0]?.endpoint; // Use the first working API endpoint
    const serviceName = extractServiceName(url);

    console.log(`\n🔄 Processing: ${serviceName}`);
    console.log(`   URL: ${url}`);
    console.log(`   API: ${apiUrl}`);

    try {
      // Check if service already exists (by name and organization)
      const { data: existing, error: checkError } = await supabase
        .from('services')
        .select('id, name')
        .eq('organization_id', organizationId)
        .ilike('name', `%${serviceName}%`)
        .limit(1);

      if (checkError) {
        console.error(
          `   ❌ Error checking existing services: ${checkError.message}`
        );
        errors++;
        continue;
      }

      if (existing && existing.length > 0) {
        console.log(
          `   ⏭️  Skipped - similar service already exists: ${existing[0].name}`
        );
        skipped++;
        continue;
      }

      // Create new service
      const { data: service, error: serviceError } = await supabase
        .from('services')
        .insert({
          organization_id: organizationId,
          name: serviceName,
          description: `External status monitoring for ${serviceName}. Status Page: ${url}. API: ${apiUrl}`,
          status: 'operational',
        })
        .select()
        .single();

      if (serviceError) {
        console.error(`   ❌ Error creating service: ${serviceError.message}`);
        errors++;
        continue;
      }

      console.log(`   ✅ Created service: ${service.name} (ID: ${service.id})`);

      // Create monitoring check for the API endpoint
      if (apiUrl) {
        await createMonitoringCheck(service.id, url, apiUrl, serviceName);
      }

      imported++;
    } catch (error) {
      console.error(`   ❌ Exception processing ${serviceName}:`, error);
      errors++;
    }

    // Small delay to be respectful to the database
    await new Promise(resolve => setTimeout(resolve, 200));
  }

  return { imported, skipped, errors };
}

// Function to update status_page_list.txt with import marks
function updateStatusPageList(importedCount) {
  console.log('\n📝 Updating status_page_list.txt...');

  try {
    let content = fs.readFileSync('status_page_list.txt', 'utf8');
    const compatible = compatibilityReport.compatible;

    // Create backup
    fs.writeFileSync('status_page_list_backup.txt', content);

    let marked = 0;

    // Mark each compatible URL as imported
    for (const item of compatible) {
      const url = item.url;

      // Find the line with this URL and add a mark if not already present
      const urlRegex = new RegExp(
        `^(.*?)(${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})(.*)$`,
        'gm'
      );

      content = content.replace(urlRegex, (match, before, urlMatch, after) => {
        // Only add mark if not already present
        if (before.includes('🟢') || before.includes('[IMPORTED]')) {
          return match; // Already marked
        }
        marked++;
        return (
          before
            .replace(/→✅/, '→🟢 [IMPORTED]')
            .replace(/→/, '→🟢 [IMPORTED]') +
          urlMatch +
          after
        );
      });
    }

    // Add summary at the top
    const timestamp = new Date().toISOString().split('T')[0];
    const summary = `\n# Import Summary (${timestamp})\n# 🟢 ${importedCount} services imported as monitoring targets\n# API-compatible status pages are marked with 🟢 [IMPORTED]\n\n`;

    content = summary + content;

    // Write updated content back to file
    fs.writeFileSync('status_page_list.txt', content);
    console.log(`✅ Updated status page list (marked ${marked} entries)`);
    console.log('💾 Original file backed up as status_page_list_backup.txt');

    return true;
  } catch (error) {
    console.error('❌ Error updating status page list:', error);
    return false;
  }
}

// Function to generate import summary
function generateSummary(stats, organizationName) {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 IMPORT COMPLETED SUCCESSFULLY!');
  console.log('='.repeat(60));

  console.log(`\n📊 SUMMARY:`);
  console.log(`Organization: ${organizationName}`);
  console.log(
    `Total compatible status pages: ${compatibilityReport.compatible.length}`
  );
  console.log(`✅ Successfully imported: ${stats.imported}`);
  console.log(`⏭️  Already existed (skipped): ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);

  if (stats.imported > 0) {
    console.log(`\n🚀 What's Next:`);
    console.log(
      `• ${stats.imported} new external services are now being monitored`
    );
    console.log(`• Each service has a monitoring check for its status API`);
    console.log(`• You can view and manage these in your Alert24 dashboard`);
    console.log(`• Monitoring checks will run every 5 minutes`);
    console.log(`• You'll get alerts if any status pages report issues`);
  }

  console.log(`\n📁 Files Created/Updated:`);
  console.log(`• status_page_list.txt - Updated with import status`);
  console.log(`• status_page_list_backup.txt - Backup of original`);

  // Generate detailed report
  const report = {
    timestamp: new Date().toISOString(),
    organization: organizationName,
    summary: {
      total_compatible: compatibilityReport.compatible.length,
      imported: stats.imported,
      skipped: stats.skipped,
      errors: stats.errors,
    },
    imported_services: compatibilityReport.compatible
      .slice(0, stats.imported)
      .map(item => ({
        name: extractServiceName(item.url),
        url: item.url,
        api_url: item.apis[0]?.endpoint,
      })),
  };

  fs.writeFileSync('import-summary.json', JSON.stringify(report, null, 2));
  console.log(`• import-summary.json - Detailed import report`);
}

// Main function
async function main() {
  console.log('🚀 Alert24 Status Page Bulk Importer');
  console.log('====================================\n');

  try {
    // Get organization to import into
    const organization = await getDefaultOrganization();
    if (!organization) {
      process.exit(1);
    }

    // Import status pages as services
    const stats = await importStatusPages(organization.id);

    // Update the status page list file
    updateStatusPageList(stats.imported);

    // Generate summary
    generateSummary(stats, organization.name);
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}
