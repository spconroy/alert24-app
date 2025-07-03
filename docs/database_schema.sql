-- Alert24 Database Schema
-- Multi-Tenant SaaS Application for Real-Time Collaboration
-- PostgreSQL Schema with proper indexing and constraints

-- Create schema and set authorization
CREATE SCHEMA IF NOT EXISTS alert24_schema AUTHORIZATION alert24;

-- Set search path to use the new schema
SET search_path TO alert24_schema, public;

-- Enable UUID extension for primary keys
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Enable pgcrypto for secure hashing
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- CORE ENTITIES
-- ============================================================================

-- Organizations (Multi-tenant core)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE, -- Custom domain
    subdomain VARCHAR(100) UNIQUE, -- Subdomain (orgname.app.com)
    
    -- Branding settings
    logo_url TEXT,
    primary_color VARCHAR(7), -- Hex color code
    secondary_color VARCHAR(7),
    custom_css TEXT,
    
    -- Subscription info
    subscription_plan VARCHAR(50) DEFAULT 'free' CHECK (subscription_plan IN ('free', 'pro', 'enterprise')),
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'active' CHECK (subscription_status IN ('active', 'past_due', 'canceled', 'unpaid')),
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Limits based on plan
    max_team_members INTEGER DEFAULT 3,
    max_projects INTEGER DEFAULT 5,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Users (Google OAuth based)
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    google_oauth_id VARCHAR(255) UNIQUE,
    
    -- Preferences
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    email_notifications_enabled BOOLEAN DEFAULT true,
    push_notifications_enabled BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Organization Members (Many-to-many with roles)
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    
    -- Invitation tracking
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    accepted_at TIMESTAMP WITH TIME ZONE,
    invitation_token VARCHAR(255),
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, user_id)
);

-- ============================================================================
-- REAL-TIME & NOTIFICATIONS
-- ============================================================================

-- Notifications
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Notification content
    type VARCHAR(100) NOT NULL, -- 'invitation', 'task_assigned', 'subscription_alert', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB, -- Additional structured data
    
    -- Action/links
    action_url TEXT,
    action_text VARCHAR(100),
    
    -- Status
    is_read BOOLEAN DEFAULT false,
    is_email_sent BOOLEAN DEFAULT false,
    email_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Real-time channels for WebSocket subscriptions
CREATE TABLE realtime_channels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    channel_name VARCHAR(255) NOT NULL, -- e.g., 'notifications', 'activity', 'team_presence'
    user_id UUID REFERENCES users(id), -- NULL for org-wide channels
    
    -- Connection tracking
    last_activity_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(organization_id, channel_name, user_id)
);

-- ============================================================================
-- AUDIT LOG & ACTIVITY HISTORY
-- ============================================================================

-- Activity History (Audit Log)
CREATE TABLE activity_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_id UUID REFERENCES users(id),
    actor_type VARCHAR(50) DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api')),
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'deleted', 'invited', etc.
    entity_type VARCHAR(100) NOT NULL, -- 'user', 'organization', 'notification', etc.
    entity_id UUID, -- ID of the affected entity
    entity_name VARCHAR(255), -- Human-readable name
    
    -- Change tracking
    old_values JSONB, -- Previous state
    new_values JSONB, -- New state
    changes JSONB, -- Specific changes made
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- SUBSCRIPTION & BILLING
-- ============================================================================

-- Subscription Plans
CREATE TABLE subscription_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(100) NOT NULL UNIQUE,
    stripe_product_id VARCHAR(255) UNIQUE,
    stripe_price_id VARCHAR(255) UNIQUE,
    
    -- Plan details
    description TEXT,
    price_monthly DECIMAL(10,2),
    price_yearly DECIMAL(10,2),
    currency VARCHAR(3) DEFAULT 'USD',
    
    -- Feature limits
    max_team_members INTEGER,
    max_projects INTEGER,
    max_storage_gb INTEGER,
    
    -- Features included
    features JSONB, -- Array of feature names
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Billing History
CREATE TABLE billing_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Stripe integration
    stripe_invoice_id VARCHAR(255) UNIQUE,
    stripe_payment_intent_id VARCHAR(255),
    
    -- Billing details
    amount DECIMAL(10,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'USD',
    status VARCHAR(50) NOT NULL CHECK (status IN ('pending', 'paid', 'failed', 'refunded')),
    
    -- Plan information
    plan_name VARCHAR(100) NOT NULL,
    billing_period_start TIMESTAMP WITH TIME ZONE,
    billing_period_end TIMESTAMP WITH TIME ZONE,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    paid_at TIMESTAMP WITH TIME ZONE
);

-- ============================================================================
-- PROJECTS & COLLABORATION (Example domain entities)
-- ============================================================================

-- Projects (Example of domain-specific entities)
CREATE TABLE projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Project details
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'archived', 'completed')),
    
    -- Ownership
    created_by UUID NOT NULL REFERENCES users(id),
    assigned_to UUID REFERENCES users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Project Members (Many-to-many)
CREATE TABLE project_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member', 'viewer')),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, user_id)
);

-- ============================================================================
-- SESSIONS & AUTHENTICATION
-- ============================================================================

-- User Sessions (for session management)
CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID REFERENCES organizations(id),
    
    -- Session details
    session_token VARCHAR(255) UNIQUE NOT NULL,
    refresh_token VARCHAR(255) UNIQUE,
    
    -- Device info
    ip_address INET,
    user_agent TEXT,
    device_type VARCHAR(50),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    expires_at TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Organizations
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organizations_domain ON organizations(domain);
CREATE INDEX idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX idx_organizations_stripe_customer ON organizations(stripe_customer_id);
CREATE INDEX idx_organizations_subscription_status ON organizations(subscription_status);
CREATE INDEX idx_organizations_created_at ON organizations(created_at);

-- Users
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_oauth_id ON users(google_oauth_id);
CREATE INDEX idx_users_is_active ON users(is_active);
CREATE INDEX idx_users_last_login ON users(last_login_at);

-- Organization Members
CREATE INDEX idx_org_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON organization_members(user_id);
CREATE INDEX idx_org_members_role ON organization_members(role);
CREATE INDEX idx_org_members_invitation_token ON organization_members(invitation_token);
CREATE INDEX idx_org_members_accepted_at ON organization_members(accepted_at);

-- Notifications
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_org_id ON notifications(organization_id);
CREATE INDEX idx_notifications_type ON notifications(type);
CREATE INDEX idx_notifications_is_read ON notifications(is_read);
CREATE INDEX idx_notifications_created_at ON notifications(created_at);
CREATE INDEX idx_notifications_user_unread ON notifications(user_id, is_read) WHERE is_read = false;

-- Activity History
CREATE INDEX idx_activity_history_org_id ON activity_history(organization_id);
CREATE INDEX idx_activity_history_actor_id ON activity_history(actor_id);
CREATE INDEX idx_activity_history_action ON activity_history(action);
CREATE INDEX idx_activity_history_entity ON activity_history(entity_type, entity_id);
CREATE INDEX idx_activity_history_created_at ON activity_history(created_at);

-- Real-time Channels
CREATE INDEX idx_realtime_channels_org_id ON realtime_channels(organization_id);
CREATE INDEX idx_realtime_channels_user_id ON realtime_channels(user_id);
CREATE INDEX idx_realtime_channels_active ON realtime_channels(is_active);

-- Projects
CREATE INDEX idx_projects_org_id ON projects(organization_id);
CREATE INDEX idx_projects_created_by ON projects(created_by);
CREATE INDEX idx_projects_assigned_to ON projects(assigned_to);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at);

-- Project Members
CREATE INDEX idx_project_members_project_id ON project_members(project_id);
CREATE INDEX idx_project_members_user_id ON project_members(user_id);
CREATE INDEX idx_project_members_role ON project_members(role);

-- User Sessions
CREATE INDEX idx_user_sessions_user_id ON user_sessions(user_id);
CREATE INDEX idx_user_sessions_token ON user_sessions(session_token);
CREATE INDEX idx_user_sessions_expires ON user_sessions(expires_at);
CREATE INDEX idx_user_sessions_active ON user_sessions(is_active);

-- Billing History
CREATE INDEX idx_billing_history_org_id ON billing_history(organization_id);
CREATE INDEX idx_billing_history_stripe_invoice ON billing_history(stripe_invoice_id);
CREATE INDEX idx_billing_history_status ON billing_history(status);
CREATE INDEX idx_billing_history_created_at ON billing_history(created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON notifications FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_subscription_plans_updated_at BEFORE UPDATE ON subscription_plans FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_projects_updated_at BEFORE UPDATE ON projects FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================================================
-- FUNCTIONS FOR COMMON OPERATIONS
-- ============================================================================

-- Function to get user's organizations
CREATE OR REPLACE FUNCTION get_user_organizations(user_uuid UUID)
RETURNS TABLE (
    organization_id UUID,
    organization_name VARCHAR(255),
    organization_slug VARCHAR(100),
    user_role VARCHAR(50),
    is_active BOOLEAN
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        om.organization_id,
        o.name,
        o.slug,
        om.role,
        om.is_active
    FROM organization_members om
    JOIN organizations o ON om.organization_id = o.id
    WHERE om.user_id = user_uuid
    AND om.is_active = true
    AND o.deleted_at IS NULL;
END;
$$ LANGUAGE plpgsql;

-- Function to log activity
CREATE OR REPLACE FUNCTION log_activity(
    p_organization_id UUID,
    p_actor_id UUID,
    p_action VARCHAR(100),
    p_entity_type VARCHAR(100),
    p_entity_id UUID,
    p_entity_name VARCHAR(255),
    p_old_values JSONB DEFAULT NULL,
    p_new_values JSONB DEFAULT NULL,
    p_changes JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    activity_id UUID;
BEGIN
    INSERT INTO activity_history (
        organization_id,
        actor_id,
        action,
        entity_type,
        entity_id,
        entity_name,
        old_values,
        new_values,
        changes
    ) VALUES (
        p_organization_id,
        p_actor_id,
        p_action,
        p_entity_type,
        p_entity_id,
        p_entity_name,
        p_old_values,
        p_new_values,
        p_changes
    ) RETURNING id INTO activity_id;
    
    RETURN activity_id;
END;
$$ LANGUAGE plpgsql;

-- Function to create notification
CREATE OR REPLACE FUNCTION create_notification(
    p_organization_id UUID,
    p_user_id UUID,
    p_type VARCHAR(100),
    p_title VARCHAR(255),
    p_message TEXT,
    p_data JSONB DEFAULT NULL,
    p_action_url TEXT DEFAULT NULL,
    p_action_text VARCHAR(100) DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    notification_id UUID;
BEGIN
    INSERT INTO notifications (
        organization_id,
        user_id,
        type,
        title,
        message,
        data,
        action_url,
        action_text
    ) VALUES (
        p_organization_id,
        p_user_id,
        p_type,
        p_title,
        p_message,
        p_data,
        p_action_url,
        p_action_text
    ) RETURNING id INTO notification_id;
    
    RETURN notification_id;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- VIEWS FOR COMMON QUERIES
-- ============================================================================

-- View for organization dashboard data
CREATE VIEW organization_dashboard AS
SELECT 
    o.id,
    o.name,
    o.slug,
    o.subscription_plan,
    o.subscription_status,
    o.current_period_end,
    COUNT(DISTINCT om.user_id) as member_count,
    COUNT(DISTINCT p.id) as project_count,
    COUNT(DISTINCT n.id) as unread_notifications_count
FROM organizations o
LEFT JOIN organization_members om ON o.id = om.organization_id AND om.is_active = true
LEFT JOIN projects p ON o.id = p.organization_id AND p.deleted_at IS NULL
LEFT JOIN notifications n ON o.id = n.organization_id AND n.is_read = false
WHERE o.deleted_at IS NULL
GROUP BY o.id, o.name, o.slug, o.subscription_plan, o.subscription_status, o.current_period_end;

-- View for user dashboard data
CREATE VIEW user_dashboard AS
SELECT 
    u.id as user_id,
    u.name,
    u.email,
    u.avatar_url,
    COUNT(DISTINCT om.organization_id) as organization_count,
    COUNT(DISTINCT n.id) as unread_notifications_count,
    COUNT(DISTINCT p.id) as project_count
FROM users u
LEFT JOIN organization_members om ON u.id = om.user_id AND om.is_active = true
LEFT JOIN notifications n ON u.id = n.user_id AND n.is_read = false
LEFT JOIN projects p ON u.id = p.assigned_to AND p.deleted_at IS NULL
WHERE u.deleted_at IS NULL
GROUP BY u.id, u.name, u.email, u.avatar_url;

-- ============================================================================
-- INITIAL DATA
-- ============================================================================

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, max_team_members, max_projects, features) VALUES
('free', 'Free plan with basic features', 0, 0, 3, 5, '["basic_collaboration", "notifications"]'),
('pro', 'Professional plan with advanced features', 29.99, 299.99, 10, 25, '["advanced_collaboration", "custom_branding", "priority_support", "analytics"]'),
('enterprise', 'Enterprise plan with unlimited features', 99.99, 999.99, NULL, NULL, '["unlimited_collaboration", "custom_branding", "priority_support", "analytics", "api_access", "custom_integrations"]');

-- ============================================================================
-- COMMENTS FOR DOCUMENTATION
-- ============================================================================

COMMENT ON TABLE organizations IS 'Core multi-tenant entity representing customer organizations';
COMMENT ON TABLE users IS 'User accounts with Google OAuth integration';
COMMENT ON TABLE organization_members IS 'Many-to-many relationship between users and organizations with roles';
COMMENT ON TABLE notifications IS 'In-app and email notifications for users';
COMMENT ON TABLE activity_history IS 'Audit log for tracking all user and system actions';
COMMENT ON TABLE realtime_channels IS 'WebSocket channels for real-time updates';
COMMENT ON TABLE subscription_plans IS 'Available subscription plans and their features';
COMMENT ON TABLE billing_history IS 'Payment and billing transaction history';
COMMENT ON TABLE projects IS 'Example domain entity for collaboration features';
COMMENT ON TABLE user_sessions IS 'User session management for authentication';

COMMENT ON COLUMN organizations.subscription_plan IS 'Current subscription plan: free, pro, enterprise';
COMMENT ON COLUMN organizations.stripe_customer_id IS 'Stripe customer ID for billing integration';
COMMENT ON COLUMN organization_members.role IS 'User role within organization: owner, admin, member';
COMMENT ON COLUMN notifications.type IS 'Notification type: invitation, task_assigned, subscription_alert, etc.';
COMMENT ON COLUMN activity_history.action IS 'Action performed: created, updated, deleted, invited, etc.';
COMMENT ON COLUMN activity_history.entity_type IS 'Type of entity affected: user, organization, project, etc.'; 