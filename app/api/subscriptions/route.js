import { NextResponse } from 'next/server';
import { auth } from '@/auth';
import { SupabaseClient } from '../../../lib/db-supabase.js';
import { emailService } from '../../../lib/email-service.js';

const db = new SupabaseClient();

export const runtime = 'edge';

export async function POST(req) {
  try {
    const body = await req.json();
    const { status_page_id, email } = body;

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
    const statusPage = await db.getStatusPageById(status_page_id);

    if (!statusPage) {
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
    const existingSubscription = await db.getSubscription(
      status_page_id,
      email
    );

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

    // Create subscription
    const subscription = await db.createSubscription({
      status_page_id,
      email,
      unsubscribe_token: unsubscribeToken,
      subscribed_at: new Date().toISOString(),
      is_active: true,
    });

    return NextResponse.json({
      success: true,
      message: 'Successfully subscribed to status page updates',
      subscription_id: subscription.id,
      unsubscribe_token: unsubscribeToken,
    });
  } catch (error) {
    console.error('Error creating subscription:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to create subscription',
        details: error.message,
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
    const unsubscribed = await db.unsubscribeByToken(token);

    if (!unsubscribed) {
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
    console.error('Error unsubscribing:', error);
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
