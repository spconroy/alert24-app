import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import { emailService } from '@/lib/email-service';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(req) {
  try {
    const body = await req.json();
    const { status_page_id, email } = body;

    console.log('📧 Subscription request:', { status_page_id, email });

    if (!status_page_id || !email) {
      return NextResponse.json(
        { error: 'Missing status_page_id or email' },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      );
    }

    // Check if status page exists and is public
    console.log('🔍 Checking status page:', status_page_id);
    const { data: statusPage, error: statusPageError } = await db.client
      .from('status_pages')
      .select('id, name, is_public')
      .eq('id', status_page_id)
      .single();

    if (statusPageError || !statusPage) {
      console.error('❌ Status page not found:', statusPageError);
      return NextResponse.json(
        { error: 'Status page not found' },
        { status: 404 }
      );
    }

    if (!statusPage.is_public) {
      return NextResponse.json(
        { error: 'Cannot subscribe to private status page' },
        { status: 403 }
      );
    }

    // Check if subscription already exists
    console.log('🔍 Checking existing subscription');
    const { data: existingSubscription, error: existingError } = await db.client
      .from('subscriptions')
      .select('id')
      .eq('status_page_id', status_page_id)
      .eq('email', email)
      .maybeSingle();

    if (existingError && existingError.code !== 'PGRST116') {
      console.error('❌ Error checking existing subscription:', existingError);
      return NextResponse.json(
        {
          error: 'Database error checking subscription',
          details: existingError.message,
        },
        { status: 500 }
      );
    }

    if (existingSubscription) {
      return NextResponse.json(
        { error: 'Email is already subscribed to this status page' },
        { status: 409 }
      );
    }

    // Generate unsubscribe token using Web Crypto API
    const tokenBuffer = new Uint8Array(32);
    crypto.getRandomValues(tokenBuffer);
    const unsubscribeToken = Array.from(tokenBuffer)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Create subscription with all required fields
    console.log('✅ Creating subscription');
    const subscriptionData = {
      status_page_id,
      email: email.toLowerCase().trim(),
      unsubscribe_token: unsubscribeToken,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const { data: subscription, error: createError } = await db.client
      .from('subscriptions')
      .insert(subscriptionData)
      .select()
      .single();

    if (createError) {
      console.error('❌ Error creating subscription:', createError);
      return NextResponse.json(
        {
          success: false,
          error: 'Failed to create subscription',
          details: createError.message,
          code: createError.code,
          hint: createError.hint,
        },
        { status: 500 }
      );
    }

    console.log('✅ Subscription created successfully:', subscription.id);

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to status page updates',
      subscription_id: subscription.id,
      unsubscribe_token: unsubscribeToken,
      status_page_name: statusPage.name,
    });
  } catch (error) {
    console.error('❌ Subscription API error:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription',
        details: error.message,
        stack: error.stack,
      },
      { status: 500 }
    );
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const token = searchParams.get('token');

    if (!token) {
      return NextResponse.json(
        { error: 'Unsubscribe token is required' },
        { status: 400 }
      );
    }

    // Unsubscribe using token
    const { data: unsubscribed, error } = await db.client
      .from('subscriptions')
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq('unsubscribe_token', token)
      .select()
      .single();

    if (error || !unsubscribed) {
      return NextResponse.json(
        { error: 'Invalid unsubscribe token' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Successfully unsubscribed from status page updates',
    });
  } catch (error) {
    console.error('❌ Error unsubscribing:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to unsubscribe',
        details: error.message,
      },
      { status: 500 }
    );
  }
}
