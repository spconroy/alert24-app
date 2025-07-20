-- Create escalation_policies table
-- This table stores escalation policies for incident management

CREATE TABLE IF NOT EXISTS escalation_policies (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    escalation_timeout_minutes INTEGER DEFAULT 30,
    escalation_steps JSONB DEFAULT '[]'::jsonb,
    notification_config JSONB DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_by UUID REFERENCES users(id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_escalation_policies_organization_id ON escalation_policies(organization_id);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_is_active ON escalation_policies(is_active);
CREATE INDEX IF NOT EXISTS idx_escalation_policies_deleted_at ON escalation_policies(deleted_at);

-- Note: RLS is disabled for escalation_policies table as it's handled in application layer
-- This follows the same pattern as on_call_schedules table
-- Access control is handled by the application code through organization membership checks

-- Comment on the table
COMMENT ON TABLE escalation_policies IS 'Escalation policies for incident management';
COMMENT ON COLUMN escalation_policies.escalation_steps IS 'JSON array of escalation steps with notification rules';
COMMENT ON COLUMN escalation_policies.notification_config IS 'JSON object with notification configuration settings';