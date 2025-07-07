-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 03: Enhanced User Management
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- INCIDENT MANAGEMENT ROLE ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE incident_role AS ENUM (
        'admin',
        'manager',
        'responder',
        'viewer'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- CONTACT METHOD TYPE ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE contact_method_type AS ENUM (
        'email',
        'sms',
        'voice',
        'slack',
        'teams',
        'webhook'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- NOTIFICATION CHANNEL ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE notification_channel AS ENUM (
        'email',
        'sms',
        'voice',
        'push',
        'slack',
        'teams',
        'webhook'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- EXTEND USERS TABLE FOR INCIDENT MANAGEMENT
-- =====================================================

-- Add incident management columns to existing users table
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS incident_role incident_role DEFAULT 'viewer',
ADD COLUMN IF NOT EXISTS is_on_call BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS current_on_call_schedule_id UUID,
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS slack_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS teams_user_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb;

-- Add comments for new columns
COMMENT ON COLUMN users.incident_role IS 'Role for incident management (admin, manager, responder, viewer)';
COMMENT ON COLUMN users.is_on_call IS 'Whether user is currently on call';
COMMENT ON COLUMN users.current_on_call_schedule_id IS 'Current on-call schedule if on call';
COMMENT ON COLUMN users.timezone IS 'User timezone for scheduling';
COMMENT ON COLUMN users.phone_number IS 'Phone number for SMS/voice notifications';
COMMENT ON COLUMN users.slack_user_id IS 'Slack user ID for notifications';
COMMENT ON COLUMN users.teams_user_id IS 'Microsoft Teams user ID for notifications';
COMMENT ON COLUMN users.notification_preferences IS 'User notification preferences JSON';

-- =====================================================
-- EXTEND ORGANIZATION_MEMBERS TABLE
-- =====================================================

-- Add incident management role to organization members
ALTER TABLE organization_members 
ADD COLUMN IF NOT EXISTS incident_role incident_role DEFAULT 'viewer',
ADD COLUMN IF NOT EXISTS can_create_incidents BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_acknowledge_incidents BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_resolve_incidents BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_escalations BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS can_manage_monitoring BOOLEAN DEFAULT false;

-- Add comments for new columns
COMMENT ON COLUMN organization_members.incident_role IS 'Member role for incident management within organization';
COMMENT ON COLUMN organization_members.can_create_incidents IS 'Permission to create incidents';
COMMENT ON COLUMN organization_members.can_acknowledge_incidents IS 'Permission to acknowledge incidents';
COMMENT ON COLUMN organization_members.can_resolve_incidents IS 'Permission to resolve incidents';
COMMENT ON COLUMN organization_members.can_manage_escalations IS 'Permission to manage escalation policies';
COMMENT ON COLUMN organization_members.can_manage_monitoring IS 'Permission to manage monitoring checks';

-- =====================================================
-- USER CONTACT METHODS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_contact_methods (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Contact method details
    method_type contact_method_type NOT NULL,
    contact_value VARCHAR(255) NOT NULL, -- email, phone, slack username, etc.
    
    -- Contact method configuration
    is_primary BOOLEAN DEFAULT false,
    is_verified BOOLEAN DEFAULT false,
    verification_token VARCHAR(255),
    verification_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Notification settings
    enabled_for_incidents BOOLEAN DEFAULT true,
    enabled_for_escalations BOOLEAN DEFAULT true,
    enabled_for_monitoring BOOLEAN DEFAULT true,
    
    -- Filtering by severity
    severity_filter incident_severity[] DEFAULT ARRAY['critical', 'high', 'medium', 'low']::incident_severity[],
    
    -- Quiet hours (JSON format)
    quiet_hours JSONB DEFAULT '{}'::jsonb,
    -- Example quiet_hours:
    -- {
    --   "enabled": true,
    --   "start_time": "22:00",
    --   "end_time": "08:00",
    --   "timezone": "America/New_York",
    --   "days": ["monday", "tuesday", "wednesday", "thursday", "friday"]
    -- }
    
    -- Rate limiting
    max_notifications_per_hour INTEGER DEFAULT 10,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USER NOTIFICATION PREFERENCES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_notification_preferences (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Notification preferences by event type
    incident_created JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    incident_updated JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    incident_escalated JSONB DEFAULT '{"channels": ["email", "sms"], "enabled": true}'::jsonb,
    incident_resolved JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    
    monitoring_alert JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    monitoring_recovery JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    
    on_call_assigned JSONB DEFAULT '{"channels": ["email", "sms"], "enabled": true}'::jsonb,
    on_call_reminder JSONB DEFAULT '{"channels": ["email"], "enabled": true}'::jsonb,
    
    -- Global notification settings
    global_enabled BOOLEAN DEFAULT true,
    do_not_disturb BOOLEAN DEFAULT false,
    
    -- Digest settings
    daily_digest_enabled BOOLEAN DEFAULT true,
    weekly_digest_enabled BOOLEAN DEFAULT false,
    digest_time TIME DEFAULT '09:00:00',
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATION HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Notification details
    notification_type VARCHAR(100) NOT NULL, -- 'incident_created', 'incident_escalated', etc.
    channel notification_channel NOT NULL,
    recipient VARCHAR(255) NOT NULL, -- email address, phone number, etc.
    
    -- Content
    subject VARCHAR(500),
    message TEXT,
    
    -- Related objects
    incident_id UUID REFERENCES incidents(id),
    monitoring_check_id UUID REFERENCES monitoring_checks(id),
    escalation_id UUID REFERENCES incident_escalations(id),
    
    -- Delivery tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- External tracking
    external_id VARCHAR(255), -- Provider-specific message ID
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TEAM GROUPS TABLE (for organizing users)
-- =====================================================

CREATE TABLE IF NOT EXISTS team_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Team identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Team configuration
    is_active BOOLEAN DEFAULT true,
    color VARCHAR(7) DEFAULT '#0066CC', -- Hex color code
    
    -- Default escalation policy for team
    default_escalation_policy_id UUID REFERENCES escalation_policies(id),
    
    -- Team lead
    team_lead_id UUID REFERENCES users(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- TEAM MEMBERSHIPS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS team_memberships (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    team_group_id UUID NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Membership details
    role VARCHAR(50) DEFAULT 'member', -- 'lead', 'member', 'backup'
    is_active BOOLEAN DEFAULT true,
    
    -- Joined date
    joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- USER ACTIVITY LOG TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS user_activity_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Activity details
    activity_type VARCHAR(100) NOT NULL, -- 'login', 'incident_created', 'incident_acknowledged', etc.
    activity_description TEXT,
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Related objects
    incident_id UUID REFERENCES incidents(id),
    monitoring_check_id UUID REFERENCES monitoring_checks(id),
    
    -- Metadata
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CONSTRAINTS AND INDEXES
-- =====================================================

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_user_contact_methods_unique_primary 
ON user_contact_methods(user_id, method_type) WHERE is_primary = true;

CREATE UNIQUE INDEX IF NOT EXISTS idx_user_notification_preferences_user_org 
ON user_notification_preferences(user_id, organization_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_team_memberships_unique 
ON team_memberships(team_group_id, user_id);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_user_id ON user_contact_methods(user_id);
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_method_type ON user_contact_methods(method_type);
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_is_verified ON user_contact_methods(is_verified);

CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_user_id ON user_notification_preferences(user_id);
CREATE INDEX IF NOT EXISTS idx_user_notification_preferences_organization_id ON user_notification_preferences(organization_id);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_id ON notification_history(user_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_organization_id ON notification_history(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_incident_id ON notification_history(incident_id);
CREATE INDEX IF NOT EXISTS idx_notification_history_status ON notification_history(status);
CREATE INDEX IF NOT EXISTS idx_notification_history_created_at ON notification_history(created_at);

CREATE INDEX IF NOT EXISTS idx_team_groups_organization_id ON team_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_groups_is_active ON team_groups(is_active);

CREATE INDEX IF NOT EXISTS idx_team_memberships_team_group_id ON team_memberships(team_group_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_user_id ON user_activity_log(user_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_organization_id ON user_activity_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_created_at ON user_activity_log(created_at);
CREATE INDEX IF NOT EXISTS idx_user_activity_log_incident_id ON user_activity_log(incident_id);

-- Add indexes for new user columns
CREATE INDEX IF NOT EXISTS idx_users_incident_role ON users(incident_role);
CREATE INDEX IF NOT EXISTS idx_users_is_on_call ON users(is_on_call);
CREATE INDEX IF NOT EXISTS idx_users_phone_number ON users(phone_number);

CREATE INDEX IF NOT EXISTS idx_organization_members_incident_role ON organization_members(incident_role);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key for current on-call schedule (will be added after on_call_schedules exists)
-- ALTER TABLE users 
-- ADD CONSTRAINT fk_users_current_on_call_schedule 
-- FOREIGN KEY (current_on_call_schedule_id) REFERENCES on_call_schedules(id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE user_contact_methods IS 'User contact methods for notifications';
COMMENT ON TABLE user_notification_preferences IS 'User notification preferences by organization';
COMMENT ON TABLE notification_history IS 'History of all notifications sent to users';
COMMENT ON TABLE team_groups IS 'Team organization within organizations';
COMMENT ON TABLE team_memberships IS 'User memberships in teams';
COMMENT ON TABLE user_activity_log IS 'Audit log of user activities';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON user_contact_methods TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_notification_preferences TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_history TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_groups TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON team_memberships TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON user_activity_log TO alert24;

-- =====================================================
-- UPDATE EXISTING USERS WITH DEFAULT VALUES
-- =====================================================

-- Update existing users with default incident management values
UPDATE users 
SET 
    incident_role = 'viewer',
    is_on_call = false,
    timezone = 'UTC',
    notification_preferences = '{
        "email_enabled": true,
        "sms_enabled": false,
        "quiet_hours": {
            "enabled": false,
            "start_time": "22:00",
            "end_time": "08:00"
        }
    }'::jsonb
WHERE incident_role IS NULL;

-- Update existing organization members with default incident permissions
UPDATE organization_members 
SET 
    incident_role = CASE 
        WHEN role = 'admin' THEN 'admin'::incident_role
        WHEN role = 'member' THEN 'responder'::incident_role
        ELSE 'viewer'::incident_role
    END,
    can_create_incidents = CASE 
        WHEN role IN ('admin', 'member') THEN true
        ELSE false
    END,
    can_acknowledge_incidents = CASE 
        WHEN role IN ('admin', 'member') THEN true
        ELSE false
    END,
    can_resolve_incidents = CASE 
        WHEN role IN ('admin', 'member') THEN true
        ELSE false
    END,
    can_manage_escalations = CASE 
        WHEN role = 'admin' THEN true
        ELSE false
    END,
    can_manage_monitoring = CASE 
        WHEN role = 'admin' THEN true
        ELSE false
    END
WHERE incident_role IS NULL; 