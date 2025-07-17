-- ============================================================================
-- ALERT24 COMPLETE SUPABASE SETUP SCRIPT (FIXED UUIDs)
-- ============================================================================
-- This script creates the complete Alert24 database schema with sample data
-- Run this in your Supabase SQL Editor to set up everything at once
-- ============================================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================================
-- DROP EXISTING TABLES (if they exist - for clean setup)
-- ============================================================================

DROP TABLE IF EXISTS public.activity_history CASCADE;
DROP TABLE IF EXISTS public.service_uptime_records CASCADE;
DROP TABLE IF EXISTS public.sla_records CASCADE;
DROP TABLE IF EXISTS public.subscriptions CASCADE;
DROP TABLE IF EXISTS public.status_updates CASCADE;
DROP TABLE IF EXISTS public.status_page_services CASCADE;
DROP TABLE IF EXISTS public.incident_updates CASCADE;
DROP TABLE IF EXISTS public.incidents CASCADE;
DROP TABLE IF EXISTS public.escalation_policies CASCADE;
DROP TABLE IF EXISTS public.on_call_schedules CASCADE;
DROP TABLE IF EXISTS public.service_monitoring CASCADE;
DROP TABLE IF EXISTS public.services CASCADE;
DROP TABLE IF EXISTS public.status_pages CASCADE;
DROP TABLE IF EXISTS public.notifications CASCADE;
DROP TABLE IF EXISTS public.organization_members CASCADE;
DROP TABLE IF EXISTS public.subscription_plans CASCADE;
DROP TABLE IF EXISTS public.organizations CASCADE;
DROP TABLE IF EXISTS public.users CASCADE;

-- ============================================================================
-- CORE TABLES
-- ============================================================================

-- Users table
CREATE TABLE public.users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    google_oauth_id VARCHAR(255) UNIQUE,
    password TEXT, -- Hashed password for non-OAuth users
    
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

-- Organizations table (Multi-tenant core)
CREATE TABLE public.organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255) UNIQUE,
    subdomain VARCHAR(100) UNIQUE,
    
    -- Branding settings
    logo_url TEXT,
    primary_color VARCHAR(7) DEFAULT '#3B82F6', -- Blue
    secondary_color VARCHAR(7) DEFAULT '#64748B', -- Slate
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
    max_services INTEGER DEFAULT 5,
    max_status_pages INTEGER DEFAULT 1,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Organization Members (Many-to-many with roles)
CREATE TABLE public.organization_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
    
    -- Invitation tracking
    invited_by UUID REFERENCES public.users(id),
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

-- Subscription Plans
CREATE TABLE public.subscription_plans (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
    max_services INTEGER,
    max_status_pages INTEGER,
    
    -- Features included
    features JSONB DEFAULT '[]',
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- ALERT24 SPECIFIC TABLES
-- ============================================================================

-- Services (monitoring targets)
CREATE TABLE public.services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    url TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'operational' CHECK (status IN ('operational', 'degraded', 'down', 'maintenance')),
    service_type VARCHAR(50) DEFAULT 'http' CHECK (service_type IN ('http', 'tcp', 'icmp', 'dns')),
    
    -- Monitoring configuration
    check_interval_minutes INTEGER DEFAULT 5,
    timeout_seconds INTEGER DEFAULT 30,
    
    -- Display settings
    sort_order INTEGER DEFAULT 0,
    is_public BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Service Monitoring Configuration
CREATE TABLE public.service_monitoring (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Monitoring settings
    enabled BOOLEAN DEFAULT true,
    check_type VARCHAR(50) NOT NULL DEFAULT 'http' CHECK (check_type IN ('http', 'tcp', 'icmp', 'dns')),
    endpoint_url TEXT,
    expected_status_code INTEGER DEFAULT 200,
    expected_response_time_ms INTEGER DEFAULT 5000,
    
    -- Check configuration
    check_interval_minutes INTEGER DEFAULT 5,
    timeout_seconds INTEGER DEFAULT 30,
    retry_count INTEGER DEFAULT 3,
    
    -- Alerting
    alert_on_failure BOOLEAN DEFAULT true,
    alert_threshold INTEGER DEFAULT 3, -- consecutive failures before alert
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Status Pages
CREATE TABLE public.status_pages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Page details
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    
    -- Configuration
    is_public BOOLEAN DEFAULT true,
    custom_domain VARCHAR(255),
    
    -- Branding
    logo_url TEXT,
    primary_color VARCHAR(7),
    custom_css TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    
    UNIQUE(organization_id, slug)
);

-- Status Page Services (many-to-many)
CREATE TABLE public.status_page_services (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES public.status_pages(id) ON DELETE CASCADE,
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    sort_order INTEGER DEFAULT 0,
    display_uptime BOOLEAN DEFAULT true,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(status_page_id, service_id)
);

-- Incidents
CREATE TABLE public.incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    service_id UUID REFERENCES public.services(id),
    
    -- Incident details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) NOT NULL DEFAULT 'investigating' CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    severity VARCHAR(50) NOT NULL DEFAULT 'medium' CHECK (severity IN ('low', 'medium', 'high', 'critical')),
    
    -- Assignment
    assigned_to UUID REFERENCES public.users(id),
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Timing
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Public communication
    is_public BOOLEAN DEFAULT true,
    public_message TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Incident Updates
CREATE TABLE public.incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES public.incidents(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Update details
    status VARCHAR(50) NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved')),
    message TEXT NOT NULL,
    is_public BOOLEAN DEFAULT true,
    
    -- Author
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Notifications
CREATE TABLE public.notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    
    -- Notification content
    type VARCHAR(100) NOT NULL, -- 'incident', 'service_down', 'invitation', etc.
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    data JSONB DEFAULT '{}',
    
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

-- Status Updates (public incident communications)
CREATE TABLE public.status_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES public.status_pages(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES public.incidents(id),
    
    -- Update details
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'maintenance')),
    
    -- Publishing
    is_published BOOLEAN DEFAULT false,
    published_at TIMESTAMP WITH TIME ZONE,
    
    -- Author
    created_by UUID NOT NULL REFERENCES public.users(id),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscriptions (for status page notifications)
CREATE TABLE public.subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES public.status_pages(id) ON DELETE CASCADE,
    
    -- Subscriber details
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20),
    
    -- Subscription preferences
    notify_incidents BOOLEAN DEFAULT true,
    notify_maintenance BOOLEAN DEFAULT true,
    notify_updates BOOLEAN DEFAULT true,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    confirmed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    unsubscribe_token VARCHAR(255) UNIQUE DEFAULT gen_random_uuid(),
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(status_page_id, email)
);

-- Service Uptime Records (monitoring results)
CREATE TABLE public.service_uptime_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Check results
    status VARCHAR(50) NOT NULL CHECK (status IN ('up', 'down', 'degraded')),
    response_time_ms INTEGER,
    status_code INTEGER,
    error_message TEXT,
    
    -- Metadata
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- SLA Tracking
CREATE TABLE public.sla_records (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- SLA period
    period_start TIMESTAMP WITH TIME ZONE NOT NULL,
    period_end TIMESTAMP WITH TIME ZONE NOT NULL,
    
    -- Metrics
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    uptime_percentage DECIMAL(5,2) DEFAULT 0.00,
    average_response_time_ms DECIMAL(10,2) DEFAULT 0.00,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Activity History (Audit Log)
CREATE TABLE public.activity_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
    
    -- Actor information
    actor_id UUID REFERENCES public.users(id),
    actor_type VARCHAR(50) DEFAULT 'user' CHECK (actor_type IN ('user', 'system', 'api')),
    
    -- Action details
    action VARCHAR(100) NOT NULL, -- 'created', 'updated', 'deleted', 'invited', etc.
    entity_type VARCHAR(100) NOT NULL, -- 'user', 'organization', 'service', etc.
    entity_id UUID, -- ID of the affected entity
    entity_name VARCHAR(255), -- Human-readable name
    
    -- Change tracking
    old_values JSONB DEFAULT '{}',
    new_values JSONB DEFAULT '{}',
    changes JSONB DEFAULT '{}',
    
    -- Context
    ip_address INET,
    user_agent TEXT,
    
    -- Metadata
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- ============================================================================
-- INDEXES FOR PERFORMANCE
-- ============================================================================

-- Users
CREATE INDEX idx_users_email ON public.users(email);
CREATE INDEX idx_users_google_oauth_id ON public.users(google_oauth_id);
CREATE INDEX idx_users_is_active ON public.users(is_active);

-- Organizations
CREATE INDEX idx_organizations_slug ON public.organizations(slug);
CREATE INDEX idx_organizations_domain ON public.organizations(domain);
CREATE INDEX idx_organizations_subdomain ON public.organizations(subdomain);

-- Organization Members
CREATE INDEX idx_org_members_org_id ON public.organization_members(organization_id);
CREATE INDEX idx_org_members_user_id ON public.organization_members(user_id);
CREATE INDEX idx_org_members_role ON public.organization_members(role);

-- Services
CREATE INDEX idx_services_org_id ON public.services(organization_id);
CREATE INDEX idx_services_status ON public.services(status);
CREATE INDEX idx_services_sort_order ON public.services(sort_order);

-- Service Monitoring
CREATE INDEX idx_service_monitoring_service_id ON public.service_monitoring(service_id);
CREATE INDEX idx_service_monitoring_enabled ON public.service_monitoring(enabled);

-- Incidents
CREATE INDEX idx_incidents_org_id ON public.incidents(organization_id);
CREATE INDEX idx_incidents_service_id ON public.incidents(service_id);
CREATE INDEX idx_incidents_status ON public.incidents(status);
CREATE INDEX idx_incidents_created_at ON public.incidents(created_at);

-- Status Pages
CREATE INDEX idx_status_pages_org_id ON public.status_pages(organization_id);
CREATE INDEX idx_status_pages_slug ON public.status_pages(slug);
CREATE INDEX idx_status_pages_is_public ON public.status_pages(is_public);

-- Notifications
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX idx_notifications_org_id ON public.notifications(organization_id);
CREATE INDEX idx_notifications_is_read ON public.notifications(is_read);
CREATE INDEX idx_notifications_created_at ON public.notifications(created_at);

-- ============================================================================
-- TRIGGERS FOR UPDATED_AT TIMESTAMPS
-- ============================================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply triggers to tables with updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON public.organizations FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON public.organization_members FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON public.services FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_service_monitoring_updated_at BEFORE UPDATE ON public.service_monitoring FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON public.incidents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_status_pages_updated_at BEFORE UPDATE ON public.status_pages FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_notifications_updated_at BEFORE UPDATE ON public.notifications FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_status_updates_updated_at BEFORE UPDATE ON public.status_updates FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_subscriptions_updated_at BEFORE UPDATE ON public.subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_sla_records_updated_at BEFORE UPDATE ON public.sla_records FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================================
-- INITIAL DATA - SUBSCRIPTION PLANS
-- ============================================================================

INSERT INTO public.subscription_plans (name, description, price_monthly, price_yearly, max_team_members, max_services, max_status_pages, features) VALUES
('free', 'Free plan with basic monitoring', 0, 0, 3, 5, 1, '["basic_monitoring", "email_notifications", "1_status_page", "uptime_monitoring"]'),
('pro', 'Professional plan with advanced features', 29.99, 299.99, 10, 25, 5, '["advanced_monitoring", "custom_branding", "multiple_status_pages", "sla_tracking", "api_access", "phone_notifications", "escalation_policies"]'),
('enterprise', 'Enterprise plan with unlimited features', 99.99, 999.99, NULL, NULL, NULL, '["unlimited_monitoring", "white_label", "unlimited_status_pages", "advanced_sla", "priority_support", "custom_integrations", "dedicated_account_manager", "custom_reporting"]');

-- ============================================================================
-- SAMPLE DATA FOR DEVELOPMENT
-- ============================================================================

-- Sample Users
INSERT INTO public.users (id, email, name, avatar_url, timezone) VALUES 
('10000000-1000-4000-8000-100000000001', 'admin@alert24.com', 'Alert24 Admin', 'https://ui-avatars.com/api/?name=Alert24+Admin&background=3B82F6&color=fff', 'America/New_York'),
('20000000-2000-4000-8000-200000000002', 'demo@alert24.com', 'Demo User', 'https://ui-avatars.com/api/?name=Demo+User&background=059669&color=fff', 'UTC'),
('30000000-3000-4000-8000-300000000003', 'support@alert24.com', 'Support Team', 'https://ui-avatars.com/api/?name=Support+Team&background=DC2626&color=fff', 'America/Los_Angeles');

-- Sample Organizations
INSERT INTO public.organizations (id, name, slug, subscription_plan, primary_color, secondary_color, max_team_members, max_services, max_status_pages) VALUES 
('a0000000-a000-4000-8000-a00000000001', 'Alert24 Demo Company', 'alert24-demo', 'pro', '#3B82F6', '#64748B', 10, 25, 5),
('b0000000-b000-4000-8000-b00000000002', 'Acme Corporation', 'acme-corp', 'enterprise', '#059669', '#374151', NULL, NULL, NULL),
('c0000000-c000-4000-8000-c00000000003', 'Startup Inc', 'startup-inc', 'free', '#DC2626', '#6B7280', 3, 5, 1);

-- Organization Members
INSERT INTO public.organization_members (organization_id, user_id, role, is_active, accepted_at) VALUES 
('a0000000-a000-4000-8000-a00000000001', '10000000-1000-4000-8000-100000000001', 'owner', true, NOW()),
('a0000000-a000-4000-8000-a00000000001', '20000000-2000-4000-8000-200000000002', 'admin', true, NOW()),
('b0000000-b000-4000-8000-b00000000002', '20000000-2000-4000-8000-200000000002', 'owner', true, NOW()),
('b0000000-b000-4000-8000-b00000000002', '30000000-3000-4000-8000-300000000003', 'member', true, NOW()),
('c0000000-c000-4000-8000-c00000000003', '30000000-3000-4000-8000-300000000003', 'owner', true, NOW());

-- Sample Services
INSERT INTO public.services (id, organization_id, name, description, url, status, service_type, sort_order) VALUES 
-- Alert24 Demo Company services
('s1000000-1000-4000-8000-s10000000001', 'a0000000-a000-4000-8000-a00000000001', 'Main Website', 'Company website and marketing pages', 'https://alert24.com', 'operational', 'http', 1),
('s2000000-2000-4000-8000-s20000000002', 'a0000000-a000-4000-8000-a00000000001', 'API Gateway', 'REST API for all services', 'https://api.alert24.com', 'operational', 'http', 2),
('s3000000-3000-4000-8000-s30000000003', 'a0000000-a000-4000-8000-a00000000001', 'User Dashboard', 'Customer dashboard application', 'https://app.alert24.com', 'operational', 'http', 3),
('s4000000-4000-4000-8000-s40000000004', 'a0000000-a000-4000-8000-a00000000001', 'Database Cluster', 'Primary database infrastructure', 'db.alert24.com', 'operational', 'tcp', 4),

-- Acme Corporation services
('s5000000-5000-4000-8000-s50000000005', 'b0000000-b000-4000-8000-b00000000002', 'E-commerce Site', 'Online store and shopping cart', 'https://shop.acme.com', 'operational', 'http', 1),
('s6000000-6000-4000-8000-s60000000006', 'b0000000-b000-4000-8000-b00000000002', 'Payment Gateway', 'Payment processing system', 'https://payments.acme.com', 'degraded', 'http', 2),
('s7000000-7000-4000-8000-s70000000007', 'b0000000-b000-4000-8000-b00000000002', 'Inventory System', 'Product inventory management', 'https://inventory.acme.com', 'operational', 'http', 3),

-- Startup Inc services
('s8000000-8000-4000-8000-s80000000008', 'c0000000-c000-4000-8000-c00000000003', 'Landing Page', 'Marketing website', 'https://startup.example.com', 'operational', 'http', 1),
('s9000000-9000-4000-8000-s90000000009', 'c0000000-c000-4000-8000-c00000000003', 'Beta App', 'MVP application', 'https://app.startup.example.com', 'maintenance', 'http', 2);

-- Sample Status Pages
INSERT INTO public.status_pages (id, organization_id, name, slug, description, is_public, primary_color) VALUES 
('p1000000-1000-4000-8000-p10000000001', 'a0000000-a000-4000-8000-a00000000001', 'Alert24 System Status', 'alert24-status', 'Real-time status of Alert24 services and infrastructure', true, '#3B82F6'),
('p2000000-2000-4000-8000-p20000000002', 'b0000000-b000-4000-8000-b00000000002', 'Acme Services Status', 'acme-status', 'Current status of all Acme Corporation services', true, '#059669'),
('p3000000-3000-4000-8000-p30000000003', 'c0000000-c000-4000-8000-c00000000003', 'Startup Status', 'startup-status', 'Service status for Startup Inc', true, '#DC2626');

-- Link Services to Status Pages
INSERT INTO public.status_page_services (status_page_id, service_id, sort_order) VALUES 
-- Alert24 status page
('p1000000-1000-4000-8000-p10000000001', 's1000000-1000-4000-8000-s10000000001', 1),
('p1000000-1000-4000-8000-p10000000001', 's2000000-2000-4000-8000-s20000000002', 2),
('p1000000-1000-4000-8000-p10000000001', 's3000000-3000-4000-8000-s30000000003', 3),
('p1000000-1000-4000-8000-p10000000001', 's4000000-4000-4000-8000-s40000000004', 4),

-- Acme status page
('p2000000-2000-4000-8000-p20000000002', 's5000000-5000-4000-8000-s50000000005', 1),
('p2000000-2000-4000-8000-p20000000002', 's6000000-6000-4000-8000-s60000000006', 2),
('p2000000-2000-4000-8000-p20000000002', 's7000000-7000-4000-8000-s70000000007', 3),

-- Startup status page
('p3000000-3000-4000-8000-p30000000003', 's8000000-8000-4000-8000-s80000000008', 1),
('p3000000-3000-4000-8000-p30000000003', 's9000000-9000-4000-8000-s90000000009', 2);

-- Sample Incidents
INSERT INTO public.incidents (id, organization_id, service_id, title, description, status, severity, created_by, started_at, resolved_at, is_public) VALUES 
('i1000000-1000-4000-8000-i10000000001', 'b0000000-b000-4000-8000-b00000000002', 's6000000-6000-4000-8000-s60000000006', 'Payment Gateway Slowness', 'Users experiencing slow response times when processing payments', 'identified', 'high', '20000000-2000-4000-8000-200000000002', NOW() - INTERVAL '2 hours', NULL, true),
('i2000000-2000-4000-8000-i20000000002', 'c0000000-c000-4000-8000-c00000000003', 's9000000-9000-4000-8000-s90000000009', 'Scheduled Maintenance', 'Upgrading database infrastructure', 'monitoring', 'low', '30000000-3000-4000-8000-300000000003', NOW() - INTERVAL '30 minutes', NULL, true);

-- Sample Notifications
INSERT INTO public.notifications (organization_id, user_id, type, title, message, action_url, is_read) VALUES 
('b0000000-b000-4000-8000-b00000000002', '20000000-2000-4000-8000-200000000002', 'incident', 'New Incident: Payment Gateway Slowness', 'A new high-severity incident has been reported for the Payment Gateway service.', '/incidents/i1000000-1000-4000-8000-i10000000001', false),
('c0000000-c000-4000-8000-c00000000003', '30000000-3000-4000-8000-300000000003', 'maintenance', 'Maintenance Window Started', 'Scheduled maintenance for Beta App has begun.', '/incidents/i2000000-2000-4000-8000-i20000000002', true),
('a0000000-a000-4000-8000-a00000000001', '10000000-1000-4000-8000-100000000001', 'system', 'Welcome to Alert24!', 'Your Alert24 account has been set up successfully. Start by adding your first service to monitor.', '/services/new', false);

-- Sample Subscriptions
INSERT INTO public.subscriptions (status_page_id, email, notify_incidents, notify_maintenance, confirmed_at) VALUES 
('p1000000-1000-4000-8000-p10000000001', 'subscriber@example.com', true, true, NOW() - INTERVAL '1 day'),
('p2000000-2000-4000-8000-p20000000002', 'admin@acme.com', true, true, NOW() - INTERVAL '1 week'),
('p3000000-3000-4000-8000-p30000000003', 'team@startup.example.com', true, true, NOW() - INTERVAL '2 days');

-- ============================================================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_monitoring ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_page_services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.service_uptime_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sla_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.activity_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for multi-tenant data isolation

-- Users can view/edit their own profile
CREATE POLICY "Users can view own profile" ON public.users
    FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can update own profile" ON public.users
    FOR UPDATE USING (auth.uid() = id);

-- Organizations: Users can only see organizations they're members of
CREATE POLICY "Users can view their organizations" ON public.organizations
    FOR SELECT USING (
        id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Services: Users can only see services from their organizations
CREATE POLICY "Users can view organization services" ON public.services
    FOR SELECT USING (
        organization_id IN (
            SELECT organization_id FROM public.organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Public status pages should be viewable by anyone
CREATE POLICY "Public status pages are viewable" ON public.status_pages
    FOR SELECT USING (is_public = true);

-- Status updates for public pages should be viewable by anyone
CREATE POLICY "Public status updates are viewable" ON public.status_updates
    FOR SELECT USING (
        status_page_id IN (
            SELECT id FROM public.status_pages WHERE is_public = true
        )
    );

-- Public subscriptions can be created by anyone
CREATE POLICY "Anyone can subscribe to public status pages" ON public.subscriptions
    FOR INSERT WITH CHECK (
        status_page_id IN (
            SELECT id FROM public.status_pages WHERE is_public = true
        )
    );

-- ============================================================================
-- SETUP COMPLETE MESSAGE
-- ============================================================================

DO $$
BEGIN
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'ALERT24 SUPABASE SETUP COMPLETE!';
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'Tables created: %', (
        SELECT count(*) FROM information_schema.tables 
        WHERE table_schema = 'public' 
        AND table_name IN (
            'users', 'organizations', 'organization_members', 'services', 
            'service_monitoring', 'incidents', 'status_pages', 'notifications',
            'subscriptions', 'status_updates', 'activity_history'
        )
    );
    RAISE NOTICE 'Sample organizations: %', (SELECT count(*) FROM public.organizations);
    RAISE NOTICE 'Sample users: %', (SELECT count(*) FROM public.users);
    RAISE NOTICE 'Sample services: %', (SELECT count(*) FROM public.services);
    RAISE NOTICE 'Sample status pages: %', (SELECT count(*) FROM public.status_pages);
    RAISE NOTICE '============================================================================';
    RAISE NOTICE 'You can now test your app at: http://localhost:3000/api/test-supabase';
    RAISE NOTICE 'Sample status page: http://localhost:3000/status/alert24-status';
    RAISE NOTICE '============================================================================';
END $$; 