-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 01: Core Incident Management
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- INCIDENT SEVERITY ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE incident_severity AS ENUM (
        'critical',
        'high', 
        'medium',
        'low',
        'maintenance'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- INCIDENT STATUS ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE incident_status AS ENUM (
        'open',
        'investigating',
        'identified',
        'monitoring',
        'resolved',
        'postmortem'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- INCIDENTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Basic incident information
    title VARCHAR(255) NOT NULL,
    description TEXT,
    severity incident_severity NOT NULL DEFAULT 'medium',
    status incident_status NOT NULL DEFAULT 'open',
    
    -- Service impact
    affected_services TEXT[], -- Array of service names/IDs
    impact_description TEXT,
    
    -- Incident ownership
    assigned_to UUID REFERENCES users(id),
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Incident source
    source VARCHAR(50) DEFAULT 'manual', -- 'manual', 'monitoring', 'email', 'webhook'
    source_id VARCHAR(255), -- ID from source system (monitoring check, etc.)
    
    -- Timeline tracking
    started_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Escalation tracking
    escalation_level INTEGER DEFAULT 0,
    escalated_at TIMESTAMP WITH TIME ZONE,
    escalation_policy_id UUID, -- Will reference escalation_policies table
    
    -- Metadata
    tags TEXT[],
    external_id VARCHAR(255), -- For external system integration
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INCIDENT UPDATES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS incident_updates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Update content
    message TEXT NOT NULL,
    status incident_status, -- NULL if status unchanged
    
    -- Update metadata
    update_type VARCHAR(50) DEFAULT 'update', -- 'update', 'escalation', 'resolution', 'reopened'
    posted_by UUID NOT NULL REFERENCES users(id),
    
    -- Visibility settings
    visible_to_subscribers BOOLEAN DEFAULT true,
    visible_to_public BOOLEAN DEFAULT false,
    
    -- Communication tracking
    notified_channels TEXT[], -- Which channels were notified
    notification_sent_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ESCALATION POLICIES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Policy identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Policy configuration
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Escalation rules (JSON array)
    rules JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example rules structure:
    -- [
    --   {
    --     "level": 1,
    --     "delay_minutes": 5,
    --     "targets": [
    --       {"type": "user", "id": "user-uuid"},
    --       {"type": "schedule", "id": "schedule-uuid"}
    --     ],
    --     "channels": ["email", "sms"]
    --   }
    -- ]
    
    -- Conditions for policy activation
    conditions JSONB DEFAULT '{}'::jsonb,
    -- Example conditions:
    -- {
    --   "severities": ["critical", "high"],
    --   "services": ["api", "website"],
    --   "time_ranges": [{"start": "09:00", "end": "17:00", "days": ["mon", "tue"]}]
    -- }
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- NOTIFICATION RULES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS notification_rules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Rule identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Rule conditions
    conditions JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example conditions:
    -- {
    --   "severities": ["critical", "high"],
    --   "statuses": ["open", "investigating"],
    --   "services": ["api", "website"],
    --   "time_ranges": [{"start": "09:00", "end": "17:00"}]
    -- }
    
    -- Notification configuration
    channels JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example channels:
    -- [
    --   {
    --     "type": "email",
    --     "targets": ["user-uuid", "team-uuid"],
    --     "template": "incident_created"
    --   },
    --   {
    --     "type": "sms",
    --     "targets": ["user-uuid"],
    --     "template": "incident_critical"
    --   }
    -- ]
    
    -- Rate limiting
    rate_limit_minutes INTEGER DEFAULT 5,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- ON-CALL SCHEDULES TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS on_call_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Schedule identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    
    -- Schedule configuration
    timezone VARCHAR(50) NOT NULL DEFAULT 'UTC',
    schedule_type VARCHAR(50) NOT NULL DEFAULT 'rotation', -- 'rotation', 'manual', 'follow_the_sun'
    
    -- Rotation settings
    rotation_config JSONB DEFAULT '{}'::jsonb,
    -- Example rotation_config:
    -- {
    --   "type": "weekly",
    --   "start_time": "09:00",
    --   "duration_hours": 168,
    --   "handoff_time": "09:00"
    -- }
    
    -- Schedule members and order
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example members:
    -- [
    --   {"user_id": "user-uuid", "order": 1},
    --   {"user_id": "user-uuid", "order": 2}
    -- ]
    
    -- Override and vacation handling
    overrides JSONB DEFAULT '[]'::jsonb,
    -- Example overrides:
    -- [
    --   {
    --     "user_id": "user-uuid",
    --     "start_time": "2024-01-01T09:00:00Z",
    --     "end_time": "2024-01-07T09:00:00Z",
    --     "reason": "vacation"
    --   }
    -- ]
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- INCIDENT ESCALATIONS TABLE (tracking escalation history)
-- =====================================================

CREATE TABLE IF NOT EXISTS incident_escalations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    escalation_policy_id UUID REFERENCES escalation_policies(id),
    
    -- Escalation details
    level INTEGER NOT NULL,
    triggered_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    triggered_by VARCHAR(50) DEFAULT 'system', -- 'system', 'manual', 'timeout'
    
    -- Escalation targets
    targets JSONB NOT NULL DEFAULT '[]'::jsonb,
    -- Example targets:
    -- [
    --   {"type": "user", "id": "user-uuid", "notified": true, "acknowledged": false},
    --   {"type": "schedule", "id": "schedule-uuid", "current_user": "user-uuid"}
    -- ]
    
    -- Escalation status
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'notified', 'acknowledged', 'timeout'
    acknowledged_by UUID REFERENCES users(id),
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    
    -- Timeout configuration
    timeout_minutes INTEGER DEFAULT 15,
    timeout_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CONSTRAINTS AND INDEXES
-- =====================================================

-- Unique constraints
ALTER TABLE escalation_policies 
ADD CONSTRAINT unique_default_policy_per_org 
EXCLUDE (organization_id WITH =) WHERE (is_default = true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_incidents_organization_id ON incidents(organization_id);
CREATE INDEX IF NOT EXISTS idx_incidents_status ON incidents(status);
CREATE INDEX IF NOT EXISTS idx_incidents_severity ON incidents(severity);
CREATE INDEX IF NOT EXISTS idx_incidents_assigned_to ON incidents(assigned_to);
CREATE INDEX IF NOT EXISTS idx_incidents_created_at ON incidents(created_at);
CREATE INDEX IF NOT EXISTS idx_incidents_source ON incidents(source, source_id);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_id ON incident_updates(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_updates_created_at ON incident_updates(created_at);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_organization_id ON escalation_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_is_active ON escalation_policies(is_active);

CREATE INDEX IF NOT EXISTS idx_notification_rules_organization_id ON notification_rules(organization_id);
CREATE INDEX IF NOT EXISTS idx_notification_rules_is_active ON notification_rules(is_active);

CREATE INDEX IF NOT EXISTS idx_on_call_schedules_organization_id ON on_call_schedules(organization_id);
CREATE INDEX IF NOT EXISTS idx_on_call_schedules_is_active ON on_call_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_incident_escalations_incident_id ON incident_escalations(incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_status ON incident_escalations(status);
CREATE INDEX IF NOT EXISTS idx_incident_escalations_timeout_at ON incident_escalations(timeout_at);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE incidents IS 'Core incident tracking table';
COMMENT ON TABLE incident_updates IS 'Timeline updates for incidents';
COMMENT ON TABLE escalation_policies IS 'Escalation policy configuration';
COMMENT ON TABLE notification_rules IS 'Notification routing rules';
COMMENT ON TABLE on_call_schedules IS 'On-call schedule management';
COMMENT ON TABLE incident_escalations IS 'Escalation history and tracking';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions (adjust as needed for your setup)
GRANT SELECT, INSERT, UPDATE, DELETE ON incidents TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_updates TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON escalation_policies TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON notification_rules TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON on_call_schedules TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON incident_escalations TO alert24; 