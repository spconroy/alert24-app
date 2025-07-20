-- =====================================================
-- Webhook Integration System
-- Creates tables for webhook delivery and management
-- =====================================================

-- Create webhooks table
CREATE TABLE IF NOT EXISTS webhooks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
    
    -- Webhook configuration
    name VARCHAR(255) NOT NULL,
    url TEXT NOT NULL,
    description TEXT,
    events TEXT[] DEFAULT ARRAY['*'], -- Array of event types to listen for
    
    -- Authentication configuration
    auth_type VARCHAR(50), -- 'bearer', 'basic', 'api_key', 'custom', null
    auth_config JSONB, -- Stores auth configuration (encrypted in production)
    
    -- Request configuration
    headers JSONB, -- Custom headers to send
    payload_template JSONB, -- Template for payload transformation
    field_mapping JSONB, -- Field mapping configuration
    secret VARCHAR(255), -- HMAC secret for signature verification
    
    -- Status and monitoring
    is_active BOOLEAN DEFAULT TRUE,
    last_success_at TIMESTAMPTZ,
    last_failure_at TIMESTAMPTZ,
    failure_count INTEGER DEFAULT 0,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for webhooks
CREATE INDEX IF NOT EXISTS idx_webhooks_organization_id ON webhooks(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhooks_created_by ON webhooks(created_by);
CREATE INDEX IF NOT EXISTS idx_webhooks_active ON webhooks(is_active);
CREATE INDEX IF NOT EXISTS idx_webhooks_events ON webhooks USING GIN(events);
CREATE INDEX IF NOT EXISTS idx_webhooks_failure_count ON webhooks(failure_count);

-- Create webhook_deliveries table for tracking delivery attempts
CREATE TABLE IF NOT EXISTS webhook_deliveries (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    webhook_id UUID NOT NULL REFERENCES webhooks(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Delivery details
    event_type VARCHAR(100) NOT NULL,
    payload JSONB NOT NULL,
    
    -- Response details
    status VARCHAR(20) NOT NULL DEFAULT 'pending',
    response_status INTEGER,
    response_time INTEGER DEFAULT 0, -- milliseconds
    response_body TEXT,
    error_message TEXT,
    
    -- Retry information
    attempt_count INTEGER DEFAULT 1,
    max_attempts INTEGER DEFAULT 3,
    next_retry_at TIMESTAMPTZ,
    
    -- Timestamps
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    
    CONSTRAINT delivery_status_check CHECK (
        status IN ('pending', 'success', 'failed', 'retrying', 'abandoned')
    )
);

-- Create indexes for webhook_deliveries
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_webhook_id ON webhook_deliveries(webhook_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_organization_id ON webhook_deliveries(organization_id);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_status ON webhook_deliveries(status);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_event_type ON webhook_deliveries(event_type);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_created_at ON webhook_deliveries(created_at);
CREATE INDEX IF NOT EXISTS idx_webhook_deliveries_next_retry ON webhook_deliveries(next_retry_at) WHERE next_retry_at IS NOT NULL;

-- Create webhook_events table for tracking supported event types
CREATE TABLE IF NOT EXISTS webhook_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Event definition
    event_type VARCHAR(100) NOT NULL UNIQUE,
    display_name VARCHAR(255) NOT NULL,
    description TEXT,
    category VARCHAR(50) NOT NULL,
    
    -- Schema definition
    payload_schema JSONB, -- JSON Schema for validation
    example_payload JSONB, -- Example payload for documentation
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Insert default webhook events
INSERT INTO webhook_events (event_type, display_name, description, category, example_payload) VALUES
('incident.created', 'Incident Created', 'Triggered when a new incident is created', 'incidents', 
 '{"incident": {"id": "uuid", "title": "Service Down", "severity": "critical", "status": "open"}}'::jsonb),
('incident.updated', 'Incident Updated', 'Triggered when an incident is updated', 'incidents',
 '{"incident": {"id": "uuid", "title": "Service Down", "severity": "critical", "status": "investigating"}}'::jsonb),
('incident.resolved', 'Incident Resolved', 'Triggered when an incident is resolved', 'incidents',
 '{"incident": {"id": "uuid", "title": "Service Down", "severity": "critical", "status": "resolved"}}'::jsonb),
('service.down', 'Service Down', 'Triggered when a service goes down', 'monitoring',
 '{"service": {"id": "uuid", "name": "API Service", "status": "down", "previous_status": "operational"}}'::jsonb),
('service.up', 'Service Up', 'Triggered when a service comes back up', 'monitoring',
 '{"service": {"id": "uuid", "name": "API Service", "status": "operational", "previous_status": "down"}}'::jsonb),
('service.degraded', 'Service Degraded', 'Triggered when a service is degraded', 'monitoring',
 '{"service": {"id": "uuid", "name": "API Service", "status": "degraded", "previous_status": "operational"}}'::jsonb),
('monitoring.alert', 'Monitoring Alert', 'Triggered when a monitoring check fails', 'monitoring',
 '{"alert": {"check_id": "uuid", "check_name": "API Health", "status": "failed", "error_message": "Connection timeout"}}'::jsonb),
('maintenance.started', 'Maintenance Started', 'Triggered when maintenance begins', 'maintenance',
 '{"maintenance": {"id": "uuid", "title": "Database Upgrade", "status": "in_progress", "services": ["api", "web"]}}'::jsonb),
('maintenance.completed', 'Maintenance Completed', 'Triggered when maintenance is completed', 'maintenance',
 '{"maintenance": {"id": "uuid", "title": "Database Upgrade", "status": "completed", "services": ["api", "web"]}}'::jsonb)
ON CONFLICT (event_type) DO NOTHING;

-- Add RLS policies for webhooks
ALTER TABLE webhooks ENABLE ROW LEVEL SECURITY;

-- Organization members can view webhooks for their organization
CREATE POLICY "Organization members can view webhooks" ON webhooks
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = webhooks.organization_id
            AND om.user_id::text = auth.uid()::text
            AND om.is_active = true
        )
    );

-- Organization admins/owners can insert webhooks
CREATE POLICY "Organization admins can insert webhooks" ON webhooks
    FOR INSERT WITH CHECK (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = webhooks.organization_id
            AND om.user_id::text = auth.uid()::text
            AND om.role IN ('owner', 'admin')
            AND om.is_active = true
        )
    );

-- Organization admins/owners can update webhooks
CREATE POLICY "Organization admins can update webhooks" ON webhooks
    FOR UPDATE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = webhooks.organization_id
            AND om.user_id::text = auth.uid()::text
            AND om.role IN ('owner', 'admin')
            AND om.is_active = true
        )
    );

-- Organization admins/owners can delete webhooks
CREATE POLICY "Organization admins can delete webhooks" ON webhooks
    FOR DELETE USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = webhooks.organization_id
            AND om.user_id::text = auth.uid()::text
            AND om.role IN ('owner', 'admin')
            AND om.is_active = true
        )
    );

-- Add RLS policies for webhook_deliveries
ALTER TABLE webhook_deliveries ENABLE ROW LEVEL SECURITY;

-- Organization members can view delivery logs for their organization
CREATE POLICY "Organization members can view webhook deliveries" ON webhook_deliveries
    FOR SELECT USING (
        EXISTS (
            SELECT 1 FROM organization_members om
            WHERE om.organization_id = webhook_deliveries.organization_id
            AND om.user_id::text = auth.uid()::text
            AND om.is_active = true
        )
    );

-- Service accounts can insert delivery logs
CREATE POLICY "Service can insert webhook deliveries" ON webhook_deliveries
    FOR INSERT WITH CHECK (true);

-- Service accounts can update delivery logs
CREATE POLICY "Service can update webhook deliveries" ON webhook_deliveries
    FOR UPDATE USING (true);

-- Add RLS policies for webhook_events (read-only for users)
ALTER TABLE webhook_events ENABLE ROW LEVEL SECURITY;

-- All authenticated users can view webhook events
CREATE POLICY "Users can view webhook events" ON webhook_events
    FOR SELECT USING (
        auth.uid() IS NOT NULL
    );

-- Add updated_at triggers
CREATE OR REPLACE FUNCTION update_webhooks_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_webhooks_updated_at
    BEFORE UPDATE ON webhooks
    FOR EACH ROW
    EXECUTE FUNCTION update_webhooks_updated_at();

CREATE OR REPLACE FUNCTION update_webhook_deliveries_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_webhook_deliveries_updated_at
    BEFORE UPDATE ON webhook_deliveries
    FOR EACH ROW
    EXECUTE FUNCTION update_webhook_deliveries_updated_at();

-- Function to clean up old webhook deliveries
CREATE OR REPLACE FUNCTION cleanup_old_webhook_deliveries(days_to_keep INTEGER DEFAULT 30)
RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM webhook_deliveries 
    WHERE created_at < NOW() - INTERVAL '1 day' * days_to_keep;
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function to retry failed webhook deliveries
CREATE OR REPLACE FUNCTION get_pending_webhook_retries()
RETURNS TABLE (
    delivery_id UUID,
    webhook_id UUID,
    webhook_url TEXT,
    webhook_config JSONB,
    event_type VARCHAR(100),
    payload JSONB,
    attempt_count INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        wd.id,
        w.id,
        w.url,
        jsonb_build_object(
            'auth_type', w.auth_type,
            'auth_config', w.auth_config,
            'headers', w.headers,
            'payload_template', w.payload_template,
            'field_mapping', w.field_mapping,
            'secret', w.secret
        ),
        wd.event_type,
        wd.payload,
        wd.attempt_count
    FROM webhook_deliveries wd
    JOIN webhooks w ON wd.webhook_id = w.id
    WHERE wd.status = 'retrying'
    AND wd.next_retry_at <= NOW()
    AND w.is_active = true
    AND wd.attempt_count < wd.max_attempts
    ORDER BY wd.next_retry_at ASC
    LIMIT 100;
END;
$$ LANGUAGE plpgsql;

-- Grant necessary permissions
GRANT ALL ON webhooks TO authenticated;
GRANT ALL ON webhook_deliveries TO authenticated;
GRANT SELECT ON webhook_events TO authenticated;

-- Grant usage on sequences
GRANT USAGE ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Add comments for documentation
COMMENT ON TABLE webhooks IS 'Stores webhook endpoints for real-time system communication';
COMMENT ON TABLE webhook_deliveries IS 'Tracks webhook delivery attempts and responses';
COMMENT ON TABLE webhook_events IS 'Defines available webhook event types and their schemas';

COMMIT;