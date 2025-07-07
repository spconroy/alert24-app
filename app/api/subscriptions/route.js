export const runtime = 'edge';

import { Pool } from 'pg';

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

export async function POST(req) {
  try {
    const body = await req.json();
    const { status_page_id, email } = body;

    if (!status_page_id || !email) {
      return new Response(
        JSON.stringify({ error: 'Missing status_page_id or email' }),
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return new Response(JSON.stringify({ error: 'Invalid email format' }), {
        status: 400,
      });
    }

    // Check if status page exists and is public
    const statusPageQuery = `
      SELECT id, name, is_public 
      FROM public.status_pages 
      WHERE id = $1 AND deleted_at IS NULL
    `;
    const { rows: statusPages } = await pool.query(statusPageQuery, [
      status_page_id,
    ]);

    if (statusPages.length === 0) {
      return new Response(JSON.stringify({ error: 'Status page not found' }), {
        status: 404,
      });
    }

    const statusPage = statusPages[0];
    if (!statusPage.is_public) {
      return new Response(
        JSON.stringify({ error: 'Cannot subscribe to private status page' }),
        { status: 403 }
      );
    }

    // Check if subscription already exists
    const existingSubscriptionQuery = `
      SELECT id FROM public.subscriptions 
      WHERE status_page_id = $1 AND email = $2 AND deleted_at IS NULL
    `;
    const { rows: existingSubscriptions } = await pool.query(
      existingSubscriptionQuery,
      [status_page_id, email]
    );

    if (existingSubscriptions.length > 0) {
      return new Response(
        JSON.stringify({
          message: 'Already subscribed',
          subscription_id: existingSubscriptions[0].id,
        }),
        { status: 200 }
      );
    }

    // Create new subscription
    const insertSubscriptionQuery = `
      INSERT INTO public.subscriptions (status_page_id, email, is_active, created_at, updated_at)
      VALUES ($1, $2, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
      RETURNING id, email, created_at
    `;

    const { rows: newSubscriptions } = await pool.query(
      insertSubscriptionQuery,
      [status_page_id, email]
    );
    const subscription = newSubscriptions[0];

    return new Response(
      JSON.stringify({
        message: 'Successfully subscribed',
        subscription: {
          id: subscription.id,
          email: subscription.email,
          status_page_name: statusPage.name,
          created_at: subscription.created_at,
        },
      }),
      { status: 201 }
    );
  } catch (err) {
    console.error('Subscription POST error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}

export async function DELETE(req) {
  try {
    const { searchParams } = new URL(req.url);
    const subscriptionId = searchParams.get('id');
    const email = searchParams.get('email');
    const statusPageId = searchParams.get('status_page_id');

    if (!subscriptionId && (!email || !statusPageId)) {
      return new Response(
        JSON.stringify({
          error: 'Missing subscription ID or email/status_page_id combination',
        }),
        { status: 400 }
      );
    }

    let unsubscribeQuery;
    let queryParams;

    if (subscriptionId) {
      unsubscribeQuery = `
        UPDATE public.subscriptions 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE id = $1 AND deleted_at IS NULL
        RETURNING id, email
      `;
      queryParams = [subscriptionId];
    } else {
      unsubscribeQuery = `
        UPDATE public.subscriptions 
        SET deleted_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
        WHERE status_page_id = $1 AND email = $2 AND deleted_at IS NULL
        RETURNING id, email
      `;
      queryParams = [statusPageId, email];
    }

    const { rows: unsubscribed } = await pool.query(
      unsubscribeQuery,
      queryParams
    );

    if (unsubscribed.length === 0) {
      return new Response(JSON.stringify({ error: 'Subscription not found' }), {
        status: 404,
      });
    }

    return new Response(
      JSON.stringify({
        message: 'Successfully unsubscribed',
        email: unsubscribed[0].email,
      }),
      { status: 200 }
    );
  } catch (err) {
    console.error('Subscription DELETE error:', err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
    });
  }
}
