-- Alert24 Schema Updates - Missing Columns and Critical Fixes
-- Migration: 12_missing_columns_and_fixes.sql
-- Date: 2024-01-20
-- Description: Add missing columns and fix critical schema issues

-- =============================================================================
-- 1. ADD MISSING COLUMNS TO EXISTING TABLES
-- =============================================================================

-- Add auto_recovery column to services table (from todos)
ALTER TABLE public.services 
ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT false NOT NULL;

COMMENT ON COLUMN public.services.auto_recovery IS 'Whether the service should automatically recover from incidents when monitoring checks pass';

-- Add created_by column to on_call_schedules if missing (was reported as missing)
ALTER TABLE public.on_call_schedules 
ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES public.users(id);

COMMENT ON COLUMN public.on_call_schedules.created_by IS 'User who created this on-call schedule';

-- =============================================================================
-- 2. ENHANCE USERS TABLE FOR BETTER PROFILE MANAGEMENT
-- =============================================================================

-- Add profile completion tracking
ALTER TABLE public.users 
ADD COLUMN IF NOT EXISTS profile_completed BOOLEAN DEFAULT false NOT NULL,
ADD COLUMN IF NOT EXISTS profile_completion_percentage INTEGER DEFAULT 0 NOT NULL CHECK (profile_completion_percentage >= 0 AND profile_completion_percentage <= 100);

COMMENT ON COLUMN public.users.profile_completed IS 'Whether user has completed their profile setup';
COMMENT ON COLUMN public.users.profile_completion_percentage IS 'Percentage of profile completion (0-100)';

-- =============================================================================
-- 3. ENHANCE ORGANIZATION_MEMBERS FOR BETTER INVITATION SYSTEM
-- =============================================================================

-- Add invitation status and email for pending invitations
ALTER TABLE public.organization_members 
ADD COLUMN IF NOT EXISTS invitation_email VARCHAR(255),
ADD COLUMN IF NOT EXISTS invitation_status VARCHAR(50) DEFAULT 'pending' NOT NULL CHECK (invitation_status IN ('pending', 'accepted', 'expired', 'cancelled'));

COMMENT ON COLUMN public.organization_members.invitation_email IS 'Email address for pending invitations (before user signup)';
COMMENT ON COLUMN public.organization_members.invitation_status IS 'Status of the invitation: pending, accepted, expired, cancelled';

-- =============================================================================
-- 4. ENHANCE STATUS_PAGES FOR BETTER PUBLIC ACCESS
-- =============================================================================

-- Add public access and SEO fields
ALTER TABLE public.status_pages 
ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT true NOT NULL,
ADD COLUMN IF NOT EXISTS seo_title VARCHAR(255),
ADD COLUMN IF NOT EXISTS seo_description TEXT,
ADD COLUMN IF NOT EXISTS custom_css TEXT,
ADD COLUMN IF NOT EXISTS favicon_url TEXT;

COMMENT ON COLUMN public.status_pages.is_public IS 'Whether the status page is publicly accessible';
COMMENT ON COLUMN public.status_pages.seo_title IS 'Custom SEO title for the status page';
COMMENT ON COLUMN public.status_pages.seo_description IS 'Custom SEO description for the status page';
COMMENT ON COLUMN public.status_pages.custom_css IS 'Custom CSS for status page branding';
COMMENT ON COLUMN public.status_pages.favicon_url IS 'Custom favicon URL for the status page';

-- =============================================================================
-- 5. CREATE MISSING TABLES FOR INCIDENT NOTIFICATIONS
-- =============================================================================

-- Create notification_rules table for escalation policies
CREATE TABLE IF NOT EXISTS public.notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    escalation_policy_id UUID NOT NULL REFERENCES public.escalation_policies(id) ON DELETE CASCADE,
    delay_minutes INTEGER NOT NULL DEFAULT 0 CHECK (delay_minutes >= 0),
    notification_type VARCHAR(50) NOT NULL CHECK (notification_type IN ('email', 'sms', 'voice', 'slack', 'teams', 'webhook')),
    target_type VARCHAR(50) NOT NULL CHECK (target_type IN ('user', 'team', 'webhook')),
    target_id UUID, -- References users.id for user notifications
    webhook_url TEXT, -- For webhook notifications
    is_active BOOLEAN DEFAULT true NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.notification_rules IS 'Notification rules for escalation policies';

-- Create notification_history table for tracking sent notifications
CREATE TABLE IF NOT EXISTS public.notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    user_id UUID REFERENCES public.users(id),
    organization_id UUID NOT NULL REFERENCES public.organizations(id),
    notification_type VARCHAR(50) NOT NULL,
    target_address TEXT NOT NULL, -- email, phone, webhook URL, etc.
    status VARCHAR(50) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'delivered', 'failed', 'bounced')),
    error_message TEXT,
    sent_at TIMESTAMPTZ,
    delivered_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

COMMENT ON TABLE public.notification_history IS 'History of all notifications sent for incidents';

-- =============================================================================
-- 6. ENHANCE SUBSCRIPTIONS FOR EMAIL NOTIFICATIONS
-- =============================================================================

-- Add unsubscribe functionality to subscriptions
ALTER TABLE public.subscriptions 
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255) UNIQUE,
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{"email": true, "sms": false}' NOT NULL;

COMMENT ON COLUMN public.subscriptions.unsubscribe_token IS 'Unique token for unsubscribe links';
COMMENT ON COLUMN public.subscriptions.unsubscribed_at IS 'When the subscription was unsubscribed';
COMMENT ON COLUMN public.subscriptions.notification_preferences IS 'User preferences for different notification types';

-- =============================================================================
-- 7. CREATE INDEXES FOR PERFORMANCE
-- =============================================================================

-- Indexes for better query performance
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_rules_escalation_policy 
    ON public.notification_rules(escalation_policy_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_incident 
    ON public.notification_history(incident_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_user 
    ON public.notification_history(user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_organization 
    ON public.notification_history(organization_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_history_status 
    ON public.notification_history(status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subscriptions_unsubscribe_token 
    ON public.subscriptions(unsubscribe_token) WHERE unsubscribe_token IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_invitation_status 
    ON public.organization_members(invitation_status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_organization_members_invitation_email 
    ON public.organization_members(invitation_email) WHERE invitation_email IS NOT NULL;

-- =============================================================================
-- 8. CREATE FUNCTIONS FOR AUTOMATION
-- =============================================================================

-- Function to generate unsubscribe tokens
CREATE OR REPLACE FUNCTION generate_unsubscribe_token()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.unsubscribe_token IS NULL THEN
        NEW.unsubscribe_token := encode(gen_random_bytes(32), 'base64url');
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-generate unsubscribe tokens
DROP TRIGGER IF EXISTS trigger_generate_unsubscribe_token ON public.subscriptions;
CREATE TRIGGER trigger_generate_unsubscribe_token
    BEFORE INSERT ON public.subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION generate_unsubscribe_token();

-- Function to calculate profile completion percentage
CREATE OR REPLACE FUNCTION calculate_profile_completion(user_id UUID)
RETURNS INTEGER AS $$
DECLARE
    completion_percentage INTEGER := 0;
    user_record RECORD;
BEGIN
    SELECT * INTO user_record FROM public.users WHERE id = user_id;
    
    IF user_record IS NULL THEN
        RETURN 0;
    END IF;
    
    -- Basic info (40% total)
    IF user_record.name IS NOT NULL AND user_record.name != '' THEN
        completion_percentage := completion_percentage + 10;
    END IF;
    
    IF user_record.email IS NOT NULL AND user_record.email != '' THEN
        completion_percentage := completion_percentage + 10;
    END IF;
    
    IF user_record.phone_number IS NOT NULL AND user_record.phone_number != '' THEN
        completion_percentage := completion_percentage + 10;
    END IF;
    
    IF user_record.timezone IS NOT NULL AND user_record.timezone != '' THEN
        completion_percentage := completion_percentage + 10;
    END IF;
    
    -- Notification preferences (30% total)
    IF user_record.notification_preferences IS NOT NULL THEN
        completion_percentage := completion_percentage + 15;
    END IF;
    
    IF user_record.email_notifications_enabled IS NOT NULL THEN
        completion_percentage := completion_percentage + 15;
    END IF;
    
    -- Incident management role (20% total)
    IF user_record.incident_role IS NOT NULL THEN
        completion_percentage := completion_percentage + 20;
    END IF;
    
    -- Profile picture (10% total)
    IF user_record.avatar_url IS NOT NULL AND user_record.avatar_url != '' THEN
        completion_percentage := completion_percentage + 10;
    END IF;
    
    RETURN completion_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to update profile completion
CREATE OR REPLACE FUNCTION update_profile_completion()
RETURNS TRIGGER AS $$
BEGIN
    NEW.profile_completion_percentage := calculate_profile_completion(NEW.id);
    NEW.profile_completed := (NEW.profile_completion_percentage >= 80);
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to auto-update profile completion
DROP TRIGGER IF EXISTS trigger_update_profile_completion ON public.users;
CREATE TRIGGER trigger_update_profile_completion
    BEFORE INSERT OR UPDATE ON public.users
    FOR EACH ROW
    EXECUTE FUNCTION update_profile_completion();

-- =============================================================================
-- 9. GRANT PERMISSIONS
-- =============================================================================

-- Grant permissions to the application user
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO postgres;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO postgres;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO postgres;

-- =============================================================================
-- 10. UPDATE EXISTING DATA
-- =============================================================================

-- Update existing users' profile completion
UPDATE public.users 
SET profile_completion_percentage = calculate_profile_completion(id),
    profile_completed = (calculate_profile_completion(id) >= 80)
WHERE profile_completion_percentage = 0;

-- Update existing subscriptions with unsubscribe tokens
UPDATE public.subscriptions 
SET unsubscribe_token = encode(gen_random_bytes(32), 'base64url')
WHERE unsubscribe_token IS NULL;

-- Set default invitation status for existing organization members
UPDATE public.organization_members 
SET invitation_status = CASE 
    WHEN accepted_at IS NOT NULL THEN 'accepted'
    WHEN invitation_expires_at < NOW() THEN 'expired'
    ELSE 'pending'
END
WHERE invitation_status = 'pending';

-- =============================================================================
-- MIGRATION COMPLETE
-- =============================================================================

-- Log the migration completion
INSERT INTO public.activity_history (
    organization_id,
    user_id,
    activity_type,
    description,
    metadata,
    created_at
)
SELECT 
    o.id,
    NULL,
    'system_migration',
    'Applied schema migration: 12_missing_columns_and_fixes.sql',
    '{"migration": "12_missing_columns_and_fixes", "tables_updated": ["services", "users", "organization_members", "status_pages", "subscriptions"], "tables_created": ["notification_rules", "notification_history"]}'::jsonb,
    NOW()
FROM public.organizations o
LIMIT 1;

-- Verify the migration
SELECT 
    'Migration 12_missing_columns_and_fixes.sql completed successfully' as status,
    NOW() as completed_at; 