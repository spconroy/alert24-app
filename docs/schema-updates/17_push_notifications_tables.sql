-- =====================================================
-- Push Notifications Infrastructure
-- Creates tables for Web Push Notification System
-- =====================================================

-- Create push_subscriptions table
CREATE TABLE IF NOT EXISTS push_subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Web Push subscription data
    endpoint TEXT NOT NULL UNIQUE,
    p256dh_key TEXT NOT NULL,
    auth_key TEXT NOT NULL,
    
    -- Device information
    device_type VARCHAR(20) DEFAULT 'unknown',
    device_name VARCHAR(255) DEFAULT 'Unknown Device',
    browser VARCHAR(100) DEFAULT 'Unknown Browser',
    
    -- Status and tracking
    is_active BOOLEAN DEFAULT TRUE,
    last_used TIMESTAMPTZ DEFAULT NOW(),
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_id ON push_subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_organization_id ON push_subscriptions(organization_id);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_endpoint ON push_subscriptions(endpoint);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_active ON push_subscriptions(is_active);
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user_active ON push_subscriptions(user_id, is_active);

-- Add RLS policies
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only access their own push subscriptions
CREATE POLICY "Users can view own push subscriptions" ON push_subscriptions
    FOR SELECT USING (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can insert own push subscriptions" ON push_subscriptions
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can update own push subscriptions" ON push_subscriptions
    FOR UPDATE USING (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can delete own push subscriptions" ON push_subscriptions
    FOR DELETE USING (
        auth.uid()::text = user_id::text
    );

-- Update notification_history table to support push notifications
-- Add push notification type if not already exists
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_history' 
        AND column_name = 'channel'
    ) THEN
        ALTER TABLE notification_history ADD COLUMN channel VARCHAR(50) DEFAULT 'email';
    END IF;
END $$;

-- Update existing notification_history records to have email channel
UPDATE notification_history SET channel = 'email' WHERE channel IS NULL;

-- Add constraint to ensure valid channels
DO $$
BEGIN
    -- Drop existing constraint if it exists
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'notification_history_channel_check'
    ) THEN
        ALTER TABLE notification_history DROP CONSTRAINT notification_history_channel_check;
    END IF;
    
    -- Add new constraint with push notification support
    ALTER TABLE notification_history ADD CONSTRAINT notification_history_channel_check 
        CHECK (channel IN ('email', 'sms', 'push_notification', 'slack', 'teams', 'discord', 'webhook', 'voice'));
END $$;

-- Update notification_preferences table to support push notifications
-- Add push notification preferences if not already exists
DO $$ 
BEGIN
    -- Check if push notification columns exist, if not add them
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'notification_preferences' 
        AND column_name = 'push_notifications_enabled'
    ) THEN
        ALTER TABLE notification_preferences 
        ADD COLUMN push_notifications_enabled BOOLEAN DEFAULT TRUE,
        ADD COLUMN push_notifications_incidents BOOLEAN DEFAULT TRUE,
        ADD COLUMN push_notifications_monitoring BOOLEAN DEFAULT TRUE,
        ADD COLUMN push_notifications_maintenance BOOLEAN DEFAULT FALSE,
        ADD COLUMN push_notifications_updates BOOLEAN DEFAULT TRUE;
    END IF;
END $$;

-- Update user_contact_methods table to ensure push notification support
-- This table should already support multiple channels, but let's verify
DO $$
BEGIN
    -- Ensure the contact_type supports push_notification
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints 
        WHERE constraint_name = 'user_contact_methods_contact_type_check'
    ) THEN
        ALTER TABLE user_contact_methods DROP CONSTRAINT user_contact_methods_contact_type_check;
    END IF;
    
    ALTER TABLE user_contact_methods ADD CONSTRAINT user_contact_methods_contact_type_check 
        CHECK (contact_type IN ('email', 'sms', 'voice', 'slack', 'teams', 'discord', 'webhook', 'push_notification'));
END $$;

-- Create notification_delivery_log table for tracking delivery across all channels
CREATE TABLE IF NOT EXISTS notification_delivery_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    notification_history_id UUID REFERENCES notification_history(id) ON DELETE CASCADE,
    
    -- Delivery details
    channel VARCHAR(50) NOT NULL,
    recipient_identifier TEXT NOT NULL, -- email address, phone number, endpoint, etc.
    delivery_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    delivery_attempts INTEGER DEFAULT 0,
    
    -- Response details
    provider_response JSONB,
    error_message TEXT,
    delivered_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT delivery_status_check CHECK (
        delivery_status IN ('pending', 'sent', 'delivered', 'failed', 'bounced', 'unsubscribed')
    ),
    CONSTRAINT channel_check CHECK (
        channel IN ('email', 'sms', 'push_notification', 'slack', 'teams', 'discord', 'webhook', 'voice')
    )
);

-- Create indexes for notification_delivery_log
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_history_id ON notification_delivery_log(notification_history_id);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_channel ON notification_delivery_log(channel);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_status ON notification_delivery_log(delivery_status);
CREATE INDEX IF NOT EXISTS idx_notification_delivery_log_created_at ON notification_delivery_log(created_at);

-- Add RLS for notification_delivery_log
ALTER TABLE notification_delivery_log ENABLE ROW LEVEL SECURITY;

-- Organization members can view delivery logs for their organization's notifications
CREATE POLICY "Organization members can view delivery logs" ON notification_delivery_log
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM notification_history nh
            JOIN organization_members om ON nh.organization_id = om.organization_id
            WHERE nh.id = notification_delivery_log.notification_history_id
            AND om.user_id::text = auth.uid()::text
            AND om.is_active = true
        )
    );

-- Service accounts can insert delivery logs
CREATE POLICY "Service can insert delivery logs" ON notification_delivery_log
    FOR INSERT WITH CHECK (true);

-- Service accounts can update delivery logs
CREATE POLICY "Service can update delivery logs" ON notification_delivery_log
    FOR UPDATE USING (true);

-- Add updated_at trigger for push_subscriptions
CREATE OR REPLACE FUNCTION update_push_subscriptions_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subscriptions_updated_at
    BEFORE UPDATE ON push_subscriptions
    FOR EACH ROW
    EXECUTE FUNCTION update_push_subscriptions_updated_at();

-- Add updated_at trigger for notification_delivery_log
CREATE OR REPLACE FUNCTION update_notification_delivery_log_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_notification_delivery_log_updated_at
    BEFORE UPDATE ON notification_delivery_log
    FOR EACH ROW
    EXECUTE FUNCTION update_notification_delivery_log_updated_at();

-- Grant necessary permissions
GRANT ALL ON push_subscriptions TO authenticated;
GRANT ALL ON notification_delivery_log TO authenticated;

-- Create phone_verifications table for SMS verification
CREATE TABLE IF NOT EXISTS phone_verifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    phone_number VARCHAR(20) NOT NULL,
    verification_code VARCHAR(10) NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    
    UNIQUE(user_id, phone_number)
);

-- Create indexes for phone_verifications
CREATE INDEX IF NOT EXISTS idx_phone_verifications_user_id ON phone_verifications(user_id);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON phone_verifications(phone_number);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_code ON phone_verifications(verification_code);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_expires ON phone_verifications(expires_at);

-- Add RLS for phone_verifications
ALTER TABLE phone_verifications ENABLE ROW LEVEL SECURITY;

-- Users can only access their own verification codes
CREATE POLICY "Users can view own verifications" ON phone_verifications
    FOR SELECT USING (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can insert own verifications" ON phone_verifications
    FOR INSERT WITH CHECK (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can update own verifications" ON phone_verifications
    FOR UPDATE USING (
        auth.uid()::text = user_id::text
    );

CREATE POLICY "Users can delete own verifications" ON phone_verifications
    FOR DELETE USING (
        auth.uid()::text = user_id::text
    );

-- Add cleanup function for expired verification codes
CREATE OR REPLACE FUNCTION cleanup_expired_verifications()
RETURNS void AS $$
BEGIN
    DELETE FROM phone_verifications 
    WHERE expires_at < NOW();
END;
$$ LANGUAGE plpgsql;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comment for documentation
COMMENT ON TABLE push_subscriptions IS 'Stores Web Push notification subscriptions for users';
COMMENT ON TABLE notification_delivery_log IS 'Tracks delivery status for all notification channels including push notifications';

-- Insert sample data for testing (optional)
-- This will be handled by the application when users subscribe to push notifications

COMMIT;