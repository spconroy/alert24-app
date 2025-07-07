-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 05: Database Functions and Triggers
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- UTILITY FUNCTIONS
-- =====================================================

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language plpgsql;

-- Apply updated_at trigger to all tables that have updated_at column
DO $$
DECLARE
    table_name text;
    table_names text[] := ARRAY[
        'incidents', 'incident_updates', 'escalation_policies', 'notification_rules',
        'on_call_schedules', 'incident_escalations', 'monitoring_locations',
        'monitoring_checks', 'check_schedules', 'monitoring_alerts', 'monitoring_statistics',
        'user_contact_methods', 'user_notification_preferences', 'notification_history',
        'team_groups', 'team_memberships', 'uptime_calculations', 'subscriber_notifications',
        'status_page_maintenance_windows'
    ];
BEGIN
    FOREACH table_name IN ARRAY table_names
    LOOP
        EXECUTE format('
            DROP TRIGGER IF EXISTS trigger_update_updated_at ON %I;
            CREATE TRIGGER trigger_update_updated_at
                BEFORE UPDATE ON %I
                FOR EACH ROW
                EXECUTE FUNCTION update_updated_at_column();
        ', table_name, table_name);
    END LOOP;
END $$;

-- =====================================================
-- INCIDENT AUTO-CREATION FUNCTIONS
-- =====================================================

-- Function to create incident from monitoring check failure
CREATE OR REPLACE FUNCTION create_incident_from_check_failure(
    p_monitoring_check_id UUID,
    p_check_result_id UUID
) RETURNS UUID AS $$
DECLARE
    v_incident_id UUID;
    v_check_record RECORD;
    v_existing_incident_id UUID;
    v_organization_id UUID;
    v_created_by UUID;
BEGIN
    -- Get monitoring check details
    SELECT mc.*, o.id as org_id
    INTO v_check_record
    FROM monitoring_checks mc
    JOIN organizations o ON mc.organization_id = o.id
    WHERE mc.id = p_monitoring_check_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Monitoring check not found: %', p_monitoring_check_id;
    END IF;

    v_organization_id := v_check_record.org_id;
    v_created_by := v_check_record.created_by;

    -- Check if there's already an open incident for this check within the last hour
    SELECT id INTO v_existing_incident_id
    FROM incidents 
    WHERE source = 'monitoring'
      AND source_id = p_monitoring_check_id::text
      AND status NOT IN ('resolved', 'postmortem')
      AND created_at > NOW() - INTERVAL '1 hour'
    LIMIT 1;

    -- If incident already exists, just update the check result
    IF v_existing_incident_id IS NOT NULL THEN
        UPDATE check_results 
        SET incident_id = v_existing_incident_id, triggered_incident = false
        WHERE id = p_check_result_id;
        RETURN v_existing_incident_id;
    END IF;

    -- Create new incident
    INSERT INTO incidents (
        organization_id,
        title,
        description,
        severity,
        status,
        source,
        source_id,
        created_by,
        escalation_policy_id,
        started_at
    ) VALUES (
        v_organization_id,
        'Monitoring Alert: ' || v_check_record.name,
        'Monitoring check "' || v_check_record.name || '" has failed. Target: ' || v_check_record.target_url,
        CASE 
            WHEN v_check_record.check_type IN ('http', 'https') THEN 'high'::incident_severity
            WHEN v_check_record.check_type = 'ping' THEN 'medium'::incident_severity
            ELSE 'medium'::incident_severity
        END,
        'open'::incident_status,
        'monitoring',
        p_monitoring_check_id::text,
        v_created_by,
        v_check_record.escalation_policy_id,
        NOW()
    ) RETURNING id INTO v_incident_id;

    -- Update the check result to reference the incident
    UPDATE check_results 
    SET incident_id = v_incident_id, triggered_incident = true
    WHERE id = p_check_result_id;

    -- Create initial incident update
    INSERT INTO incident_updates (
        incident_id,
        message,
        status,
        update_type,
        posted_by,
        visible_to_subscribers
    ) VALUES (
        v_incident_id,
        'Incident automatically created from monitoring check failure.',
        'open'::incident_status,
        'update',
        v_created_by,
        true
    );

    -- Log activity
    INSERT INTO user_activity_log (
        user_id,
        organization_id,
        activity_type,
        activity_description,
        incident_id,
        monitoring_check_id
    ) VALUES (
        v_created_by,
        v_organization_id,
        'incident_auto_created',
        'Incident automatically created from monitoring check failure: ' || v_check_record.name,
        v_incident_id,
        p_monitoring_check_id
    );

    RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql;

-- Function to auto-resolve incident when monitoring recovers
CREATE OR REPLACE FUNCTION resolve_incident_from_check_recovery(
    p_monitoring_check_id UUID,
    p_check_result_id UUID
) RETURNS BOOLEAN AS $$
DECLARE
    v_incident_id UUID;
    v_organization_id UUID;
    v_system_user_id UUID;
BEGIN
    -- Find open incident for this monitoring check
    SELECT id, organization_id INTO v_incident_id, v_organization_id
    FROM incidents 
    WHERE source = 'monitoring'
      AND source_id = p_monitoring_check_id::text
      AND status NOT IN ('resolved', 'postmortem')
    ORDER BY created_at DESC
    LIMIT 1;

    IF v_incident_id IS NULL THEN
        RETURN false;
    END IF;

    -- Get a system user for this organization (or use the first admin)
    SELECT u.id INTO v_system_user_id
    FROM users u
    JOIN organization_members om ON u.id = om.user_id
    WHERE om.organization_id = v_organization_id
      AND om.incident_role = 'admin'
    LIMIT 1;

    -- Update incident status to resolved
    UPDATE incidents 
    SET 
        status = 'resolved'::incident_status,
        resolved_at = NOW()
    WHERE id = v_incident_id;

    -- Add resolution update
    INSERT INTO incident_updates (
        incident_id,
        message,
        status,
        update_type,
        posted_by,
        visible_to_subscribers
    ) VALUES (
        v_incident_id,
        'Incident automatically resolved - monitoring check is now passing.',
        'resolved'::incident_status,
        'resolution',
        v_system_user_id,
        true
    );

    -- Update the check result to reference the incident
    UPDATE check_results 
    SET incident_id = v_incident_id
    WHERE id = p_check_result_id;

    -- Log activity
    INSERT INTO user_activity_log (
        user_id,
        organization_id,
        activity_type,
        activity_description,
        incident_id,
        monitoring_check_id
    ) VALUES (
        v_system_user_id,
        v_organization_id,
        'incident_auto_resolved',
        'Incident automatically resolved from monitoring check recovery',
        v_incident_id,
        p_monitoring_check_id
    );

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ESCALATION FUNCTIONS
-- =====================================================

-- Function to get current on-call user for a schedule
CREATE OR REPLACE FUNCTION get_current_on_call_user(
    p_schedule_id UUID,
    p_at_time TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS UUID AS $$
DECLARE
    v_schedule_record RECORD;
    v_current_user_id UUID;
    v_member_count INTEGER;
    v_rotation_start TIMESTAMP WITH TIME ZONE;
    v_hours_since_start INTEGER;
    v_rotation_hours INTEGER;
    v_current_position INTEGER;
BEGIN
    -- Get schedule details
    SELECT * INTO v_schedule_record
    FROM on_call_schedules 
    WHERE id = p_schedule_id AND is_active = true;

    IF NOT FOUND THEN
        RETURN NULL;
    END IF;

    -- Get member count
    SELECT array_length(members, 1) INTO v_member_count
    FROM on_call_schedules 
    WHERE id = p_schedule_id;

    IF v_member_count IS NULL OR v_member_count = 0 THEN
        RETURN NULL;
    END IF;

    -- For simple weekly rotation
    IF v_schedule_record.schedule_type = 'rotation' THEN
        -- Extract rotation duration from config (default to 168 hours = 1 week)
        v_rotation_hours := COALESCE(
            (v_schedule_record.rotation_config->>'duration_hours')::INTEGER, 
            168
        );
        
        -- Calculate current position in rotation
        v_rotation_start := v_schedule_record.created_at;
        v_hours_since_start := EXTRACT(EPOCH FROM (p_at_time - v_rotation_start)) / 3600;
        v_current_position := (v_hours_since_start / v_rotation_hours)::INTEGER % v_member_count;
        
        -- Get user ID from members array
        SELECT (members->v_current_position->>'user_id')::UUID 
        INTO v_current_user_id
        FROM on_call_schedules 
        WHERE id = p_schedule_id;
    END IF;

    RETURN v_current_user_id;
END;
$$ LANGUAGE plpgsql;

-- Function to escalate incident
CREATE OR REPLACE FUNCTION escalate_incident(
    p_incident_id UUID,
    p_triggered_by VARCHAR DEFAULT 'system'
) RETURNS UUID AS $$
DECLARE
    v_incident_record RECORD;
    v_escalation_policy RECORD;
    v_escalation_id UUID;
    v_next_level INTEGER;
    v_rules JSONB;
    v_current_rule JSONB;
    v_targets JSONB;
BEGIN
    -- Get incident details
    SELECT * INTO v_incident_record
    FROM incidents 
    WHERE id = p_incident_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Incident not found: %', p_incident_id;
    END IF;

    -- Get escalation policy
    SELECT * INTO v_escalation_policy
    FROM escalation_policies 
    WHERE id = v_incident_record.escalation_policy_id 
      AND is_active = true;

    IF NOT FOUND THEN
        -- No escalation policy, cannot escalate
        RETURN NULL;
    END IF;

    -- Determine next escalation level
    v_next_level := COALESCE(v_incident_record.escalation_level, 0) + 1;
    v_rules := v_escalation_policy.rules;

    -- Check if we have a rule for this level
    SELECT value INTO v_current_rule
    FROM jsonb_array_elements(v_rules) 
    WHERE (value->>'level')::INTEGER = v_next_level
    LIMIT 1;

    IF v_current_rule IS NULL THEN
        -- No more escalation levels
        RETURN NULL;
    END IF;

    -- Create escalation record
    INSERT INTO incident_escalations (
        incident_id,
        escalation_policy_id,
        level,
        triggered_by,
        targets,
        timeout_minutes,
        timeout_at
    ) VALUES (
        p_incident_id,
        v_escalation_policy.id,
        v_next_level,
        p_triggered_by,
        v_current_rule->'targets',
        COALESCE((v_current_rule->>'delay_minutes')::INTEGER, 15),
        NOW() + INTERVAL '1 minute' * COALESCE((v_current_rule->>'delay_minutes')::INTEGER, 15)
    ) RETURNING id INTO v_escalation_id;

    -- Update incident escalation level
    UPDATE incidents 
    SET 
        escalation_level = v_next_level,
        escalated_at = NOW()
    WHERE id = p_incident_id;

    -- Create incident update
    INSERT INTO incident_updates (
        incident_id,
        message,
        update_type,
        posted_by,
        visible_to_subscribers
    ) VALUES (
        p_incident_id,
        'Incident escalated to level ' || v_next_level,
        'escalation',
        v_incident_record.created_by,
        false
    );

    RETURN v_escalation_id;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- STATUS PAGE FUNCTIONS
-- =====================================================

-- Function to update component status from monitoring
CREATE OR REPLACE FUNCTION update_component_status_from_monitoring(
    p_component_id UUID,
    p_monitoring_result BOOLEAN
) RETURNS BOOLEAN AS $$
DECLARE
    v_component_record RECORD;
    v_old_status component_status;
    v_new_status component_status;
    v_check_count INTEGER;
    v_failed_checks INTEGER;
BEGIN
    -- Get component details
    SELECT * INTO v_component_record
    FROM status_page_components 
    WHERE id = p_component_id;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    v_old_status := v_component_record.current_status;

    -- Count total and failed checks for this component
    SELECT 
        COUNT(*),
        COUNT(*) FILTER (WHERE NOT is_successful)
    INTO v_check_count, v_failed_checks
    FROM check_results cr
    JOIN monitoring_checks mc ON cr.monitoring_check_id = mc.id
    WHERE mc.id = ANY(v_component_record.monitoring_check_ids)
      AND cr.created_at > NOW() - INTERVAL '10 minutes';

    -- Determine new status based on aggregation rule
    IF v_component_record.status_aggregation_rule = 'worst_status' THEN
        IF v_failed_checks > 0 THEN
            v_new_status := 'major_outage'::component_status;
        ELSE
            v_new_status := 'operational'::component_status;
        END IF;
    ELSIF v_component_record.status_aggregation_rule = 'majority' THEN
        IF v_failed_checks > (v_check_count / 2) THEN
            v_new_status := 'major_outage'::component_status;
        ELSIF v_failed_checks > 0 THEN
            v_new_status := 'degraded_performance'::component_status;
        ELSE
            v_new_status := 'operational'::component_status;
        END IF;
    END IF;

    -- Only update if status changed
    IF v_old_status != v_new_status THEN
        -- Update component status
        UPDATE status_page_components 
        SET current_status = v_new_status
        WHERE id = p_component_id;

        -- Record status change
        INSERT INTO component_status_history (
            status_page_component_id,
            old_status,
            new_status,
            reason,
            notes
        ) VALUES (
            p_component_id,
            v_old_status,
            v_new_status,
            'monitoring_update',
            'Status updated from monitoring check results'
        );
    END IF;

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate daily uptime for components
CREATE OR REPLACE FUNCTION calculate_component_uptime(
    p_component_id UUID,
    p_date DATE DEFAULT CURRENT_DATE
) RETURNS BOOLEAN AS $$
DECLARE
    v_total_minutes INTEGER := 1440; -- 24 hours * 60 minutes
    v_operational_minutes INTEGER := 0;
    v_degraded_minutes INTEGER := 0;
    v_outage_minutes INTEGER := 0;
    v_maintenance_minutes INTEGER := 0;
    v_uptime_percentage DECIMAL(5,2);
    v_incident_count INTEGER;
    
    v_status_change RECORD;
    v_prev_status component_status := 'operational';
    v_prev_time TIMESTAMP WITH TIME ZONE;
    v_current_time TIMESTAMP WITH TIME ZONE;
    v_duration_minutes INTEGER;
BEGIN
    -- Set time boundaries for the date
    v_prev_time := p_date::TIMESTAMP WITH TIME ZONE;
    v_current_time := p_date::TIMESTAMP WITH TIME ZONE + INTERVAL '1 day';

    -- Get all status changes for this component on this date
    FOR v_status_change IN 
        SELECT new_status, created_at
        FROM component_status_history
        WHERE status_page_component_id = p_component_id
          AND created_at >= v_prev_time
          AND created_at < v_current_time
        ORDER BY created_at
    LOOP
        -- Calculate duration of previous status
        v_duration_minutes := EXTRACT(EPOCH FROM (v_status_change.created_at - v_prev_time)) / 60;
        
        -- Add to appropriate counter
        CASE v_prev_status
            WHEN 'operational' THEN v_operational_minutes := v_operational_minutes + v_duration_minutes;
            WHEN 'degraded_performance' THEN v_degraded_minutes := v_degraded_minutes + v_duration_minutes;
            WHEN 'partial_outage', 'major_outage' THEN v_outage_minutes := v_outage_minutes + v_duration_minutes;
            WHEN 'maintenance' THEN v_maintenance_minutes := v_maintenance_minutes + v_duration_minutes;
        END CASE;
        
        v_prev_status := v_status_change.new_status;
        v_prev_time := v_status_change.created_at;
    END LOOP;

    -- Add remaining time in the day
    v_duration_minutes := EXTRACT(EPOCH FROM (v_current_time - v_prev_time)) / 60;
    CASE v_prev_status
        WHEN 'operational' THEN v_operational_minutes := v_operational_minutes + v_duration_minutes;
        WHEN 'degraded_performance' THEN v_degraded_minutes := v_degraded_minutes + v_duration_minutes;
        WHEN 'partial_outage', 'major_outage' THEN v_outage_minutes := v_outage_minutes + v_duration_minutes;
        WHEN 'maintenance' THEN v_maintenance_minutes := v_maintenance_minutes + v_duration_minutes;
    END CASE;

    -- Calculate uptime percentage (excluding maintenance)
    v_uptime_percentage := (v_operational_minutes::DECIMAL / (v_total_minutes - v_maintenance_minutes)) * 100;

    -- Count incidents for this component on this date
    SELECT COUNT(*) INTO v_incident_count
    FROM incidents i
    JOIN status_page_incidents spi ON i.id = spi.incident_id
    WHERE p_component_id = ANY(spi.affected_component_ids)
      AND i.started_at >= v_prev_time
      AND i.started_at < v_current_time;

    -- Insert or update uptime calculation
    INSERT INTO uptime_calculations (
        status_page_component_id,
        date_day,
        total_minutes,
        operational_minutes,
        degraded_minutes,
        outage_minutes,
        maintenance_minutes,
        uptime_percentage,
        incident_count
    ) VALUES (
        p_component_id,
        p_date,
        v_total_minutes,
        v_operational_minutes,
        v_degraded_minutes,
        v_outage_minutes,
        v_maintenance_minutes,
        v_uptime_percentage,
        v_incident_count
    )
    ON CONFLICT (status_page_component_id, date_day)
    DO UPDATE SET
        operational_minutes = EXCLUDED.operational_minutes,
        degraded_minutes = EXCLUDED.degraded_minutes,
        outage_minutes = EXCLUDED.outage_minutes,
        maintenance_minutes = EXCLUDED.maintenance_minutes,
        uptime_percentage = EXCLUDED.uptime_percentage,
        incident_count = EXCLUDED.incident_count,
        updated_at = NOW();

    RETURN true;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- TRIGGER FUNCTIONS
-- =====================================================

-- Trigger function to handle incident status changes
CREATE OR REPLACE FUNCTION handle_incident_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- Log activity when incident status changes
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO user_activity_log (
            user_id,
            organization_id,
            activity_type,
            activity_description,
            incident_id
        ) VALUES (
            COALESCE(NEW.assigned_to, NEW.created_by),
            NEW.organization_id,
            'incident_status_changed',
            'Incident status changed from ' || COALESCE(OLD.status::text, 'null') || ' to ' || NEW.status::text,
            NEW.id
        );

        -- Update status page if auto-updates enabled
        INSERT INTO status_page_incidents (
            status_page_id,
            incident_id,
            display_title,
            display_description
        )
        SELECT 
            sp.id,
            NEW.id,
            NEW.title,
            NEW.description
        FROM status_pages sp
        WHERE sp.organization_id = NEW.organization_id
          AND sp.auto_incident_updates = true
        ON CONFLICT (status_page_id, incident_id) DO NOTHING;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for incident status changes
DROP TRIGGER IF EXISTS trigger_incident_status_change ON incidents;
CREATE TRIGGER trigger_incident_status_change
    AFTER UPDATE ON incidents
    FOR EACH ROW
    EXECUTE FUNCTION handle_incident_status_change();

-- Trigger function to handle check result processing
CREATE OR REPLACE FUNCTION handle_check_result()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_result BOOLEAN;
    v_check_config JSONB;
    v_alert_threshold INTEGER;
    v_consecutive_failures INTEGER;
BEGIN
    -- Get monitoring check configuration
    SELECT configuration INTO v_check_config
    FROM monitoring_checks 
    WHERE id = NEW.monitoring_check_id;

    v_alert_threshold := COALESCE((v_check_config->>'alert_after_failures')::INTEGER, 2);

    -- Get previous result
    SELECT is_successful INTO v_previous_result
    FROM check_results
    WHERE monitoring_check_id = NEW.monitoring_check_id
      AND id != NEW.id
    ORDER BY created_at DESC
    LIMIT 1;

    -- Count consecutive failures
    SELECT COUNT(*) INTO v_consecutive_failures
    FROM (
        SELECT is_successful
        FROM check_results
        WHERE monitoring_check_id = NEW.monitoring_check_id
          AND created_at <= NEW.created_at
        ORDER BY created_at DESC
        LIMIT v_alert_threshold
    ) recent_results
    WHERE NOT is_successful;

    -- If this is a failure and we've reached the threshold, create incident
    IF NOT NEW.is_successful AND v_consecutive_failures >= v_alert_threshold THEN
        -- Only create incident if the previous result was successful (avoid spam)
        IF v_previous_result IS NULL OR v_previous_result = true THEN
            PERFORM create_incident_from_check_failure(NEW.monitoring_check_id, NEW.id);
        END IF;
    END IF;

    -- If this is a success and previous was failure, try to resolve incident
    IF NEW.is_successful AND (v_previous_result IS NULL OR v_previous_result = false) THEN
        PERFORM resolve_incident_from_check_recovery(NEW.monitoring_check_id, NEW.id);
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for check result processing
DROP TRIGGER IF EXISTS trigger_handle_check_result ON check_results;
CREATE TRIGGER trigger_handle_check_result
    AFTER INSERT ON check_results
    FOR EACH ROW
    EXECUTE FUNCTION handle_check_result();

-- =====================================================
-- SCHEDULED FUNCTIONS (for cron jobs)
-- =====================================================

-- Function to process pending escalations
CREATE OR REPLACE FUNCTION process_pending_escalations()
RETURNS INTEGER AS $$
DECLARE
    v_escalation RECORD;
    v_processed_count INTEGER := 0;
BEGIN
    -- Find escalations that have timed out
    FOR v_escalation IN
        SELECT *
        FROM incident_escalations
        WHERE status = 'pending'
          AND timeout_at <= NOW()
    LOOP
        -- Escalate the incident to next level
        PERFORM escalate_incident(v_escalation.incident_id, 'timeout');
        
        -- Mark this escalation as timed out
        UPDATE incident_escalations
        SET status = 'timeout'
        WHERE id = v_escalation.id;
        
        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- Function to calculate daily uptime for all components
CREATE OR REPLACE FUNCTION calculate_all_component_uptime(
    p_date DATE DEFAULT CURRENT_DATE - INTERVAL '1 day'
)
RETURNS INTEGER AS $$
DECLARE
    v_component RECORD;
    v_processed_count INTEGER := 0;
BEGIN
    FOR v_component IN
        SELECT id FROM status_page_components WHERE show_uptime = true
    LOOP
        PERFORM calculate_component_uptime(v_component.id, p_date);
        v_processed_count := v_processed_count + 1;
    END LOOP;

    RETURN v_processed_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- CLEANUP FUNCTIONS
-- =====================================================

-- Function to clean up old data
CREATE OR REPLACE FUNCTION cleanup_old_data()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER := 0;
    v_temp_count INTEGER;
BEGIN
    -- Clean up old check results (keep 30 days)
    DELETE FROM check_results 
    WHERE created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    -- Clean up old notification history (keep 90 days)
    DELETE FROM notification_history 
    WHERE created_at < NOW() - INTERVAL '90 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    -- Clean up old user activity logs (keep 180 days)
    DELETE FROM user_activity_log 
    WHERE created_at < NOW() - INTERVAL '180 days';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    -- Clean up old uptime calculations (keep 1 year)
    DELETE FROM uptime_calculations 
    WHERE date_day < CURRENT_DATE - INTERVAL '1 year';
    GET DIAGNOSTICS v_temp_count = ROW_COUNT;
    v_deleted_count := v_deleted_count + v_temp_count;

    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON FUNCTION create_incident_from_check_failure(UUID, UUID) IS 'Creates incident automatically from monitoring check failure';
COMMENT ON FUNCTION resolve_incident_from_check_recovery(UUID, UUID) IS 'Resolves incident automatically when monitoring check recovers';
COMMENT ON FUNCTION get_current_on_call_user(UUID, TIMESTAMP WITH TIME ZONE) IS 'Returns current on-call user for a schedule';
COMMENT ON FUNCTION escalate_incident(UUID, VARCHAR) IS 'Escalates incident to next level based on escalation policy';
COMMENT ON FUNCTION update_component_status_from_monitoring(UUID, BOOLEAN) IS 'Updates status page component status based on monitoring results';
COMMENT ON FUNCTION calculate_component_uptime(UUID, DATE) IS 'Calculates daily uptime statistics for a component';
COMMENT ON FUNCTION process_pending_escalations() IS 'Processes escalations that have timed out (for cron job)';
COMMENT ON FUNCTION calculate_all_component_uptime(DATE) IS 'Calculates uptime for all components (for cron job)';
COMMENT ON FUNCTION cleanup_old_data() IS 'Cleans up old data according to retention policies (for cron job)'; 