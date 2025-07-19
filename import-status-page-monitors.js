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
  console.error('Please ensure either SUPABASE_SERVICE_ROLE_KEY or NEXT_PUBLIC_SUPABASE_ANON_KEY is set.');
  process.exit(1);
}

if (!supabaseServiceKey) {
  console.log('⚠️  Using anon key - some operations may be restricted by RLS policies.');
}

const supabase = createClient(supabaseUrl, apiKey);

// Read the compatibility report
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
      'ocistatus.oraclecloud.com': 'Oracle Cloud Infrastructure'
    };
    
    if (specialCases[domain]) {
      return specialCases[domain];
    }
    
    // Remove common TLDs and format
    domain = domain.replace(/\.(com|org|io|us|net)$/, '');
    
    // Split on dots and take meaningful parts
    const parts = domain.split('.');
    const mainPart = parts.length > 1 ? parts[0] : domain;
    
    // Capitalize first letter
    let name = mainPart.charAt(0).toUpperCase() + mainPart.slice(1);
    
    return name;
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error);
    return 'Unknown Service';
  }
}

// Function to get the default organization
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
    console.error('❌ No organizations found. Please create an organization first.');
    return null;
  }
  
  console.log(`✅ Using organization: ${orgs[0].name} (${orgs[0].id})`);
  return orgs[0];
}

// Function to create monitoring checks for status page APIs
async function createStatusPageMonitors(organizationId) {
  console.log('📥 Creating monitoring checks for compatible status pages...');
  
  const compatible = compatibilityReport.compatible;
  console.log(`Found ${compatible.length} compatible status pages to monitor`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const item of compatible) {
    const url = item.url;
    const apiUrl = item.apis[0]?.endpoint; // Use the first working API endpoint
    const serviceName = extractServiceName(url);
    const checkName = `${serviceName} Status Page API`;
    
    console.log(`\n🔄 Processing: ${serviceName}`);
    console.log(`   Status Page: ${url}`);
    console.log(`   API Endpoint: ${apiUrl}`);
    
    try {
      // Check if monitoring check already exists
      const { data: existing, error: checkError } = await supabase
        .from('monitoring_checks')
        .select('id, name')
        .eq('organization_id', organizationId)
        .eq('target_url', apiUrl)
        .limit(1);
      
      if (checkError) {
        console.error(`   ❌ Error checking existing monitors: ${checkError.message}`);
        errors++;
        continue;
      }
      
      if (existing && existing.length > 0) {
        console.log(`   ⏭️  Skipped - monitoring check already exists: ${existing[0].name}`);
        skipped++;
        continue;
      }
      
      // Create new monitoring check
      const { data: monitor, error: monitorError } = await supabase
        .from('monitoring_checks')
        .insert({
          organization_id: organizationId,
          name: checkName,
          check_type: 'http',
          target_url: apiUrl,
          method: 'GET',
          expected_status_code: 200,
          check_interval_seconds: 300, // 5 minutes
          timeout_seconds: 30,
          status: 'active',
          description: `Monitor ${serviceName} status page API at ${url}`,
          headers: {
            'User-Agent': 'Alert24-StatusMonitor/1.0',
            'Accept': 'application/json'
          }
        })
        .select()
        .single();
      
      if (monitorError) {
        console.error(`   ❌ Error creating monitor: ${monitorError.message}`);
        errors++;
        continue;
      }
      
      console.log(`   ✅ Created monitoring check: ${monitor.name} (ID: ${monitor.id})`);
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
    
    // Create backup if not already done
    if (!fs.existsSync('status_page_list_original.txt')) {
      fs.writeFileSync('status_page_list_original.txt', content);
    }
    
    let marked = 0;
    
    // Mark each compatible URL as monitored
    for (const item of compatible) {
      const url = item.url;
      
      // Find the line with this URL and add a mark if not already present
      const urlRegex = new RegExp(`^(.*?)(${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})(.*)$`, 'gm');
      
      content = content.replace(urlRegex, (match, before, urlMatch, after) => {
        // Only add mark if not already present
        if (before.includes('📊') || before.includes('[MONITORING]')) {
          return match; // Already marked
        }
        marked++;
        return before.replace(/→✅/, '→📊 [MONITORING]').replace(/→🟢/, '→📊 [MONITORING]').replace(/→/, '→📊 [MONITORING]') + urlMatch + after;
      });
    }
    
    // Add summary at the top
    const timestamp = new Date().toISOString().split('T')[0];
    const summary = `# Status Page Monitoring Import (${timestamp})\n# 📊 ${importedCount} monitoring checks created for API-compatible status pages\n# Status pages being monitored are marked with 📊 [MONITORING]\n\n`;
    
    // Remove any existing summaries and add new one
    content = content.replace(/^# .*Import Summary.*\n(# .*\n)*/gm, '');
    content = summary + content;
    
    // Write updated content back to file
    fs.writeFileSync('status_page_list.txt', content);
    console.log(`✅ Updated status page list (marked ${marked} entries)`);
    console.log('💾 Original file preserved as status_page_list_original.txt');
    
    return true;
  } catch (error) {
    console.error('❌ Error updating status page list:', error);
    return false;
  }
}

// Function to generate import summary
function generateSummary(stats, organizationName) {
  console.log('\n' + '='.repeat(60));
  console.log('🎉 STATUS PAGE MONITORING SETUP COMPLETED!');
  console.log('='.repeat(60));
  
  console.log(`\n📊 SUMMARY:`);
  console.log(`Organization: ${organizationName}`);
  console.log(`Total compatible status pages: ${compatibilityReport.compatible.length}`);
  console.log(`✅ Monitoring checks created: ${stats.imported}`);
  console.log(`⏭️  Already monitored (skipped): ${stats.skipped}`);
  console.log(`❌ Errors: ${stats.errors}`);
  
  if (stats.imported > 0) {
    console.log(`\n🚀 What's Monitoring Now:`);
    console.log(`• ${stats.imported} external status page APIs are now being monitored`);
    console.log(`• Checks run every 5 minutes to detect when services report issues`);
    console.log(`• You'll get alerts if any monitored status pages go down or report outages`);
    console.log(`• This helps you stay ahead of issues with services your infrastructure depends on`);
  }
  
  console.log(`\n📁 Files Updated:`);
  console.log(`• status_page_list.txt - Updated with monitoring status`);
  console.log(`• status_page_list_original.txt - Backup of original`);
  
  // Generate detailed report
  const report = {
    timestamp: new Date().toISOString(),
    organization: organizationName,
    summary: {
      total_compatible: compatibilityReport.compatible.length,
      monitoring_checks_created: stats.imported,
      already_monitored: stats.skipped,
      errors: stats.errors
    },
    monitored_services: compatibilityReport.compatible.slice(0, stats.imported).map(item => ({
      name: extractServiceName(item.url),
      status_page_url: item.url,
      api_endpoint: item.apis[0]?.endpoint,
      check_name: `${extractServiceName(item.url)} Status Page API`
    }))
  };
  
  fs.writeFileSync('status-page-monitoring-report.json', JSON.stringify(report, null, 2));
  console.log(`• status-page-monitoring-report.json - Detailed monitoring report`);
  
  console.log(`\n💡 Next Steps:`);
  console.log(`• Check your Alert24 dashboard to see the new monitoring checks`);
  console.log(`• Configure alert rules if you want notifications for status page issues`);
  console.log(`• Review the monitoring frequency (currently set to 5 minutes)`);
}

// Main function
async function main() {
  console.log('🚀 Alert24 Status Page Monitoring Setup');
  console.log('=======================================\n');
  
  try {
    // Get organization to create monitors for
    const organization = await getDefaultOrganization();
    if (!organization) {
      process.exit(1);
    }
    
    // Create monitoring checks for status page APIs
    const stats = await createStatusPageMonitors(organization.id);
    
    // Update the status page list file
    updateStatusPageList(stats.imported);
    
    // Generate summary
    generateSummary(stats, organization.name);
    
  } catch (error) {
    console.error('💥 Fatal error during setup:', error);
    process.exit(1);
  }
}

// Run the script
if (require.main === module) {
  main().catch(console.error);
}