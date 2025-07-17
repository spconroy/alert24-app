-- Alert24 Supabase Migration - Complete Schema and Data Import
-- Based on existing PostgreSQL database structure
-- Run this in Supabase SQL Editor

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop existing tables if they exist (for clean migration)
DROP TABLE IF EXISTS activity_history CASCADE;
DROP TABLE IF EXISTS billing_history CASCADE;
DROP TABLE IF EXISTS check_results CASCADE;
DROP TABLE IF EXISTS escalation_policies CASCADE;
DROP TABLE IF EXISTS incident_updates CASCADE;
DROP TABLE IF EXISTS incidents CASCADE;
DROP TABLE IF EXISTS monitoring_checks CASCADE;
DROP TABLE IF EXISTS monitoring_locations CASCADE;
DROP TABLE IF EXISTS notifications CASCADE;
DROP TABLE IF EXISTS on_call_schedules CASCADE;
DROP TABLE IF EXISTS organization_members CASCADE;
DROP TABLE IF EXISTS organizations CASCADE;
DROP TABLE IF EXISTS project_members CASCADE;
DROP TABLE IF EXISTS projects CASCADE;
DROP TABLE IF EXISTS realtime_channels CASCADE;
DROP TABLE IF EXISTS service_monitoring_checks CASCADE;
DROP TABLE IF EXISTS service_status_history CASCADE;
DROP TABLE IF EXISTS services CASCADE;
DROP TABLE IF EXISTS status_pages CASCADE;
DROP TABLE IF EXISTS status_updates CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_contact_methods CASCADE;
DROP TABLE IF EXISTS user_sessions CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- Create custom types
CREATE TYPE incident_role AS ENUM ('viewer', 'responder', 'manager', 'admin');

-- 1. Users table
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email VARCHAR(255) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    avatar_url TEXT,
    google_oauth_id VARCHAR(255),
    google_id VARCHAR(255),
    password TEXT,
    timezone VARCHAR(50) DEFAULT 'UTC',
    language VARCHAR(10) DEFAULT 'en',
    email_notifications_enabled BOOLEAN DEFAULT true,
    push_notifications_enabled BOOLEAN DEFAULT true,
    is_active BOOLEAN DEFAULT true,
    last_login_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    incident_role incident_role DEFAULT 'viewer',
    is_on_call BOOLEAN DEFAULT false,
    current_on_call_schedule_id UUID,
    phone_number VARCHAR(50),
    slack_user_id VARCHAR(255),
    teams_user_id VARCHAR(255),
    notification_preferences JSONB DEFAULT '{}'
);

-- 2. Organizations table
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,
    domain VARCHAR(255),
    subdomain VARCHAR(255),
    logo_url TEXT,
    primary_color VARCHAR(7),
    secondary_color VARCHAR(7),
    custom_css TEXT,
    subscription_plan VARCHAR(50) DEFAULT 'free',
    stripe_customer_id VARCHAR(255),
    stripe_subscription_id VARCHAR(255),
    subscription_status VARCHAR(50) DEFAULT 'active',
    current_period_start TIMESTAMP WITH TIME ZONE,
    current_period_end TIMESTAMP WITH TIME ZONE,
    max_team_members INTEGER DEFAULT 3,
    max_projects INTEGER DEFAULT 5,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 3. Organization members table
CREATE TABLE organization_members (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(50) NOT NULL DEFAULT 'member',
    invited_by UUID REFERENCES users(id),
    invited_at TIMESTAMP WITH TIME ZONE,
    accepted_at TIMESTAMP WITH TIME ZONE,
    invitation_token VARCHAR(255),
    invitation_expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(organization_id, user_id)
);

-- 4. Status pages table
CREATE TABLE status_pages (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) NOT NULL,
    description TEXT,
    is_public BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE,
    UNIQUE(organization_id, slug)
);

-- 5. Services table
CREATE TABLE services (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'operational',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- 6. Incidents table
CREATE TABLE incidents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity VARCHAR(50),
    status VARCHAR(50) DEFAULT 'open',
    affected_services JSONB,
    impact_description TEXT,
    assigned_to UUID REFERENCES users(id),
    created_by UUID REFERENCES users(id),
    source VARCHAR(50),
    source_id VARCHAR(255),
    started_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_policy_id UUID,
    tags JSONB,
    external_id VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Incident updates table
CREATE TABLE incident_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id),
    message TEXT NOT NULL,
    status VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 8. Escalation policies table
CREATE TABLE escalation_policies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    escalation_rules JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 9. On-call schedules table
CREATE TABLE on_call_schedules (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    timezone VARCHAR(100) DEFAULT 'UTC',
    schedule_rules JSONB DEFAULT '[]',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 10. Notifications table
CREATE TABLE notifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    type VARCHAR(50) DEFAULT 'info',
    read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 11. Status updates table
CREATE TABLE status_updates (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id) ON DELETE SET NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    status VARCHAR(50) NOT NULL,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 12. Subscriptions table
CREATE TABLE subscriptions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    confirmed BOOLEAN DEFAULT false,
    confirmation_token VARCHAR(255),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(status_page_id, email)
);

-- 13. Additional tables for monitoring and tracking
CREATE TABLE service_monitoring_checks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    url TEXT,
    method VARCHAR(10) DEFAULT 'GET',
    headers JSONB DEFAULT '{}',
    body TEXT,
    timeout_seconds INTEGER DEFAULT 30,
    check_interval INTEGER DEFAULT 300,
    expected_status_code INTEGER DEFAULT 200,
    expected_response_body TEXT,
    follow_redirects BOOLEAN DEFAULT true,
    retry_count INTEGER DEFAULT 3,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE check_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    service_id UUID NOT NULL REFERENCES services(id) ON DELETE CASCADE,
    checked_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    status VARCHAR(50) NOT NULL,
    response_time INTEGER,
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE TABLE activity_history (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action VARCHAR(255) NOT NULL,
    resource_type VARCHAR(100),
    resource_id UUID,
    details JSONB DEFAULT '{}',
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert existing data
-- Users
INSERT INTO users (id, email, name, avatar_url, google_oauth_id, google_id, password, timezone, language, email_notifications_enabled, push_notifications_enabled, is_active, last_login_at, created_at, updated_at, deleted_at, incident_role, is_on_call, current_on_call_schedule_id, phone_number, slack_user_id, teams_user_id, notification_preferences) VALUES
('a3169d26-2691-445b-8298-a58efe976c09', 'sean@econroy.com', 'sean@econroy.com', null, null, null, null, 'UTC', 'en', true, true, true, null, '2025-07-07T02:13:18.541Z', '2025-07-07T02:13:18.541Z', null, 'viewer', false, null, null, null, null, '{}'),
('3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'sean@inventivehq.com', 'Sean Conroy', null, null, null, '$2b$10$im8ZAx7EUsVJAQ2VSWdk.e1ZmxSWzrN3OIA8aMZGl9gOv.dj9KBGO', 'America/Los_Angeles', 'en', true, true, true, null, '2025-07-03T17:36:43.684Z', '2025-07-07T02:23:36.602Z', null, 'viewer', false, null, '+17073269485', null, null, '{"sms_critical": true, "email_incidents": true, "sms_escalations": true, "email_escalations": true}');

-- Organizations
INSERT INTO organizations (id, name, slug, domain, subdomain, logo_url, primary_color, secondary_color, custom_css, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_start, current_period_end, max_team_members, max_projects, created_at, updated_at, deleted_at) VALUES
('5e4107b7-9a16-4555-9bf2-c10ce9684e98', 'TestOrg1', 'testorg1', 'testorg1.alert24.com', null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T18:58:26.853Z', '2025-07-03T18:58:26.853Z', null),
('8b2e7859-1dc9-4de3-99d4-ee777f99adc5', 'Your Organization', 'your-org', null, null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T19:41:05.332Z', '2025-07-03T19:41:05.332Z', null),
('e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', 'Org1', 'org1', 'org1.alert24.com', null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T19:44:03.116Z', '2025-07-03T19:44:03.116Z', null),
('80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'Test Organization', 'test-organization', null, null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T20:53:00.978Z', '2025-07-03T20:53:00.978Z', null);

-- Organization members
INSERT INTO organization_members (id, organization_id, user_id, role, invited_by, invited_at, accepted_at, invitation_token, invitation_expires_at, is_active, created_at, updated_at) VALUES
('5e8d1777-c2df-4f78-8a78-06daac3bf747', 'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'owner', null, '2025-07-03T19:44:03.163Z', null, null, null, true, '2025-07-03T19:44:03.163Z', '2025-07-03T19:44:03.163Z'),
('a50c2108-4b9a-4b50-b4fc-b8cc744da84d', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'owner', null, '2025-07-03T20:53:00.978Z', null, null, null, true, '2025-07-03T20:53:00.978Z', '2025-07-03T20:53:00.978Z'),
('fd890658-d48a-4d1b-b3d9-cb45f770f749', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'a3169d26-2691-445b-8298-a58efe976c09', 'member', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-07T02:13:18.541Z', null, '41c65a8811d5e62b2cadc0cbd4763e1f2080443786d31bc65203a1e34f1a104b', '2025-07-14T02:13:18.441Z', false, '2025-07-07T02:13:18.541Z', '2025-07-07T02:13:18.541Z');

-- Status pages
INSERT INTO status_pages (id, organization_id, name, slug, description, is_public, created_at, updated_at, deleted_at) VALUES
('57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', 'Test Page 1', 'test-page-1', 'test page 1', true, '2025-07-03T19:50:23.440Z', '2025-07-03T19:50:23.440Z', null),
('26242a8f-3b68-43e1-b546-edffd3b006e7', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'Company Services', 'company-services', null, true, '2025-07-03T20:53:17.756Z', '2025-07-03T20:53:17.756Z', null);

-- Services
INSERT INTO services (id, status_page_id, name, description, status, sort_order, created_at, updated_at, deleted_at) VALUES
('1251f44c-c6af-41da-83d7-4d18b2b0506f', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 1', 'important service', 'operational', 0, '2025-07-03T20:07:20.231Z', '2025-07-03T20:07:20.231Z', null),
('1c5fd4d5-82a9-403c-9fe1-4d2dd22e3cb5', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 2', null, 'degraded', 0, '2025-07-03T20:15:44.950Z', '2025-07-03T20:15:44.950Z', null),
('819b5437-61b5-4011-82e2-9d7e7f85e352', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 3', null, 'down', 0, '2025-07-03T20:15:52.338Z', '2025-07-03T20:15:52.338Z', null);

-- Incidents
INSERT INTO incidents (id, organization_id, title, description, severity, status, affected_services, impact_description, assigned_to, created_by, source, source_id, started_at, acknowledged_at, resolved_at, escalation_level, escalated_at, escalation_policy_id, tags, external_id, created_at, updated_at) VALUES
('7328c354-ee8c-4c6a-8786-f16db71440c0', '5e4107b7-9a16-4555-9bf2-c10ce9684e98', 'Test Incident - Schema Deployment Complete', 'This is a test incident created to verify the new incident management schema is working correctly.', 'medium', 'open', null, null, null, '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'manual', null, '2025-07-06T21:11:33.117Z', null, null, 0, null, null, null, null, '2025-07-06T21:11:33.117Z', '2025-07-06T21:11:33.117Z');

-- Create indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_google_id ON users(google_id);
CREATE INDEX idx_organizations_slug ON organizations(slug);
CREATE INDEX idx_organization_members_org_id ON organization_members(organization_id);
CREATE INDEX idx_organization_members_user_id ON organization_members(user_id);
CREATE INDEX idx_status_pages_org_id ON status_pages(organization_id);
CREATE INDEX idx_status_pages_slug ON status_pages(slug);
CREATE INDEX idx_services_status_page_id ON services(status_page_id);
CREATE INDEX idx_services_status ON services(status);
CREATE INDEX idx_incidents_org_id ON incidents(organization_id);
CREATE INDEX idx_incidents_status ON incidents(status);
CREATE INDEX idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX idx_notifications_user_id ON notifications(user_id);
CREATE INDEX idx_notifications_org_id ON notifications(organization_id);
CREATE INDEX idx_activity_history_org_id ON activity_history(organization_id);
CREATE INDEX idx_activity_history_user_id ON activity_history(user_id);
CREATE INDEX idx_check_results_service_id ON check_results(service_id);
CREATE INDEX idx_check_results_checked_at ON check_results(checked_at);

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Triggers for updated_at
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organizations_updated_at BEFORE UPDATE ON organizations FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_organization_members_updated_at BEFORE UPDATE ON organization_members FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_status_pages_updated_at BEFORE UPDATE ON status_pages FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_services_updated_at BEFORE UPDATE ON services FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON incidents FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_escalation_policies_updated_at BEFORE UPDATE ON escalation_policies FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_on_call_schedules_updated_at BEFORE UPDATE ON on_call_schedules FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_service_monitoring_checks_updated_at BEFORE UPDATE ON service_monitoring_checks FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE service_monitoring_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE activity_history ENABLE ROW LEVEL SECURITY;

-- Basic RLS policies for multi-tenant security
-- Users can see their own data
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Organization access based on membership
CREATE POLICY "Organization members can view org" ON organizations FOR SELECT 
USING (id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

CREATE POLICY "Organization members can view membership" ON organization_members FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Status pages can be viewed publicly if is_public = true, or by org members
CREATE POLICY "Public status pages viewable by all" ON status_pages FOR SELECT 
USING (is_public = true);

CREATE POLICY "Organization members can view org status pages" ON status_pages FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

-- Services access based on organization membership through status pages
CREATE POLICY "Organization members can view services" ON services FOR SELECT 
USING (status_page_id IN (SELECT id FROM status_pages WHERE organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid())));

-- Incidents access based on organization membership
CREATE POLICY "Organization members can view incidents" ON incidents FOR SELECT 
USING (organization_id IN (SELECT organization_id FROM organization_members WHERE user_id = auth.uid()));

SELECT 'Alert24 database migration completed successfully!' as message,
       'Tables created: ' || (SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public') as table_count,
       'Users migrated: ' || (SELECT count(*) FROM users) as user_count,
       'Organizations migrated: ' || (SELECT count(*) FROM organizations) as org_count; 