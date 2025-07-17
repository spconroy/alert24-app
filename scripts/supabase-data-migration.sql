-- Alert24 Data Migration to Supabase
-- This script only migrates data, does not modify table structure
-- Run this in Supabase SQL Editor

-- Enable required extensions if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create custom types if they don't exist
DO $$ BEGIN
    CREATE TYPE incident_role AS ENUM ('viewer', 'responder', 'manager', 'admin');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- Disable RLS temporarily for data migration
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE organizations DISABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages DISABLE ROW LEVEL SECURITY;
ALTER TABLE services DISABLE ROW LEVEL SECURITY;
ALTER TABLE incidents DISABLE ROW LEVEL SECURITY;

-- Insert Users (use ON CONFLICT to avoid duplicates)
INSERT INTO users (id, email, name, avatar_url, google_oauth_id, google_id, password, timezone, language, email_notifications_enabled, push_notifications_enabled, is_active, last_login_at, created_at, updated_at, deleted_at, incident_role, is_on_call, current_on_call_schedule_id, phone_number, slack_user_id, teams_user_id, notification_preferences) 
VALUES 
('3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'sean@inventivehq.com', 'Sean Conroy', null, null, null, '$2b$10$im8ZAx7EUsVJAQ2VSWdk.e1ZmxSWzrN3OIA8aMZGl9gOv.dj9KBGO', 'America/Los_Angeles', 'en', true, true, true, null, '2025-07-03T17:36:43.684Z', '2025-07-07T02:23:36.602Z', null, 'viewer', false, null, '+17073269485', null, null, '{"sms_critical": true, "email_incidents": true, "sms_escalations": true, "email_escalations": true}'),
('a3169d26-2691-445b-8298-a58efe976c09', 'sean@econroy.com', 'sean@econroy.com', null, null, null, null, 'UTC', 'en', true, true, true, null, '2025-07-07T02:13:18.541Z', '2025-07-07T02:13:18.541Z', null, 'viewer', false, null, null, null, null, '{}')
ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    name = EXCLUDED.name,
    avatar_url = EXCLUDED.avatar_url,
    google_oauth_id = EXCLUDED.google_oauth_id,
    google_id = EXCLUDED.google_id,
    password = EXCLUDED.password,
    timezone = EXCLUDED.timezone,
    language = EXCLUDED.language,
    email_notifications_enabled = EXCLUDED.email_notifications_enabled,
    push_notifications_enabled = EXCLUDED.push_notifications_enabled,
    is_active = EXCLUDED.is_active,
    last_login_at = EXCLUDED.last_login_at,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at,
    incident_role = EXCLUDED.incident_role,
    is_on_call = EXCLUDED.is_on_call,
    current_on_call_schedule_id = EXCLUDED.current_on_call_schedule_id,
    phone_number = EXCLUDED.phone_number,
    slack_user_id = EXCLUDED.slack_user_id,
    teams_user_id = EXCLUDED.teams_user_id,
    notification_preferences = EXCLUDED.notification_preferences;

-- Insert Organizations
INSERT INTO organizations (id, name, slug, domain, subdomain, logo_url, primary_color, secondary_color, custom_css, subscription_plan, stripe_customer_id, stripe_subscription_id, subscription_status, current_period_start, current_period_end, max_team_members, max_projects, created_at, updated_at, deleted_at) 
VALUES 
('5e4107b7-9a16-4555-9bf2-c10ce9684e98', 'TestOrg1', 'testorg1', 'testorg1.alert24.com', null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T18:58:26.853Z', '2025-07-03T18:58:26.853Z', null),
('8b2e7859-1dc9-4de3-99d4-ee777f99adc5', 'Your Organization', 'your-org', null, null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T19:41:05.332Z', '2025-07-03T19:41:05.332Z', null),
('e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', 'Org1', 'org1', 'org1.alert24.com', null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T19:44:03.116Z', '2025-07-03T19:44:03.116Z', null),
('80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'My Amazing Company', 'my-amazing-company', null, null, null, null, null, null, 'free', null, null, 'active', null, null, 3, 5, '2025-07-03T20:53:00.934Z', '2025-07-03T20:53:00.934Z', null)
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    domain = EXCLUDED.domain,
    subdomain = EXCLUDED.subdomain,
    logo_url = EXCLUDED.logo_url,
    primary_color = EXCLUDED.primary_color,
    secondary_color = EXCLUDED.secondary_color,
    custom_css = EXCLUDED.custom_css,
    subscription_plan = EXCLUDED.subscription_plan,
    stripe_customer_id = EXCLUDED.stripe_customer_id,
    stripe_subscription_id = EXCLUDED.stripe_subscription_id,
    subscription_status = EXCLUDED.subscription_status,
    current_period_start = EXCLUDED.current_period_start,
    current_period_end = EXCLUDED.current_period_end,
    max_team_members = EXCLUDED.max_team_members,
    max_projects = EXCLUDED.max_projects,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

-- Insert Organization Members
INSERT INTO organization_members (id, organization_id, user_id, role, invited_by, invited_at, accepted_at, invitation_token, invitation_expires_at, is_active, created_at, updated_at) 
VALUES 
('5e8d1777-c2df-4f78-8a78-06daac3bf747', 'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'owner', null, '2025-07-03T19:44:03.163Z', null, null, null, true, '2025-07-03T19:44:03.163Z', '2025-07-03T19:44:03.163Z'),
('a50c2108-4b9a-4b50-b4fc-b8cc744da84d', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'owner', null, '2025-07-03T20:53:00.978Z', null, null, null, true, '2025-07-03T20:53:00.978Z', '2025-07-03T20:53:00.978Z'),
('fd890658-d48a-4d1b-b3d9-cb45f770f749', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'a3169d26-2691-445b-8298-a58efe976c09', 'member', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-07T02:13:18.541Z', null, '41c65a8811d5e62b2cadc0cbd4763e1f2080443786d31bc65203a1e34f1a104b', '2025-07-14T02:13:18.441Z', false, '2025-07-07T02:13:18.541Z', '2025-07-07T02:13:18.541Z')
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    invited_at = EXCLUDED.invited_at,
    accepted_at = EXCLUDED.accepted_at,
    invitation_token = EXCLUDED.invitation_token,
    invitation_expires_at = EXCLUDED.invitation_expires_at,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at;

-- Insert Status Pages
INSERT INTO status_pages (id, organization_id, name, slug, description, is_public, created_at, updated_at, deleted_at) 
VALUES 
('57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c', 'Test Page 1', 'test-page-1', 'test page 1', true, '2025-07-03T19:50:23.440Z', '2025-07-03T19:50:23.440Z', null),
('26242a8f-3b68-43e1-b546-edffd3b006e7', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'Company Services', 'company-services', null, true, '2025-07-03T20:53:17.756Z', '2025-07-03T20:53:17.756Z', null)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

-- Insert Services
INSERT INTO services (id, status_page_id, name, description, status, sort_order, created_at, updated_at, deleted_at) 
VALUES 
('1251f44c-c6af-41da-83d7-4d18b2b0506f', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 1', 'important service', 'operational', 0, '2025-07-03T20:07:20.231Z', '2025-07-03T20:07:20.231Z', null),
('1c5fd4d5-82a9-403c-9fe1-4d2dd22e3cb5', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 2', null, 'degraded', 0, '2025-07-03T20:15:44.950Z', '2025-07-03T20:15:44.950Z', null),
('819b5437-61b5-4011-82e2-9d7e7f85e352', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'Service 3', null, 'down', 0, '2025-07-03T20:15:52.338Z', '2025-07-03T20:15:52.338Z', null)
ON CONFLICT (id) DO UPDATE SET
    status_page_id = EXCLUDED.status_page_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at;

-- Insert Incidents
INSERT INTO incidents (id, organization_id, title, description, severity, status, affected_services, impact_description, assigned_to, created_by, source, source_id, started_at, acknowledged_at, resolved_at, escalation_level, escalated_at, escalation_policy_id, tags, external_id, created_at, updated_at) 
VALUES 
('7328c354-ee8c-4c6a-8786-f16db71440c0', '5e4107b7-9a16-4555-9bf2-c10ce9684e98', 'Test Incident - Schema Deployment Complete', 'This is a test incident created to verify the new incident management schema is working correctly.', 'medium', 'open', null, null, null, '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'manual', null, '2025-07-06T21:11:33.117Z', null, null, 0, null, null, null, null, '2025-07-06T21:11:33.117Z', '2025-07-06T21:11:33.117Z')
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    title = EXCLUDED.title,
    description = EXCLUDED.description,
    severity = EXCLUDED.severity,
    status = EXCLUDED.status,
    affected_services = EXCLUDED.affected_services,
    impact_description = EXCLUDED.impact_description,
    assigned_to = EXCLUDED.assigned_to,
    created_by = EXCLUDED.created_by,
    source = EXCLUDED.source,
    source_id = EXCLUDED.source_id,
    started_at = EXCLUDED.started_at,
    acknowledged_at = EXCLUDED.acknowledged_at,
    resolved_at = EXCLUDED.resolved_at,
    escalation_level = EXCLUDED.escalation_level,
    escalated_at = EXCLUDED.escalated_at,
    escalation_policy_id = EXCLUDED.escalation_policy_id,
    tags = EXCLUDED.tags,
    external_id = EXCLUDED.external_id,
    updated_at = EXCLUDED.updated_at;

-- Re-enable RLS
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE status_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE services ENABLE ROW LEVEL SECURITY;
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;

-- Create/Update RLS policies (safe to run multiple times)
DROP POLICY IF EXISTS "Users can view own profile" ON users;
CREATE POLICY "Users can view own profile" ON users FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update own profile" ON users;
CREATE POLICY "Users can update own profile" ON users FOR UPDATE USING (auth.uid() = id);

-- Allow anonymous access to public status pages and services for now
DROP POLICY IF EXISTS "Public status pages viewable by all" ON status_pages;
CREATE POLICY "Public status pages viewable by all" ON status_pages FOR SELECT USING (is_public = true);

DROP POLICY IF EXISTS "Public services viewable by all" ON services;
CREATE POLICY "Public services viewable by all" ON services FOR SELECT USING (
    status_page_id IN (SELECT id FROM status_pages WHERE is_public = true)
);

-- Organization access (simplified to avoid recursion issues)
DROP POLICY IF EXISTS "Users can view organizations they belong to" ON organizations;
CREATE POLICY "Users can view organizations they belong to" ON organizations FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = organizations.id 
        AND user_id = auth.uid()
        AND is_active = true
    )
);

DROP POLICY IF EXISTS "Users can view their memberships" ON organization_members;
CREATE POLICY "Users can view their memberships" ON organization_members FOR SELECT USING (
    user_id = auth.uid() OR 
    EXISTS (
        SELECT 1 FROM organization_members om 
        WHERE om.organization_id = organization_members.organization_id 
        AND om.user_id = auth.uid() 
        AND om.is_active = true
    )
);

-- Incidents access
DROP POLICY IF EXISTS "Organization members can view incidents" ON incidents;
CREATE POLICY "Organization members can view incidents" ON incidents FOR SELECT USING (
    EXISTS (
        SELECT 1 FROM organization_members 
        WHERE organization_id = incidents.organization_id 
        AND user_id = auth.uid()
        AND is_active = true
    )
);

-- Show migration results
SELECT 
    'Alert24 data migration completed!' as message,
    (SELECT count(*) FROM users) as user_count,
    (SELECT count(*) FROM organizations) as org_count,
    (SELECT count(*) FROM organization_members) as membership_count,
    (SELECT count(*) FROM status_pages) as status_page_count,
    (SELECT count(*) FROM services) as service_count,
    (SELECT count(*) FROM incidents) as incident_count; 