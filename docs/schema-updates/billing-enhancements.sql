-- Billing Enhancements for Alert24
-- This file contains additional billing-related schema updates

-- Add billing history table to track subscription changes
CREATE TABLE IF NOT EXISTS billing_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Plan change details
    previous_plan VARCHAR(50),
    new_plan VARCHAR(50) NOT NULL,
    change_type VARCHAR(20) NOT NULL CHECK (change_type IN ('upgrade', 'downgrade', 'renewal', 'cancellation')),
    
    -- Billing details
    amount_cents INTEGER, -- Price in cents
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Stripe details
    stripe_event_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    stripe_invoice_id VARCHAR(255),
    
    -- Metadata
    changed_by UUID REFERENCES users(id),
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add usage tracking table for monitoring plan limits
CREATE TABLE IF NOT EXISTS usage_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Date tracking
    date DATE NOT NULL,
    
    -- Usage metrics
    team_members_count INTEGER DEFAULT 0,
    monitoring_checks_count INTEGER DEFAULT 0,
    incidents_count INTEGER DEFAULT 0,
    status_pages_count INTEGER DEFAULT 0,
    api_calls_count INTEGER DEFAULT 0,
    
    -- Computed at end of day
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, date)
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_billing_history_organization_id ON billing_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_history_created_at ON billing_history(created_at);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_organization_id ON usage_tracking(organization_id);
CREATE INDEX IF NOT EXISTS idx_usage_tracking_date ON usage_tracking(date);

-- Add feature flags table for plan-specific features
CREATE TABLE IF NOT EXISTS feature_flags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Feature details
    feature_name VARCHAR(100) NOT NULL,
    is_enabled BOOLEAN DEFAULT false,
    
    -- Plan-based enablement
    enabled_for_plans TEXT[] DEFAULT ARRAY['enterprise'], -- Array of plan names
    
    -- Override settings
    override_enabled BOOLEAN, -- Manual override
    override_reason TEXT,
    override_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, feature_name)
);

-- Add payment methods table
CREATE TABLE IF NOT EXISTS payment_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Stripe details
    stripe_payment_method_id VARCHAR(255) NOT NULL,
    stripe_customer_id VARCHAR(255) NOT NULL,
    
    -- Payment method details
    type VARCHAR(50) NOT NULL, -- 'card', 'bank_account', etc.
    brand VARCHAR(50), -- 'visa', 'mastercard', etc.
    last_four VARCHAR(4),
    exp_month INTEGER,
    exp_year INTEGER,
    
    -- Status
    is_default BOOLEAN DEFAULT false,
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add billing alerts table
CREATE TABLE IF NOT EXISTS billing_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL CHECK (alert_type IN ('usage_limit', 'payment_failed', 'trial_ending', 'plan_changed')),
    severity VARCHAR(20) NOT NULL CHECK (severity IN ('info', 'warning', 'error')),
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    
    -- Alert status
    is_acknowledged BOOLEAN DEFAULT false,
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for feature flags and payment methods
CREATE INDEX IF NOT EXISTS idx_feature_flags_organization_id ON feature_flags(organization_id);
CREATE INDEX IF NOT EXISTS idx_payment_methods_organization_id ON payment_methods(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_organization_id ON billing_alerts(organization_id);
CREATE INDEX IF NOT EXISTS idx_billing_alerts_created_at ON billing_alerts(created_at);

-- Add some default feature flags for common features
-- These will be inserted per organization when needed, so we'll skip this for now
-- INSERT INTO feature_flags (organization_id, feature_name, enabled_for_plans) VALUES
-- ('uuid', 'custom_branding', ARRAY['pro', 'enterprise']),
-- ('uuid', 'advanced_analytics', ARRAY['pro', 'enterprise']),
-- ('uuid', 'api_access', ARRAY['pro', 'enterprise']),
-- ('uuid', 'custom_domains', ARRAY['enterprise']),
-- ('uuid', 'sla_guarantees', ARRAY['enterprise']),
-- ('uuid', 'on_premise_deployment', ARRAY['enterprise'])
-- ON CONFLICT (organization_id, feature_name) DO NOTHING;

-- Add function to check if a feature is enabled for an organization
CREATE OR REPLACE FUNCTION is_feature_enabled(org_id UUID, feature_name TEXT)
RETURNS BOOLEAN AS $$
DECLARE
    org_plan TEXT;
    feature_enabled BOOLEAN;
    override_enabled BOOLEAN;
    override_expires TIMESTAMP WITH TIME ZONE;
BEGIN
    -- Get organization plan
    SELECT subscription_plan INTO org_plan 
    FROM organizations 
    WHERE id = org_id;
    
    -- Get feature flag settings
    SELECT 
        is_enabled, 
        override_enabled, 
        override_expires_at 
    INTO feature_enabled, override_enabled, override_expires
    FROM feature_flags 
    WHERE organization_id = org_id AND feature_flags.feature_name = is_feature_enabled.feature_name;
    
    -- Check if override is active and not expired
    IF override_enabled IS NOT NULL AND (override_expires IS NULL OR override_expires > NOW()) THEN
        RETURN override_enabled;
    END IF;
    
    -- Check if feature is enabled for current plan
    IF feature_enabled IS NOT NULL THEN
        RETURN feature_enabled;
    END IF;
    
    -- Default to checking plan-based enablement
    SELECT COUNT(*) > 0 INTO feature_enabled
    FROM feature_flags 
    WHERE organization_id = org_id 
    AND feature_flags.feature_name = is_feature_enabled.feature_name
    AND org_plan = ANY(enabled_for_plans);
    
    RETURN COALESCE(feature_enabled, FALSE);
END;
$$ LANGUAGE plpgsql;

-- Update organizations table with additional billing fields if they don't exist
DO $$
BEGIN
    -- Add plan limits columns if they don't exist
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'max_monitoring_checks') THEN
        ALTER TABLE organizations ADD COLUMN max_monitoring_checks INTEGER DEFAULT 5;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'max_status_pages') THEN
        ALTER TABLE organizations ADD COLUMN max_status_pages INTEGER DEFAULT 1;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'max_api_calls_per_month') THEN
        ALTER TABLE organizations ADD COLUMN max_api_calls_per_month INTEGER DEFAULT 1000;
    END IF;
    
    -- Add trial information
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'trial_ends_at') THEN
        ALTER TABLE organizations ADD COLUMN trial_ends_at TIMESTAMP WITH TIME ZONE;
    END IF;
    
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'organizations' AND column_name = 'is_trial') THEN
        ALTER TABLE organizations ADD COLUMN is_trial BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create a view for organization billing summary
CREATE OR REPLACE VIEW organization_billing_summary AS
SELECT 
    o.id,
    o.name,
    o.subscription_plan,
    o.subscription_status,
    o.current_period_start,
    o.current_period_end,
    o.is_trial,
    o.trial_ends_at,
    
    -- Current limits
    o.max_team_members,
    o.max_projects,
    o.max_monitoring_checks,
    o.max_status_pages,
    o.max_api_calls_per_month,
    
    -- Current usage (computed from related tables)
    COALESCE(member_count.count, 0) as current_team_members,
    COALESCE(monitoring_count.count, 0) as current_monitoring_checks,
    COALESCE(incident_count.count, 0) as current_active_incidents,
    COALESCE(status_page_count.count, 0) as current_status_pages,
    
    -- Usage percentages
    CASE 
        WHEN o.max_team_members > 0 THEN 
            ROUND((COALESCE(member_count.count, 0)::DECIMAL / o.max_team_members) * 100, 1)
        ELSE 0 
    END as team_members_usage_percent,
    
    CASE 
        WHEN o.max_monitoring_checks > 0 THEN 
            ROUND((COALESCE(monitoring_count.count, 0)::DECIMAL / o.max_monitoring_checks) * 100, 1)
        ELSE 0 
    END as monitoring_checks_usage_percent,
    
    -- Recent billing history
    (
        SELECT json_agg(
            json_build_object(
                'change_type', bh.change_type,
                'previous_plan', bh.previous_plan,
                'new_plan', bh.new_plan,
                'amount_cents', bh.amount_cents,
                'created_at', bh.created_at
            ) ORDER BY bh.created_at DESC
        )
        FROM (
            SELECT change_type, previous_plan, new_plan, amount_cents, created_at
            FROM billing_history 
            WHERE organization_id = o.id 
            ORDER BY created_at DESC 
            LIMIT 5
        ) bh
    ) as recent_billing_history
    
FROM organizations o
LEFT JOIN (
    SELECT organization_id, COUNT(*) as count
    FROM organization_members 
    WHERE is_active = true 
    GROUP BY organization_id
) member_count ON o.id = member_count.organization_id
LEFT JOIN (
    SELECT organization_id, COUNT(*) as count
    FROM monitoring_checks 
    WHERE status = 'active' 
    GROUP BY organization_id
) monitoring_count ON o.id = monitoring_count.organization_id
LEFT JOIN (
    SELECT organization_id, COUNT(*) as count
    FROM incidents 
    WHERE status != 'resolved' 
    GROUP BY organization_id
) incident_count ON o.id = incident_count.organization_id
LEFT JOIN (
    SELECT organization_id, COUNT(*) as count
    FROM status_pages 
    WHERE deleted_at IS NULL 
    GROUP BY organization_id
) status_page_count ON o.id = status_page_count.organization_id
WHERE o.deleted_at IS NULL;