import { NextResponse } from 'next/server';
import { SessionManager } from '@/lib/session-manager';
import { SupabaseClient } from '@/lib/db-supabase';
import Stripe from 'stripe';

const db = new SupabaseClient();
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const runtime = 'edge';

// Plan configurations
const PLANS = {
  free: {
    name: 'Free',
    price: 0,
    stripe_price_id: null,
    limits: {
      max_team_members: 3,
      max_projects: 5,
      max_monitoring_checks: 5,
      max_status_pages: 1,
    },
  },
  pro: {
    name: 'Pro',
    price: 29,
    stripe_price_id: process.env.STRIPE_PRO_PRICE_ID,
    limits: {
      max_team_members: 15,
      max_projects: 25,
      max_monitoring_checks: 50,
      max_status_pages: 5,
    },
  },
  enterprise: {
    name: 'Enterprise',
    price: 99,
    stripe_price_id: process.env.STRIPE_ENTERPRISE_PRICE_ID,
    limits: {
      max_team_members: 999,
      max_projects: 999,
      max_monitoring_checks: 999,
      max_status_pages: 999,
    },
  },
};

// POST /api/billing/upgrade - Upgrade or downgrade plan
export async function POST(request) {
  try {
    const sessionManager = new SessionManager();
    const session = await sessionManager.getSessionFromRequest(request);
    if (!session || !session.user?.email) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { organization_id, plan_id } = await request.json();

    if (!organization_id || !plan_id) {
      return NextResponse.json(
        { error: 'Organization ID and plan ID are required' },
        { status: 400 }
      );
    }

    if (!PLANS[plan_id]) {
      return NextResponse.json(
        { error: 'Invalid plan ID' },
        { status: 400 }
      );
    }

    // Get user
    const user = await db.getUserByEmail(session.user.email);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Check if user is owner or admin of the organization
    const membership = await db.getOrganizationMember(organization_id, user.id);
    if (!membership || !['owner', 'admin'].includes(membership.role)) {
      return NextResponse.json(
        { error: 'Access denied - insufficient permissions' },
        { status: 403 }
      );
    }

    // Get current organization
    const { data: organization, error: orgError } = await db.client
      .from('organizations')
      .select('*')
      .eq('id', organization_id)
      .single();

    if (orgError || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      );
    }

    const newPlan = PLANS[plan_id];
    const currentPlan = organization.subscription_plan;

    // Handle downgrade to free plan
    if (plan_id === 'free') {
      // Check if current usage exceeds free plan limits
      const [teamMembersCount, monitoringChecksCount, statusPagesCount] =
        await Promise.all([
          db.client
            .from('organization_members')
            .select('id', { count: 'exact' })
            .eq('organization_id', organization_id)
            .eq('is_active', true),
          db.client
            .from('monitoring_checks')
            .select('id', { count: 'exact' })
            .eq('organization_id', organization_id)
            .eq('status', 'active'),
          db.client
            .from('status_pages')
            .select('id', { count: 'exact' })
            .eq('organization_id', organization_id)
            .is('deleted_at', null),
        ]);

      // Check if current usage exceeds free plan limits
      const usageExceeds = [];
      if (teamMembersCount.count > newPlan.limits.max_team_members) {
        usageExceeds.push(
          `Team members (${teamMembersCount.count} > ${newPlan.limits.max_team_members})`
        );
      }
      if (monitoringChecksCount.count > newPlan.limits.max_monitoring_checks) {
        usageExceeds.push(
          `Monitoring checks (${monitoringChecksCount.count} > ${newPlan.limits.max_monitoring_checks})`
        );
      }
      if (statusPagesCount.count > newPlan.limits.max_status_pages) {
        usageExceeds.push(
          `Status pages (${statusPagesCount.count} > ${newPlan.limits.max_status_pages})`
        );
      }

      if (usageExceeds.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot downgrade to free plan',
            details: `Current usage exceeds free plan limits: ${usageExceeds.join(', ')}`,
            usage_exceeds: usageExceeds,
          },
          { status: 400 }
        );
      }

      // Update organization to free plan
      const { error: updateError } = await db.client
        .from('organizations')
        .update({
          subscription_plan: 'free',
          subscription_status: 'active',
          stripe_customer_id: null,
          stripe_subscription_id: null,
          current_period_start: null,
          current_period_end: null,
          max_team_members: newPlan.limits.max_team_members,
          max_projects: newPlan.limits.max_projects,
          updated_at: new Date().toISOString(),
        })
        .eq('id', organization_id);

      if (updateError) {
        throw updateError;
      }

      return NextResponse.json({
        success: true,
        message: 'Successfully downgraded to free plan',
        plan: newPlan,
      });
    }

    // For paid plans, integrate with Stripe
    if (plan_id === 'pro' || plan_id === 'enterprise') {
      try {
        // Create or get Stripe customer
        let stripeCustomerId = organization.stripe_customer_id;
        
        if (!stripeCustomerId) {
          const customer = await stripe.customers.create({
            email: user.email,
            name: organization.name,
            metadata: {
              organization_id: organization_id,
            },
          });
          stripeCustomerId = customer.id;
          
          // Update organization with customer ID
          await db.client
            .from('organizations')
            .update({ stripe_customer_id: stripeCustomerId })
            .eq('id', organization_id);
        }
        
        // Create Stripe checkout session
        const session = await stripe.checkout.sessions.create({
          customer: stripeCustomerId,
          payment_method_types: ['card'],
          line_items: [
            {
              price: newPlan.stripe_price_id,
              quantity: 1,
            },
          ],
          mode: 'subscription',
          success_url: `${request.headers.get('origin')}/billing?session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${request.headers.get('origin')}/billing?canceled=true`,
          metadata: {
            organization_id: organization_id,
            plan_id: plan_id,
          },
        });
        
        return NextResponse.json({
          success: true,
          checkout_url: session.url,
          message: 'Redirecting to Stripe checkout...',
        });
      } catch (stripeError) {
        console.error('Stripe error:', stripeError);
        return NextResponse.json(
          { error: 'Failed to create checkout session', details: stripeError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json(
      { error: 'Invalid plan upgrade request' },
      { status: 400 }
    );
  } catch (error) {
    console.error('Error upgrading plan:', error);
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to upgrade plan',
        details: error.message,
      },
      { status: 500 }
    );
  }
}