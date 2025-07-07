-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 06: Indexes and Constraints
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- FOREIGN KEY CONSTRAINTS (that couldn't be created earlier)
-- =====================================================

-- Add foreign key constraints that depend on tables created in other schema files

-- Connect incidents to escalation policies
ALTER TABLE incidents 
ADD CONSTRAINT fk_incidents_escalation_policy 
FOREIGN KEY (escalation_policy_id) REFERENCES escalation_policies(id);

-- Connect monitoring checks to status page components
ALTER TABLE monitoring_checks 
ADD CONSTRAINT fk_monitoring_checks_status_page_component 
FOREIGN KEY (status_page_component_id) REFERENCES status_page_components(id);

-- Connect users to current on-call schedule
ALTER TABLE users 
ADD CONSTRAINT fk_users_current_on_call_schedule 
FOREIGN KEY (current_on_call_schedule_id) REFERENCES on_call_schedules(id);

-- Connect team groups to default escalation policy
ALTER TABLE team_groups 
ADD CONSTRAINT fk_team_groups_default_escalation_policy 
FOREIGN KEY (default_escalation_policy_id) REFERENCES escalation_policies(id);

-- =====================================================
-- ADDITIONAL PERFORMANCE INDEXES
-- =====================================================

-- Composite indexes for complex queries
CREATE INDEX IF NOT EXISTS idx_incidents_org_status_severity 
ON incidents(organization_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_incidents_org_created_escalation 
ON incidents(organization_id, created_at, escalation_level);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident_created 
ON incident_updates(incident_id, created_at);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_org_type_status 
ON monitoring_checks(organization_id, check_type, status);

CREATE INDEX IF NOT EXISTS idx_check_results_check_successful_created 
ON check_results(monitoring_check_id, is_successful, created_at);

CREATE INDEX IF NOT EXISTS idx_notification_history_user_org_type 
ON notification_history(user_id, organization_id, notification_type);

CREATE INDEX IF NOT EXISTS idx_user_activity_log_org_type_created 
ON user_activity_log(organization_id, activity_type, created_at);

-- Indexes for JSON fields (PostgreSQL GIN indexes)
CREATE INDEX IF NOT EXISTS idx_escalation_policies_rules_gin 
ON escalation_policies USING GIN (rules);

CREATE INDEX IF NOT EXISTS idx_escalation_policies_conditions_gin 
ON escalation_policies USING GIN (conditions);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_configuration_gin 
ON monitoring_checks USING GIN (configuration);

CREATE INDEX IF NOT EXISTS idx_users_notification_preferences_gin 
ON users USING GIN (notification_preferences);

CREATE INDEX IF NOT EXISTS idx_user_contact_methods_quiet_hours_gin 
ON user_contact_methods USING GIN (quiet_hours);

-- Indexes for array fields
CREATE INDEX IF NOT EXISTS idx_incidents_affected_services_gin 
ON incidents USING GIN (affected_services);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_locations_gin 
ON monitoring_checks USING GIN (monitoring_locations);

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_tags_gin 
ON monitoring_checks USING GIN (tags);

CREATE INDEX IF NOT EXISTS idx_subscribers_components_gin 
ON subscribers USING GIN (subscribed_components);

CREATE INDEX IF NOT EXISTS idx_subscribers_severities_gin 
ON subscribers USING GIN (subscribed_severities);

CREATE INDEX IF NOT EXISTS idx_status_page_incidents_components_gin 
ON status_page_incidents USING GIN (affected_component_ids);

-- =====================================================
-- PARTIAL INDEXES (for specific conditions)
-- =====================================================

-- Indexes for active/open records only
CREATE INDEX IF NOT EXISTS idx_incidents_open_by_org 
ON incidents(organization_id, created_at) 
WHERE status IN ('open', 'investigating', 'identified', 'monitoring');

CREATE INDEX IF NOT EXISTS idx_monitoring_checks_active_by_org 
ON monitoring_checks(organization_id, check_type) 
WHERE status = 'active';

CREATE INDEX IF NOT EXISTS idx_escalation_policies_active_by_org 
ON escalation_policies(organization_id) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_active_by_check 
ON monitoring_alerts(monitoring_check_id, created_at) 
WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_incident_escalations_pending 
ON incident_escalations(timeout_at) 
WHERE status = 'pending';

-- Indexes for failed check results only
CREATE INDEX IF NOT EXISTS idx_check_results_failures_by_check 
ON check_results(monitoring_check_id, created_at) 
WHERE is_successful = false;

-- Indexes for unverified contact methods
CREATE INDEX IF NOT EXISTS idx_user_contact_methods_unverified 
ON user_contact_methods(user_id, method_type) 
WHERE is_verified = false;

-- =====================================================
-- UNIQUE CONSTRAINTS
-- =====================================================

-- Ensure unique default escalation policy per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_escalation_policies_unique_default_per_org 
ON escalation_policies(organization_id) 
WHERE is_default = true;

-- Ensure unique on-call schedule names per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_on_call_schedules_unique_name_per_org 
ON on_call_schedules(organization_id, name) 
WHERE is_active = true;

-- Ensure unique team names per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_team_groups_unique_name_per_org 
ON team_groups(organization_id, name) 
WHERE is_active = true;

-- Ensure unique monitoring check names per organization
CREATE UNIQUE INDEX IF NOT EXISTS idx_monitoring_checks_unique_name_per_org 
ON monitoring_checks(organization_id, name);

-- =====================================================
-- CHECK CONSTRAINTS
-- =====================================================

-- Ensure valid time ranges
ALTER TABLE incidents 
ADD CONSTRAINT chk_incidents_time_order 
CHECK (
    (acknowledged_at IS NULL OR acknowledged_at >= started_at) AND
    (resolved_at IS NULL OR resolved_at >= started_at) AND
    (escalated_at IS NULL OR escalated_at >= started_at)
);

ALTER TABLE incident_escalations 
ADD CONSTRAINT chk_incident_escalations_time_order 
CHECK (
    (acknowledged_at IS NULL OR acknowledged_at >= triggered_at) AND
    (timeout_at IS NULL OR timeout_at >= triggered_at)
);

-- Ensure valid configuration values
ALTER TABLE monitoring_checks 
ADD CONSTRAINT chk_monitoring_checks_intervals 
CHECK (
    check_interval > 0 AND
    retry_count >= 0 AND
    retry_interval > 0 AND
    target_timeout > 0 AND
    alert_after_failures > 0
);

ALTER TABLE escalation_policies 
ADD CONSTRAINT chk_escalation_policies_rules_not_empty 
CHECK (jsonb_array_length(rules) > 0);

-- Ensure valid contact information
ALTER TABLE user_contact_methods 
ADD CONSTRAINT chk_user_contact_methods_valid_contact 
CHECK (
    (method_type = 'email' AND contact_value ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$') OR
    (method_type = 'sms' AND contact_value ~ '^\+?[1-9]\d{1,14}$') OR
    (method_type IN ('voice', 'slack', 'teams', 'webhook'))
);

-- Ensure valid percentage values
ALTER TABLE uptime_calculations 
ADD CONSTRAINT chk_uptime_calculations_valid_percentages 
CHECK (
    uptime_percentage >= 0 AND uptime_percentage <= 100 AND
    total_minutes > 0 AND
    operational_minutes >= 0 AND
    degraded_minutes >= 0 AND
    outage_minutes >= 0 AND
    maintenance_minutes >= 0 AND
    (operational_minutes + degraded_minutes + outage_minutes + maintenance_minutes) <= total_minutes
);

-- Ensure valid time windows for maintenance
ALTER TABLE status_page_maintenance_windows 
ADD CONSTRAINT chk_maintenance_windows_time_order 
CHECK (
    scheduled_end > scheduled_start AND
    (actual_start IS NULL OR actual_start >= scheduled_start) AND
    (actual_end IS NULL OR actual_end >= COALESCE(actual_start, scheduled_start))
);

-- =====================================================
-- EXCLUSION CONSTRAINTS
-- =====================================================

-- Ensure no overlapping maintenance windows for the same components
-- Note: This is a complex constraint that would require a custom function
-- For now, we'll handle this in application logic

-- =====================================================
-- ROW LEVEL SECURITY (RLS) SETUP
-- =====================================================

-- Enable RLS on sensitive tables
ALTER TABLE incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE incident_updates ENABLE ROW LEVEL SECURITY;
ALTER TABLE monitoring_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE check_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE escalation_policies ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_rules ENABLE ROW LEVEL SECURITY;
ALTER TABLE on_call_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_contact_methods ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE notification_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_groups ENABLE ROW LEVEL SECURITY;

-- RLS Policies for organization isolation
CREATE POLICY incidents_organization_isolation ON incidents
    FOR ALL TO alert24
    USING (organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

CREATE POLICY monitoring_checks_organization_isolation ON monitoring_checks
    FOR ALL TO alert24
    USING (organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

CREATE POLICY escalation_policies_organization_isolation ON escalation_policies
    FOR ALL TO alert24
    USING (organization_id IN (
        SELECT organization_id FROM organization_members 
        WHERE user_id = current_setting('app.current_user_id')::UUID
    ));

-- User-specific data policies
CREATE POLICY user_contact_methods_user_isolation ON user_contact_methods
    FOR ALL TO alert24
    USING (user_id = current_setting('app.current_user_id')::UUID);

CREATE POLICY user_notification_preferences_user_isolation ON user_notification_preferences
    FOR ALL TO alert24
    USING (user_id = current_setting('app.current_user_id')::UUID);

-- =====================================================
-- MATERIALIZED VIEWS FOR PERFORMANCE
-- =====================================================

-- Materialized view for incident statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS incident_statistics AS
SELECT 
    organization_id,
    DATE_TRUNC('day', created_at) as incident_date,
    COUNT(*) as total_incidents,
    COUNT(*) FILTER (WHERE severity = 'critical') as critical_incidents,
    COUNT(*) FILTER (WHERE severity = 'high') as high_incidents,
    COUNT(*) FILTER (WHERE severity = 'medium') as medium_incidents,
    COUNT(*) FILTER (WHERE severity = 'low') as low_incidents,
    COUNT(*) FILTER (WHERE status = 'resolved') as resolved_incidents,
    AVG(EXTRACT(EPOCH FROM (COALESCE(resolved_at, NOW()) - started_at)) / 60) as avg_resolution_time_minutes,
    AVG(EXTRACT(EPOCH FROM (COALESCE(acknowledged_at, resolved_at, NOW()) - started_at)) / 60) as avg_acknowledgment_time_minutes
FROM incidents
WHERE created_at >= CURRENT_DATE - INTERVAL '1 year'
GROUP BY organization_id, DATE_TRUNC('day', created_at);

-- Create index on materialized view
CREATE UNIQUE INDEX IF NOT EXISTS idx_incident_statistics_org_date 
ON incident_statistics(organization_id, incident_date);

-- Materialized view for monitoring statistics
CREATE MATERIALIZED VIEW IF NOT EXISTS monitoring_check_statistics AS
SELECT 
    mc.organization_id,
    mc.id as monitoring_check_id,
    mc.name as check_name,
    mc.check_type,
    DATE_TRUNC('day', cr.created_at) as check_date,
    COUNT(*) as total_checks,
    COUNT(*) FILTER (WHERE cr.is_successful) as successful_checks,
    COUNT(*) FILTER (WHERE NOT cr.is_successful) as failed_checks,
    ROUND((COUNT(*) FILTER (WHERE cr.is_successful)::DECIMAL / COUNT(*)) * 100, 2) as success_rate,
    AVG(cr.response_time) as avg_response_time,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY cr.response_time) as p95_response_time
FROM monitoring_checks mc
LEFT JOIN check_results cr ON mc.id = cr.monitoring_check_id
WHERE cr.created_at >= CURRENT_DATE - INTERVAL '30 days'
GROUP BY mc.organization_id, mc.id, mc.name, mc.check_type, DATE_TRUNC('day', cr.created_at);

-- Create index on monitoring statistics materialized view
CREATE INDEX IF NOT EXISTS idx_monitoring_check_statistics_org_check_date 
ON monitoring_check_statistics(organization_id, monitoring_check_id, check_date);

-- =====================================================
-- REFRESH FUNCTIONS FOR MATERIALIZED VIEWS
-- =====================================================

CREATE OR REPLACE FUNCTION refresh_incident_statistics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY incident_statistics;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION refresh_monitoring_statistics()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY monitoring_check_statistics;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- VALIDATE SCHEMA INTEGRITY
-- =====================================================

-- Function to validate schema integrity
CREATE OR REPLACE FUNCTION validate_schema_integrity()
RETURNS TABLE(
    table_name TEXT,
    issue_type TEXT,
    description TEXT
) AS $$
BEGIN
    -- Check for incidents without organization members
    RETURN QUERY
    SELECT 
        'incidents'::TEXT as table_name,
        'orphaned_incident'::TEXT as issue_type,
        'Incident ' || i.id::TEXT || ' belongs to organization with no members'::TEXT as description
    FROM incidents i
    LEFT JOIN organization_members om ON i.organization_id = om.organization_id
    WHERE om.organization_id IS NULL;

    -- Check for monitoring checks without valid escalation policies
    RETURN QUERY
    SELECT 
        'monitoring_checks'::TEXT as table_name,
        'invalid_escalation_policy'::TEXT as issue_type,
        'Monitoring check ' || mc.id::TEXT || ' references invalid escalation policy'::TEXT as description
    FROM monitoring_checks mc
    LEFT JOIN escalation_policies ep ON mc.escalation_policy_id = ep.id
    WHERE mc.escalation_policy_id IS NOT NULL 
      AND (ep.id IS NULL OR ep.is_active = false);

    -- Check for check results without valid monitoring checks
    RETURN QUERY
    SELECT 
        'check_results'::TEXT as table_name,
        'orphaned_check_result'::TEXT as issue_type,
        'Check result ' || cr.id::TEXT || ' references deleted monitoring check'::TEXT as description
    FROM check_results cr
    LEFT JOIN monitoring_checks mc ON cr.monitoring_check_id = mc.id
    WHERE mc.id IS NULL;

    -- Add more integrity checks as needed
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- FINAL PERMISSIONS GRANT
-- =====================================================

-- Grant permissions on all new objects to alert24 user
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO alert24;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO alert24;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO alert24;

-- Grant refresh permissions on materialized views
GRANT SELECT ON incident_statistics TO alert24;
GRANT SELECT ON monitoring_check_statistics TO alert24;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON MATERIALIZED VIEW incident_statistics IS 'Daily incident statistics by organization';
COMMENT ON MATERIALIZED VIEW monitoring_check_statistics IS 'Daily monitoring check statistics';
COMMENT ON FUNCTION validate_schema_integrity() IS 'Validates database schema integrity and finds orphaned records';
COMMENT ON FUNCTION refresh_incident_statistics() IS 'Refreshes incident statistics materialized view';
COMMENT ON FUNCTION refresh_monitoring_statistics() IS 'Refreshes monitoring statistics materialized view';

-- =====================================================
-- COMPLETION MESSAGE
-- =====================================================

DO $$
BEGIN
    RAISE NOTICE 'Alert24 Incident Management Platform schema update completed successfully!';
    RAISE NOTICE 'Schema includes: incidents, monitoring, escalation, notifications, status pages, and analytics';
    RAISE NOTICE 'Remember to set up cron jobs for: process_pending_escalations(), calculate_all_component_uptime(), cleanup_old_data()';
    RAISE NOTICE 'Remember to refresh materialized views periodically using refresh_incident_statistics() and refresh_monitoring_statistics()';
END $$; 