import { NextResponse } from 'next/server';
import { SupabaseClient } from '@/lib/db-supabase';
import Stripe from 'stripe';

const db = new SupabaseClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const runtime = 'edge';

// POST /api/billing/webhook - Handle Stripe webhooks
export async function POST(request) {
  try {
    const body = await request.text();
    const signature = request.headers.get('stripe-signature');

    let event;

    try {
      // Verify webhook signature
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (err) {
      console.error('Webhook signature verification failed:', err.message);
      return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    console.log('Received Stripe webhook:', event.type);

    switch (event.type) {
      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;

      case 'customer.subscription.trial_will_end':
        await handleTrialWillEnd(event.data.object);
        break;

      default:
        console.log('Unhandled webhook event type:', event.type);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Webhook error:', error);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}

async function handleSubscriptionCreated(subscription) {
  try {
    // Find organization by customer ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_customer_id', subscription.customer)
      .single();

    if (orgError || !organization) {
      console.error(
        'Organization not found for customer:',
        subscription.customer
      );
      return;
    }

    // Determine plan based on subscription items
    const plan = getPlanFromSubscription(subscription);
    const planLimits = getPlanLimits(plan);

    // Update organization
    const { error: updateError } = await db.client
      .from('organizations')
      .update({
        subscription_plan: plan,
        subscription_status: subscription.status,
        stripe_subscription_id: subscription.id,
        current_period_start: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        ...planLimits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization.id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return;
    }

    // Record billing history
    await recordBillingHistory(organization.id, {
      previous_plan: organization.subscription_plan,
      new_plan: plan,
      change_type: 'upgrade',
      amount_cents: subscription.items.data[0]?.price?.unit_amount || 0,
      stripe_subscription_id: subscription.id,
    });

    console.log(
      `Subscription created for organization ${organization.name}: ${plan}`
    );
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
}

async function handleSubscriptionUpdated(subscription) {
  try {
    // Find organization by subscription ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (orgError || !organization) {
      console.error(
        'Organization not found for subscription:',
        subscription.id
      );
      return;
    }

    const plan = getPlanFromSubscription(subscription);
    const planLimits = getPlanLimits(plan);

    // Update organization
    const { error: updateError } = await db.client
      .from('organizations')
      .update({
        subscription_plan: plan,
        subscription_status: subscription.status,
        current_period_start: new Date(
          subscription.current_period_start * 1000
        ).toISOString(),
        current_period_end: new Date(
          subscription.current_period_end * 1000
        ).toISOString(),
        ...planLimits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization.id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return;
    }

    // Record billing history if plan changed
    if (organization.subscription_plan !== plan) {
      await recordBillingHistory(organization.id, {
        previous_plan: organization.subscription_plan,
        new_plan: plan,
        change_type:
          organization.subscription_plan === 'free'
            ? 'upgrade'
            : plan === 'free'
              ? 'downgrade'
              : 'upgrade',
        amount_cents: subscription.items.data[0]?.price?.unit_amount || 0,
        stripe_subscription_id: subscription.id,
      });
    }

    console.log(
      `Subscription updated for organization ${organization.name}: ${plan}`
    );
  } catch (error) {
    console.error('Error handling subscription updated:', error);
  }
}

async function handleSubscriptionDeleted(subscription) {
  try {
    // Find organization by subscription ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (orgError || !organization) {
      console.error(
        'Organization not found for subscription:',
        subscription.id
      );
      return;
    }

    // Downgrade to free plan
    const freePlanLimits = getPlanLimits('free');

    const { error: updateError } = await db.client
      .from('organizations')
      .update({
        subscription_plan: 'free',
        subscription_status: 'canceled',
        stripe_subscription_id: null,
        current_period_start: null,
        current_period_end: null,
        ...freePlanLimits,
        updated_at: new Date().toISOString(),
      })
      .eq('id', organization.id);

    if (updateError) {
      console.error('Error updating organization:', updateError);
      return;
    }

    // Record billing history
    await recordBillingHistory(organization.id, {
      previous_plan: organization.subscription_plan,
      new_plan: 'free',
      change_type: 'cancellation',
      stripe_subscription_id: subscription.id,
    });

    // Create billing alert
    await createBillingAlert(organization.id, {
      alert_type: 'plan_changed',
      severity: 'warning',
      title: 'Subscription Canceled',
      message:
        'Your subscription has been canceled and your account has been downgraded to the free plan.',
    });

    console.log(`Subscription canceled for organization ${organization.name}`);
  } catch (error) {
    console.error('Error handling subscription deleted:', error);
  }
}

async function handlePaymentSucceeded(invoice) {
  try {
    // Find organization by customer ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (orgError || !organization) {
      console.error('Organization not found for customer:', invoice.customer);
      return;
    }

    // Record billing history
    await recordBillingHistory(organization.id, {
      previous_plan: organization.subscription_plan,
      new_plan: organization.subscription_plan,
      change_type: 'renewal',
      amount_cents: invoice.amount_paid,
      stripe_subscription_id: invoice.subscription,
      stripe_invoice_id: invoice.id,
    });

    console.log(
      `Payment succeeded for organization ${organization.name}: $${invoice.amount_paid / 100}`
    );
  } catch (error) {
    console.error('Error handling payment succeeded:', error);
  }
}

async function handlePaymentFailed(invoice) {
  try {
    // Find organization by customer ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_customer_id', invoice.customer)
      .single();

    if (orgError || !organization) {
      console.error('Organization not found for customer:', invoice.customer);
      return;
    }

    // Create billing alert
    await createBillingAlert(organization.id, {
      alert_type: 'payment_failed',
      severity: 'error',
      title: 'Payment Failed',
      message: `Payment of $${invoice.amount_due / 100} failed. Please update your payment method to avoid service interruption.`,
    });

    console.log(
      `Payment failed for organization ${organization.name}: $${invoice.amount_due / 100}`
    );
  } catch (error) {
    console.error('Error handling payment failed:', error);
  }
}

async function handleTrialWillEnd(subscription) {
  try {
    // Find organization by subscription ID
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('stripe_subscription_id', subscription.id)
      .single();

    if (orgError || !organization) {
      console.error(
        'Organization not found for subscription:',
        subscription.id
      );
      return;
    }

    // Create billing alert
    await createBillingAlert(organization.id, {
      alert_type: 'trial_ending',
      severity: 'warning',
      title: 'Trial Ending Soon',
      message:
        'Your trial will end soon. Please add a payment method to continue using premium features.',
    });

    console.log(`Trial ending for organization ${organization.name}`);
  } catch (error) {
    console.error('Error handling trial will end:', error);
  }
}

function getPlanFromSubscription(subscription) {
  // Extract plan from subscription items
  // This would depend on your Stripe price IDs
  const priceId = subscription.items.data[0]?.price?.id;

  if (priceId === process.env.STRIPE_PRO_PRICE_ID) {
    return 'pro';
  } else if (priceId === process.env.STRIPE_ENTERPRISE_PRICE_ID) {
    return 'enterprise';
  }

  return 'free';
}

function getPlanLimits(plan) {
  const limits = {
    free: {
      max_team_members: 3,
      max_projects: 5,
      max_monitoring_checks: 5,
      max_status_pages: 1,
    },
    pro: {
      max_team_members: 15,
      max_projects: 25,
      max_monitoring_checks: 50,
      max_status_pages: 5,
    },
    enterprise: {
      max_team_members: 999,
      max_projects: 999,
      max_monitoring_checks: 999,
      max_status_pages: 999,
    },
  };

  return limits[plan] || limits.free;
}

async function recordBillingHistory(organizationId, data) {
  try {
    const { error } = await db.client.from('billing_history').insert({
      organization_id: organizationId,
      ...data,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error recording billing history:', error);
    }
  } catch (error) {
    console.error('Error recording billing history:', error);
  }
}

async function createBillingAlert(organizationId, data) {
  try {
    const { error } = await db.client.from('billing_alerts').insert({
      organization_id: organizationId,
      ...data,
      created_at: new Date().toISOString(),
    });

    if (error) {
      console.error('Error creating billing alert:', error);
    }
  } catch (error) {
    console.error('Error creating billing alert:', error);
  }
}
