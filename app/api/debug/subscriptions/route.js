import { SupabaseClient } from '@/lib/db-supabase';

export const runtime = 'edge';

export async function GET() {
  try {
    const db = new SupabaseClient();

    // Check subscriptions table schema
    const schemaCheck = await db.client
      .from('information_schema.columns')
      .select('column_name, data_type, is_nullable, column_default')
      .eq('table_name', 'subscriptions')
      .eq('table_schema', 'public')
      .order('ordinal_position');

    // Test subscription creation with mock data
    let subscriptionTest = null;
    try {
      const testData = {
        status_page_id: '00000000-0000-0000-0000-000000000000', // Mock UUID
        email: 'test@example.com',
        unsubscribe_token: 'test-token-' + Date.now(),
        is_active: true,
      };

      // This should fail gracefully if status_page doesn't exist
      subscriptionTest = await db.client
        .from('subscriptions')
        .insert(testData)
        .select()
        .single();
    } catch (testError) {
      subscriptionTest = { error: testError.message };
    }

    // Check if we have any status pages to test with
    const statusPages = await db.client
      .from('status_pages')
      .select('id, name')
      .limit(5);

    return Response.json({
      timestamp: new Date().toISOString(),
      subscriptionsSchema: schemaCheck.data,
      subscriptionTestResult: subscriptionTest,
      availableStatusPages: statusPages.data,
      recommendations: [
        'Ensure subscriptions table has all required columns',
        'Check if unsubscribe_token column exists and is unique',
        'Verify status_page_id references exist',
        'Test with a real status page ID from availableStatusPages',
      ],
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const db = new SupabaseClient();

    // Add missing columns to subscriptions table if they don't exist
    const alterTableCommands = [
      'ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255) UNIQUE',
      'ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true',
      'ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
      'ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
    ];

    const results = [];
    for (const command of alterTableCommands) {
      try {
        await db.client.rpc('exec_sql', { sql: command });
        results.push({ command, status: 'success' });
      } catch (error) {
        results.push({ command, status: 'error', error: error.message });
      }
    }

    return Response.json({
      message: 'Attempted to fix subscriptions table schema',
      results,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    return Response.json(
      {
        error: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}
