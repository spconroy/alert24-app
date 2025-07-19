// Test script to debug Stripe status page check creation
import { SupabaseClient } from './lib/db-supabase.js';

const db = new SupabaseClient();

async function testStripeCheck() {
  try {
    // Simulate the data that would be sent to the API
    const checkData = {
      name: 'Test Stripe API Check',
      check_type: 'status_page',
      target_url: 'https://status.stripe.com/',
      organization_id: '00000000-0000-0000-0000-000000000000', // Use a valid UUID format
      check_interval_seconds: 300,
      timeout_seconds: 30,
      linked_service_id: null,
      status_page_config: {
        provider: 'stripe',
        service: 'stripe-api',
        regions: ['global'],
        failure_behavior: 'match_status',
        failure_message: '',
      },
      created_by: '00000000-0000-0000-0000-000000000000', // Use a valid UUID format
      is_active: true,
    };

    console.log(
      'Testing Stripe check creation with data:',
      JSON.stringify(checkData, null, 2)
    );

    const result = await db.createMonitoringCheck(checkData);
    console.log('✅ Success! Created check:', result);
  } catch (error) {
    console.error('❌ Error creating check:', error);
    console.error('Error details:', {
      message: error.message,
      code: error.code,
      details: error.details,
      hint: error.hint,
    });
  }
}

testStripeCheck();
