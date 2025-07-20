-- Update the handle_check_result function to respect auto_create_incidents setting
-- This prevents duplicate incidents for services with existing ongoing incidents

-- First, enhance the create_incident_from_check_failure function to check for 
-- existing incidents on the same service
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

    -- If incident already exists for this check, just update the check result
    IF v_existing_incident_id IS NOT NULL THEN
        UPDATE check_results 
        SET incident_id = v_existing_incident_id, triggered_incident = false
        WHERE id = p_check_result_id;
        RETURN v_existing_incident_id;
    END IF;

    -- NEW: If this check is linked to a service, check for existing ongoing incidents for that service
    IF v_check_record.linked_service_id IS NOT NULL THEN
        SELECT i.id INTO v_existing_incident_id
        FROM incidents i
        WHERE i.status NOT IN ('resolved', 'postmortem')
          AND i.organization_id = v_organization_id
          AND (
            -- Check if the incident is directly linked to this service
            EXISTS (
              SELECT 1 FROM jsonb_array_elements_text(COALESCE(i.affected_services, '[]'::jsonb)) 
              AS service_name 
              WHERE service_name = (SELECT name FROM services WHERE id = v_check_record.linked_service_id)
            )
            OR
            -- Check if another monitoring check for the same service already has an incident
            EXISTS (
              SELECT 1 FROM incidents i2
              JOIN monitoring_checks mc2 ON i2.source_id = mc2.id::text
              WHERE i2.id = i.id
                AND mc2.linked_service_id = v_check_record.linked_service_id
                AND i2.source = 'monitoring'
            )
          )
        ORDER BY i.created_at DESC
        LIMIT 1;

        -- If incident already exists for this service, link this check result to it
        IF v_existing_incident_id IS NOT NULL THEN
            UPDATE check_results 
            SET incident_id = v_existing_incident_id, triggered_incident = false
            WHERE id = p_check_result_id;
            
            -- Add an update to the existing incident about this additional check failure
            INSERT INTO incident_updates (
                incident_id,
                message,
                status,
                update_type,
                posted_by,
                visible_to_subscribers
            ) VALUES (
                v_existing_incident_id,
                'Additional monitoring check "' || v_check_record.name || '" is also failing for this service.',
                'investigating',
                'escalation',
                v_created_by,
                true
            );
            
            RETURN v_existing_incident_id;
        END IF;
    END IF;

    -- Create new incident (rest of function remains the same)
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
        started_at,
        affected_services
    ) VALUES (
        v_organization_id,
        COALESCE(v_check_record.incident_title_template, 'Monitoring Alert: ' || v_check_record.name),
        COALESCE(v_check_record.incident_description_template, 'Monitoring check "' || v_check_record.name || '" has failed. Target: ' || v_check_record.target_url),
        COALESCE(v_check_record.incident_severity::incident_severity, 'medium'::incident_severity),
        'open'::incident_status,
        'monitoring',
        p_monitoring_check_id::text,
        v_created_by,
        v_check_record.assigned_escalation_policy_id,
        NOW(),
        -- Include the linked service in affected_services if it exists
        CASE 
            WHEN v_check_record.linked_service_id IS NOT NULL THEN 
                jsonb_build_array((SELECT name FROM services WHERE id = v_check_record.linked_service_id))
            ELSE '[]'::jsonb
        END
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
        'investigating',
        'status_change',
        v_created_by,
        true
    );

    RETURN v_incident_id;
END;
$$ LANGUAGE plpgsql;

-- Now update the handle_check_result function to respect auto_create_incidents setting
CREATE OR REPLACE FUNCTION handle_check_result()
RETURNS TRIGGER AS $$
DECLARE
    v_previous_result BOOLEAN;
    v_check_config JSONB;
    v_alert_threshold INTEGER;
    v_consecutive_failures INTEGER;
    v_monitoring_check RECORD;
BEGIN
    -- Get monitoring check configuration and settings
    SELECT configuration, auto_create_incidents, auto_resolve_incidents
    INTO v_monitoring_check
    FROM monitoring_checks 
    WHERE id = NEW.monitoring_check_id;

    v_check_config := v_monitoring_check.configuration;
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
        -- AND if auto_create_incidents is enabled for this monitoring check
        IF (v_previous_result IS NULL OR v_previous_result = true) 
           AND COALESCE(v_monitoring_check.auto_create_incidents, false) = true THEN
            PERFORM create_incident_from_check_failure(NEW.monitoring_check_id, NEW.id);
        END IF;
    END IF;

    -- If this is a success and previous was failure, try to resolve incident
    -- Only auto-resolve if auto_resolve_incidents is enabled (default true for backward compatibility)
    IF NEW.is_successful AND (v_previous_result IS NULL OR v_previous_result = false) THEN
        IF COALESCE(v_monitoring_check.auto_resolve_incidents, true) = true THEN
            PERFORM resolve_incident_from_check_recovery(NEW.monitoring_check_id, NEW.id);
        END IF;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Add comments to document the changes
COMMENT ON FUNCTION create_incident_from_check_failure(UUID, UUID) IS 'Creates incident automatically from monitoring check failure. Enhanced to prevent duplicate incidents for the same service and use custom incident templates.';
COMMENT ON FUNCTION handle_check_result() IS 'Updated to respect auto_create_incidents and auto_resolve_incidents flags. Prevents creation of duplicate incidents for services that already have ongoing incidents.';

-- Add index to improve performance of service-based incident lookups
CREATE INDEX IF NOT EXISTS idx_incidents_affected_services_gin ON incidents USING gin(affected_services);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_linked_service ON monitoring_checks(linked_service_id) WHERE linked_service_id IS NOT NULL;

-- Migration notes
-- This migration enhances incident creation from monitoring checks with the following improvements:
-- 1. Respects the auto_create_incidents flag - incidents are only created when explicitly enabled
-- 2. Prevents duplicate incidents for the same service - if a service already has an ongoing incident, 
--    additional monitoring check failures for that service will be linked to the existing incident
-- 3. Uses custom incident title and description templates when configured
-- 4. Uses the assigned escalation policy from the monitoring check
-- 5. Automatically includes the linked service in the incident's affected_services array
-- 6. Adds performance indexes for better query performance on service-based lookups