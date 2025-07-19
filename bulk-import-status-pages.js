#!/usr/bin/env node

const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Initialize Supabase client
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing Supabase configuration. Please check your .env file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Read the compatibility report
const compatibilityReport = JSON.parse(fs.readFileSync('statuspage-api-compatibility-report.json', 'utf8'));

// Function to extract domain/service name from URL
function extractServiceName(url) {
  try {
    const urlObj = new URL(url);
    let domain = urlObj.hostname.replace('www.', '');
    
    // Common patterns to clean up
    domain = domain.replace('status.', '');
    domain = domain.replace('-status', '');
    domain = domain.replace('status', '');
    domain = domain.replace('.com', '');
    domain = domain.replace('.org', '');
    domain = domain.replace('.io', '');
    domain = domain.replace('.us', '');
    domain = domain.replace('.net', '');
    
    // Handle special cases
    const specialCases = {
      'cloudflarestatus': 'Cloudflare',
      'netlifystatus': 'Netlify',
      'vercel-status': 'Vercel',
      'githubstatus': 'GitHub',
      'paypal-status': 'PayPal',
      'issquareup': 'Square',
      'redditstatus': 'Reddit',
      'discordstatus': 'Discord',
      'ocistatus.oraclecloud': 'Oracle Cloud Infrastructure'
    };
    
    for (const [pattern, name] of Object.entries(specialCases)) {
      if (domain.includes(pattern.replace('.', ''))) {
        return name;
      }
    }
    
    // Capitalize first letter
    return domain.charAt(0).toUpperCase() + domain.slice(1);
  } catch (error) {
    console.error(`Error parsing URL ${url}:`, error);
    return 'Unknown Service';
  }
}

// Function to create external status pages table if it doesn't exist
async function createExternalStatusPagesTable() {
  console.log('Creating external_status_pages table if it doesn\'t exist...');
  
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS external_status_pages (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        name VARCHAR(255) NOT NULL,
        url VARCHAR(500) NOT NULL UNIQUE,
        api_url VARCHAR(500),
        description TEXT,
        category VARCHAR(100),
        status VARCHAR(50) DEFAULT 'active',
        last_check_at TIMESTAMP WITH TIME ZONE,
        last_status VARCHAR(50),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
      
      CREATE INDEX IF NOT EXISTS idx_external_status_pages_category ON external_status_pages(category);
      CREATE INDEX IF NOT EXISTS idx_external_status_pages_status ON external_status_pages(status);
      CREATE INDEX IF NOT EXISTS idx_external_status_pages_url ON external_status_pages(url);
    `
  });
  
  if (error) {
    console.error('Error creating table:', error);
    return false;
  }
  
  console.log('✅ Table created/verified successfully');
  return true;
}

// Function to categorize services
function categorizeService(url, name) {
  const lowerUrl = url.toLowerCase();
  const lowerName = name.toLowerCase();
  
  // Cloud providers
  if (lowerUrl.includes('aws') || lowerUrl.includes('azure') || lowerUrl.includes('gcp') || 
      lowerUrl.includes('cloud') || lowerUrl.includes('oracle') || lowerUrl.includes('digitalocean') ||
      lowerUrl.includes('linode') || lowerUrl.includes('vultr') || lowerUrl.includes('scaleway') ||
      lowerUrl.includes('upcloud') || lowerUrl.includes('kinsta') || lowerUrl.includes('cloudways') ||
      lowerUrl.includes('hetzner') || lowerUrl.includes('ovh')) {
    return 'Cloud Providers';
  }
  
  // CDN & Hosting
  if (lowerUrl.includes('cloudflare') || lowerUrl.includes('fastly') || lowerUrl.includes('netlify') ||
      lowerUrl.includes('vercel') || lowerUrl.includes('pages')) {
    return 'CDN & Hosting';
  }
  
  // Communication
  if (lowerUrl.includes('sendgrid') || lowerUrl.includes('mailgun') || lowerUrl.includes('twilio') ||
      lowerUrl.includes('zoom') || lowerUrl.includes('slack') || lowerUrl.includes('webex')) {
    return 'Email & Communication';
  }
  
  // Payments
  if (lowerUrl.includes('stripe') || lowerUrl.includes('paypal') || lowerUrl.includes('square') ||
      lowerUrl.includes('plaid') || lowerUrl.includes('coinbase') || lowerUrl.includes('robinhood') ||
      lowerUrl.includes('klarna') || lowerUrl.includes('adyen')) {
    return 'Payments & Finance';
  }
  
  // Developer Tools
  if (lowerUrl.includes('github') || lowerUrl.includes('gitlab') || lowerUrl.includes('atlassian') ||
      lowerUrl.includes('heroku') || lowerUrl.includes('bitbucket')) {
    return 'Developer Platforms';
  }
  
  // E-commerce
  if (lowerUrl.includes('shopify') || lowerUrl.includes('bigcommerce') || lowerUrl.includes('magento')) {
    return 'E-commerce & SaaS';
  }
  
  // Storage & Files
  if (lowerUrl.includes('dropbox') || lowerUrl.includes('box') || lowerUrl.includes('drive')) {
    return 'Storage & File Sharing';
  }
  
  // Productivity
  if (lowerUrl.includes('asana') || lowerUrl.includes('monday') || lowerUrl.includes('trello') ||
      lowerUrl.includes('airtable') || lowerUrl.includes('miro') || lowerUrl.includes('taskade') ||
      lowerUrl.includes('hubspot') || lowerUrl.includes('netsuite')) {
    return 'CRM & Productivity';
  }
  
  // Security
  if (lowerUrl.includes('duo') || lowerUrl.includes('auth0') || lowerUrl.includes('okta') ||
      lowerUrl.includes('sumsub') || lowerUrl.includes('tailscale')) {
    return 'Security & Identity';
  }
  
  // Social Media & Communication
  if (lowerUrl.includes('discord') || lowerUrl.includes('reddit') || lowerUrl.includes('twitter') ||
      lowerUrl.includes('facebook') || lowerUrl.includes('linkedin')) {
    return 'Social Media';
  }
  
  // AI & Analytics
  if (lowerUrl.includes('openai') || lowerUrl.includes('amplitude') || lowerUrl.includes('datadog') ||
      lowerUrl.includes('appsflyer') || lowerUrl.includes('grammarly')) {
    return 'Analytics & AI';
  }
  
  return 'Other Services';
}

// Function to bulk import compatible status pages
async function bulkImportStatusPages() {
  console.log('Starting bulk import of compatible status pages...');
  
  const compatible = compatibilityReport.compatible;
  console.log(`Found ${compatible.length} compatible status pages to import`);
  
  let imported = 0;
  let skipped = 0;
  let errors = 0;
  
  for (const item of compatible) {
    const url = item.url;
    const apiUrl = item.apis[0]?.endpoint; // Use the first working API endpoint
    const name = extractServiceName(url);
    const category = categorizeService(url, name);
    
    console.log(`Importing: ${name} (${url})`);
    
    try {
      // Check if already exists
      const { data: existing, error: checkError } = await supabase
        .from('external_status_pages')
        .select('id')
        .eq('url', url)
        .single();
      
      if (existing) {
        console.log(`  ⏭️  Skipped - already exists`);
        skipped++;
        continue;
      }
      
      // Insert new record
      const { data, error } = await supabase
        .from('external_status_pages')
        .insert({
          name: name,
          url: url,
          api_url: apiUrl,
          description: `External status page for ${name}`,
          category: category,
          status: 'active'
        })
        .select()
        .single();
      
      if (error) {
        console.error(`  ❌ Error importing ${name}:`, error);
        errors++;
      } else {
        console.log(`  ✅ Imported successfully`);
        imported++;
      }
      
    } catch (error) {
      console.error(`  ❌ Exception importing ${name}:`, error);
      errors++;
    }
    
    // Small delay to be respectful to the database
    await new Promise(resolve => setTimeout(resolve, 100));
  }
  
  console.log(`\n📊 Import Summary:`);
  console.log(`✅ Imported: ${imported}`);
  console.log(`⏭️  Skipped: ${skipped}`);
  console.log(`❌ Errors: ${errors}`);
  console.log(`📊 Total: ${imported + skipped + errors}`);
  
  return { imported, skipped, errors };
}

// Function to update status_page_list.txt with checkmarks
async function updateStatusPageList() {
  console.log('\nUpdating status_page_list.txt with import status...');
  
  try {
    let content = fs.readFileSync('status_page_list.txt', 'utf8');
    const compatible = compatibilityReport.compatible;
    
    // Mark each compatible URL as imported
    for (const item of compatible) {
      const url = item.url;
      
      // Find the line with this URL and add a checkmark if not already present
      const urlPattern = new RegExp(`(.*)(${url.replace(/[.*+?^${}()|[\\]\\\\]/g, '\\$&')})(.*)`, 'g');
      content = content.replace(urlPattern, (match, before, urlMatch, after) => {
        // Only add checkmark if not already present
        if (before.includes('✅')) {
          return match; // Already marked
        }
        return before.replace('→', '→✅ [IMPORTED]') + urlMatch + after;
      });
    }
    
    // Write updated content back to file
    fs.writeFileSync('status_page_list.txt', content);
    console.log('✅ Status page list updated with import status');
    
    // Also create a backup of the original
    fs.writeFileSync('status_page_list_original.txt', fs.readFileSync('status_page_list.txt', 'utf8'));
    
    return true;
  } catch (error) {
    console.error('❌ Error updating status page list:', error);
    return false;
  }
}

// Function to generate import report
async function generateImportReport(stats) {
  console.log('\nGenerating import report...');
  
  const report = {
    timestamp: new Date().toISOString(),
    summary: {
      total_compatible: compatibilityReport.compatible.length,
      imported: stats.imported,
      skipped: stats.skipped,
      errors: stats.errors
    },
    compatible_services: compatibilityReport.compatible.map(item => ({
      name: extractServiceName(item.url),
      url: item.url,
      api_url: item.apis[0]?.endpoint,
      category: categorizeService(item.url, extractServiceName(item.url))
    }))
  };
  
  fs.writeFileSync('status-pages-import-report.json', JSON.stringify(report, null, 2));
  console.log('📄 Import report saved to: status-pages-import-report.json');
}

// Main function
async function main() {
  console.log('🚀 Starting bulk import of compatible status pages...\n');
  
  try {
    // Step 1: Create table if needed
    const tableCreated = await createExternalStatusPagesTable();
    if (!tableCreated) {
      console.error('Failed to create/verify table. Exiting.');
      process.exit(1);
    }
    
    // Step 2: Import status pages
    const stats = await bulkImportStatusPages();
    
    // Step 3: Update status page list
    await updateStatusPageList();
    
    // Step 4: Generate report
    await generateImportReport(stats);
    
    console.log('\n🎉 Bulk import completed successfully!');
    console.log(`\n📋 Summary:`);
    console.log(`• Total compatible status pages: ${compatibilityReport.compatible.length}`);
    console.log(`• Successfully imported: ${stats.imported}`);
    console.log(`• Already existed (skipped): ${stats.skipped}`);
    console.log(`• Errors: ${stats.errors}`);
    
    if (stats.imported > 0) {
      console.log(`\n✅ ${stats.imported} new external status pages have been added to your database!`);
      console.log('📄 Check status-pages-import-report.json for detailed information');
      console.log('📝 status_page_list.txt has been updated with import status');
    }
    
  } catch (error) {
    console.error('💥 Fatal error during import:', error);
    process.exit(1);
  }
}

// Run the script
main().catch(console.error);