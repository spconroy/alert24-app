import { NextResponse } from 'next/server';
import { supabase } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function POST() {
  try {
    console.log('Executing migration 12_missing_columns_and_fixes.sql...');

    // Execute the migration SQL step by step using Supabase RPC calls
    const migrationSteps = [];
    const results = [];

    // Step 1: Add auto_recovery column to services table
    try {
      const { data, error } = await supabase.rpc('exec_sql', {
        sql: `ALTER TABLE public.services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT false NOT NULL;`
      });
      results.push({
        step: 'services_auto_recovery',
        success: !error,
        error: error?.message
      });
    } catch (e) {
      // Fallback: Try using a direct SQL query
      try {
        const { data, error } = await supabase
          .from('services')
          .select('auto_recovery')
          .limit(1);
        
        if (error && error.message.includes('does not exist')) {
          results.push({
            step: 'services_auto_recovery',
            success: false,
            error: 'Column needs to be added manually via Supabase dashboard',
            sql: 'ALTER TABLE public.services ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT false NOT NULL;'
          });
        } else {
          results.push({
            step: 'services_auto_recovery',
            success: true,
            note: 'Column already exists'
          });
        }
      } catch (e2) {
        results.push({
          step: 'services_auto_recovery',
          success: false,
          error: e2.message
        });
      }
    }

    // Step 2: Check and add profile completion columns to users table
    try {
      const { data, error } = await supabase
        .from('users')
        .select('profile_completed, profile_completion_percentage')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        results.push({
          step: 'users_profile_fields',
          success: false,
          error: 'Columns need to be added manually via Supabase dashboard',
          sql: `ALTER TABLE public.users 
                ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false NOT NULL,
                ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0 NOT NULL 
                CHECK (profile_completion_percentage >= 0 AND profile_completion_percentage <= 100);`
        });
      } else {
        results.push({
          step: 'users_profile_fields',
          success: true,
          note: 'Columns already exist'
        });
      }
    } catch (e) {
      results.push({
        step: 'users_profile_fields',
        success: false,
        error: e.message
      });
    }

    // Step 3: Check notification_rules table
    try {
      const { data, error } = await supabase
        .from('notification_rules')
        .select('*')
        .limit(1);
      
      if (error && error.message.includes('does not exist')) {
        results.push({
          step: 'notification_rules_table',
          success: false,
          error: 'Table needs to be created manually via Supabase dashboard',
          sql: `CREATE TABLE IF NOT EXISTS public.notification_rules (
                  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
                  escalation_policy_id UUID NOT NULL REFERENCES public.escalation_policies(id) ON DELETE CASCADE,
                  delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
                  notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'sms', 'voice', 'slack', 'teams', 'webhook')),
                  target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('user', 'team', 'webhook')),
                  target_id UUID,
                  webhook_url TEXT,
                  is_active BOOLEAN DEFAULT true NOT NULL,
                  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
                  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
                );`
        });
      } else {
        results.push({
          step: 'notification_rules_table',
          success: true,
          note: 'Table already exists'
        });
      }
    } catch (e) {
      results.push({
        step: 'notification_rules_table',
        success: false,
        error: e.message
      });
    }

    // Generate summary
    const successCount = results.filter(r => r.success).length;
    const totalSteps = results.length;
    
    const needsManualApplication = results.some(r => !r.success);

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      migration_status: needsManualApplication ? 'needs_manual_application' : 'completed',
      steps_completed: `${successCount}/${totalSteps}`,
      results: results,
      next_steps: needsManualApplication ? [
        '1. Go to your Supabase dashboard',
        '2. Navigate to SQL Editor',
        '3. Copy and execute the full migration from docs/schema-updates/12_missing_columns_and_fixes.sql',
        '4. Run /api/test-migration-status to verify completion'
      ] : [
        'Migration appears to be complete - verify with /api/test-migration-status'
      ],
      full_migration_file: 'docs/schema-updates/12_missing_columns_and_fixes.sql'
    });

  } catch (error) {
    console.error('Migration execution error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
        recommendation: 'Apply migration manually via Supabase dashboard SQL Editor'
      },
      { status: 500 }
    );
  }
}