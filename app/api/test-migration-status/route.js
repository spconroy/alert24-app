import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function GET() {
  try {
    console.log('Testing migration status...');

    const migrationChecks = {};

    // Check for auto_recovery column in services table
    try {
      const { data: serviceTest, error: serviceError } = await db.client
        .from('services')
        .select('auto_recovery')
        .limit(1);
      
      migrationChecks.services_auto_recovery = {
        exists: !serviceError,
        error: serviceError?.message
      };
    } catch (e) {
      migrationChecks.services_auto_recovery = {
        exists: false,
        error: e.message
      };
    }

    // Check for profile completion columns in users table
    try {
      const { data: userTest, error: userError } = await db.client
        .from('users')
        .select('profile_completed, profile_completion_percentage')
        .limit(1);
      
      migrationChecks.users_profile_fields = {
        exists: !userError,
        error: userError?.message
      };
    } catch (e) {
      migrationChecks.users_profile_fields = {
        exists: false,
        error: e.message
      };
    }

    // Check for notification_rules table
    try {
      const { data: notificationRulesTest, error: notificationRulesError } = await db.client
        .from('notification_rules')
        .select('*')
        .limit(1);
      
      migrationChecks.notification_rules_table = {
        exists: !notificationRulesError,
        error: notificationRulesError?.message
      };
    } catch (e) {
      migrationChecks.notification_rules_table = {
        exists: false,
        error: e.message
      };
    }

    // Check for notification_history table
    try {
      const { data: notificationHistoryTest, error: notificationHistoryError } = await db.client
        .from('notification_history')
        .select('*')
        .limit(1);
      
      migrationChecks.notification_history_table = {
        exists: !notificationHistoryError,
        error: notificationHistoryError?.message
      };
    } catch (e) {
      migrationChecks.notification_history_table = {
        exists: false,
        error: e.message
      };
    }

    // Check for unsubscribe functionality in subscriptions
    try {
      const { data: subscriptionTest, error: subscriptionError } = await db.client
        .from('subscriptions')
        .select('unsubscribe_token, unsubscribed_at, notification_preferences')
        .limit(1);
      
      migrationChecks.subscriptions_unsubscribe = {
        exists: !subscriptionError,
        error: subscriptionError?.message
      };
    } catch (e) {
      migrationChecks.subscriptions_unsubscribe = {
        exists: false,
        error: e.message
      };
    }

    // Check for status page enhancements
    try {
      const { data: statusPageTest, error: statusPageError } = await db.client
        .from('status_pages')
        .select('is_public, seo_title, seo_description, custom_css, favicon_url')
        .limit(1);
      
      migrationChecks.status_pages_enhancements = {
        exists: !statusPageError,
        error: statusPageError?.message
      };
    } catch (e) {
      migrationChecks.status_pages_enhancements = {
        exists: false,
        error: e.message
      };
    }

    // Check for organization member invitation enhancements
    try {
      const { data: orgMemberTest, error: orgMemberError } = await db.client
        .from('organization_members')
        .select('invitation_email, invitation_status')
        .limit(1);
      
      migrationChecks.organization_members_invitation = {
        exists: !orgMemberError,
        error: orgMemberError?.message
      };
    } catch (e) {
      migrationChecks.organization_members_invitation = {
        exists: false,
        error: e.message
      };
    }

    // Determine overall migration status
    const allChecks = Object.values(migrationChecks);
    const passedChecks = allChecks.filter(check => check.exists).length;
    const totalChecks = allChecks.length;
    
    const migrationStatus = passedChecks === totalChecks ? 'complete' : 
                           passedChecks === 0 ? 'not_started' : 'partial';

    return NextResponse.json({
      success: true,
      timestamp: new Date().toISOString(),
      migration_status: migrationStatus,
      checks_passed: `${passedChecks}/${totalChecks}`,
      migration_checks: migrationChecks,
      recommendation: migrationStatus === 'complete' 
        ? 'Migration 12_missing_columns_and_fixes.sql has been applied successfully'
        : 'Migration 12_missing_columns_and_fixes.sql needs to be applied',
      next_action: migrationStatus === 'complete' 
        ? 'No action needed - proceed with application development'
        : 'Run the migration script: psql <connection_string> -f docs/schema-updates/12_missing_columns_and_fixes.sql'
    });

  } catch (error) {
    console.error('Migration status test error:', error);

    return NextResponse.json(
      {
        success: false,
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}