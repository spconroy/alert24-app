#!/usr/bin/env node

/**
 * Apply Migration: 12_missing_columns_and_fixes.sql
 * 
 * This script applies the critical database migration directly to Supabase.
 * It uses the Supabase service key to execute DDL statements.
 */

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables
import dotenv from 'dotenv';
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing Supabase credentials');
  console.error('Required: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function executeSQLStatements() {
  console.log('🚀 Starting migration: 12_missing_columns_and_fixes.sql');
  
  const statements = [
    // 1. Add auto_recovery column to services table
    {
      name: 'Add auto_recovery to services',
      sql: `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT false NOT NULL;`
    },
    {
      name: 'Add comment for auto_recovery',
      sql: `COMMENT ON COLUMN public.services.auto_recovery IS 'Whether the service should automatically recover from incidents when monitoring checks pass';`
    },
    
    // 2. Add created_by column to on_call_schedules if missing
    {
      name: 'Add created_by to on_call_schedules',
      sql: `ALTER TABLE public.on_call_schedules ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);`
    },
    {
      name: 'Add comment for created_by',
      sql: `COMMENT ON COLUMN public.on_call_schedules.created_by IS 'User who created this on-call schedule';`
    },
    
    // 3. Add profile completion tracking to users
    {
      name: 'Add profile completion fields to users',
      sql: `ALTER TABLE public.users 
            ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false NOT NULL,
            ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0 NOT NULL CHECK (profile_completion_percentage >= 0 AND profile_completion_percentage <= 100);`
    },
    {
      name: 'Add comments for profile fields',
      sql: `COMMENT ON COLUMN public.users.profile_completed IS 'Whether user has completed their profile setup';
            COMMENT ON COLUMN public.users.profile_completion_percentage IS 'Percentage of profile completion (0-100)';`
    },
    
    // 4. Add invitation status to organization_members
    {
      name: 'Add invitation fields to organization_members',
      sql: `ALTER TABLE public.organization_members 
            ADD COLUMN IF NOT EXISTS invitation_email VARCHAR(255),
            ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (invitation_status IN ('pending', 'accepted', 'expired', 'cancelled'));`
    },
    {
      name: 'Add comments for invitation fields',
      sql: `COMMENT ON COLUMN public.organization_members.invitation_email IS 'Email address for pending invitations (before user signup)';
            COMMENT ON COLUMN public.organization_members.invitation_status IS 'Status of the invitation: pending, accepted, expired, cancelled';`
    },
    
    // 5. Add public access and SEO fields to status_pages
    {
      name: 'Add public access and SEO fields to status_pages',
      sql: `ALTER TABLE public.status_pages 
            ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL,
            ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
            ADD COLUMN IF NOT EXISTS seo_description TEXT,
            ADD COLUMN IF NOT EXISTS custom_css TEXT,
            ADD COLUMN IF NOT EXISTS favicon_url TEXT;`
    },
    {
      name: 'Add comments for status page fields',
      sql: `COMMENT ON COLUMN public.status_pages.is_public IS 'Whether the status page is publicly accessible';
            COMMENT ON COLUMN public.status_pages.seo_title IS 'Custom SEO title for the status page';
            COMMENT ON COLUMN public.status_pages.seo_description IS 'Custom SEO description for the status page';
            COMMENT ON COLUMN public.status_pages.custom_css IS 'Custom CSS for status page branding';
            COMMENT ON COLUMN public.status_pages.favicon_url IS 'Custom favicon URL for the status page';`
    },
    
    // 6. Add unsubscribe functionality to subscriptions
    {
      name: 'Add unsubscribe functionality to subscriptions',
      sql: `ALTER TABLE public.subscriptions 
            ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255) UNIQUE,
            ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
            ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false}' NOT NULL;`
    },
    {
      name: 'Add comments for subscription fields',
      sql: `COMMENT ON COLUMN public.subscriptions.unsubscribe_token IS 'Unique token for unsubscribe links';
            COMMENT ON COLUMN public.subscriptions.unsubscribed_at IS 'When the subscription was unsubscribed';
            COMMENT ON COLUMN public.subscriptions.notification_preferences IS 'User preferences for different notification types';`
    }
  ];

  const results = [];
  let successCount = 0;

  for (const statement of statements) {
    try {
      console.log(`📝 Executing: ${statement.name}`);
      
      const { data, error } = await supabase.rpc('exec', {
        sql: statement.sql
      });

      if (error) {
        console.log(`⚠️  ${statement.name}: ${error.message}`);
        results.push({
          name: statement.name,
          success: false,
          error: error.message,
          sql: statement.sql
        });
      } else {
        console.log(`✅ ${statement.name}: Success`);
        results.push({
          name: statement.name,
          success: true
        });
        successCount++;
      }
    } catch (e) {
      console.log(`❌ ${statement.name}: ${e.message}`);
      results.push({
        name: statement.name,
        success: false,
        error: e.message,
        sql: statement.sql
      });
    }
  }

  console.log(`\n📊 Migration Summary:`);
  console.log(`✅ Successful: ${successCount}/${statements.length}`);
  console.log(`❌ Failed: ${statements.length - successCount}/${statements.length}`);

  if (successCount < statements.length) {
    console.log(`\n⚠️  Some statements failed. You may need to run them manually in Supabase SQL Editor:`);
    results.filter(r => !r.success).forEach(r => {
      console.log(`\n-- ${r.name}`);
      console.log(r.sql);
    });
  }

  return results;
}

// Execute migration
executeSQLStatements()
  .then((results) => {
    console.log('\n🎉 Migration execution completed!');
    console.log('Next: Run the test endpoint to verify: /api/test-migration-status');
  })
  .catch((error) => {
    console.error('💥 Migration failed:', error);
    process.exit(1);
  });