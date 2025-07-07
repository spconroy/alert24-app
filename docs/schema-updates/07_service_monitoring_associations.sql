-- Service Monitoring Associations Schema
-- This table links status page services with monitoring checks for automatic status updates

-- Create the service_monitoring_checks table
CREATE TABLE IF NOT EXISTS public.service_monitoring_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    monitoring_check_id UUID NOT NULL REFERENCES public.monitoring_checks(id) ON DELETE CASCADE,
    failure_threshold_minutes INTEGER NOT NULL DEFAULT 5,
    failure_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(service_id, monitoring_check_id)
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_monitoring_checks_service_id 
ON public.service_monitoring_checks(service_id);

CREATE INDEX IF NOT EXISTS idx_service_monitoring_checks_monitoring_check_id 
ON public.service_monitoring_checks(monitoring_check_id);

-- Add comments for documentation
COMMENT ON TABLE public.service_monitoring_checks IS 'Associates monitoring checks with status page services for automatic status updates';
COMMENT ON COLUMN public.service_monitoring_checks.service_id IS 'ID of the status page service';
COMMENT ON COLUMN public.service_monitoring_checks.monitoring_check_id IS 'ID of the monitoring check';
COMMENT ON COLUMN public.service_monitoring_checks.failure_threshold_minutes IS 'How long the check must be failing before updating service status';
COMMENT ON COLUMN public.service_monitoring_checks.failure_message IS 'Custom message to display when this check fails';

-- Create a function to automatically update service status based on monitoring check failures
CREATE OR REPLACE FUNCTION update_service_status_from_monitoring()
RETURNS TRIGGER AS $$
DECLARE
    service_record RECORD;
    check_config RECORD;
    failure_start_time TIMESTAMP WITH TIME ZONE;
    consecutive_failures INTEGER;
BEGIN
    -- Only process if this is a failed check result
    IF NEW.is_successful = TRUE THEN
        -- Check was successful, potentially update service status to operational
        FOR service_record IN 
            SELECT DISTINCT s.id, s.status, s.name
            FROM public.services s
            JOIN public.service_monitoring_checks smc ON s.id = smc.service_id
            WHERE smc.monitoring_check_id = NEW.monitoring_check_id
        LOOP
            -- Check if all monitoring checks for this service are now passing
            IF NOT EXISTS (
                SELECT 1 
                FROM public.service_monitoring_checks smc2
                JOIN public.monitoring_checks mc ON smc2.monitoring_check_id = mc.id
                WHERE smc2.service_id = service_record.id
                AND mc.status = 'active'
                AND (
                    SELECT cr.is_successful
                    FROM public.check_results cr
                    WHERE cr.monitoring_check_id = mc.id
                    ORDER BY cr.created_at DESC
                    LIMIT 1
                ) = FALSE
            ) THEN
                -- All checks are passing, set service to operational if it was down/degraded
                IF service_record.status IN ('down', 'degraded') THEN
                    UPDATE public.services 
                    SET status = 'operational', updated_at = NOW()
                    WHERE id = service_record.id;
                    
                    -- Log the status change
                    INSERT INTO public.status_updates (
                        status_page_id,
                        title,
                        message,
                        status,
                        created_at,
                        updated_at
                    )
                    SELECT 
                        sp.id,
                        service_record.name || ' - Service Restored',
                        'Service is now operational. All monitoring checks are passing.',
                        'operational',
                        NOW(),
                        NOW()
                    FROM public.services s
                    JOIN public.status_pages sp ON s.status_page_id = sp.id
                    WHERE s.id = service_record.id;
                END IF;
            END IF;
        END LOOP;
        
        RETURN NEW;
    END IF;
    
    -- Process failed check result
    FOR check_config IN 
        SELECT smc.service_id, smc.failure_threshold_minutes, smc.failure_message,
               s.name as service_name, s.status as current_status, sp.id as status_page_id
        FROM public.service_monitoring_checks smc
        JOIN public.services s ON smc.service_id = s.id
        JOIN public.status_pages sp ON s.status_page_id = sp.id
        WHERE smc.monitoring_check_id = NEW.monitoring_check_id
    LOOP
        -- Find when the consecutive failures started
        SELECT cr.created_at INTO failure_start_time
        FROM public.check_results cr
        WHERE cr.monitoring_check_id = NEW.monitoring_check_id
        AND cr.created_at <= NEW.created_at
        AND cr.is_successful = FALSE
        ORDER BY cr.created_at DESC
        LIMIT 1 OFFSET (
            SELECT COUNT(*) - 1
            FROM (
                SELECT cr2.created_at, cr2.is_successful,
                       LAG(cr2.is_successful) OVER (ORDER BY cr2.created_at) as prev_successful
                FROM public.check_results cr2
                WHERE cr2.monitoring_check_id = NEW.monitoring_check_id
                AND cr2.created_at <= NEW.created_at
                ORDER BY cr2.created_at DESC
                LIMIT 50  -- Look at last 50 results
            ) recent_results
            WHERE is_successful = FALSE AND (prev_successful = TRUE OR prev_successful IS NULL)
        );
        
        -- If failure has been going on for longer than threshold, update service status
        IF failure_start_time IS NOT NULL 
           AND EXTRACT(EPOCH FROM (NEW.created_at - failure_start_time)) / 60 >= check_config.failure_threshold_minutes
           AND check_config.current_status != 'down' 
        THEN
            -- Update service status to down
            UPDATE public.services 
            SET status = 'down', updated_at = NOW()
            WHERE id = check_config.service_id;
            
            -- Create status update entry
            INSERT INTO public.status_updates (
                status_page_id,
                title,
                message,
                status,
                created_at,
                updated_at
            ) VALUES (
                check_config.status_page_id,
                check_config.service_name || ' - Service Degraded',
                COALESCE(
                    check_config.failure_message,
                    'We are experiencing issues with ' || check_config.service_name || '. Our team is investigating.'
                ),
                'down',
                NOW(),
                NOW()
            );
        END IF;
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update service status when check results change
DROP TRIGGER IF EXISTS trigger_update_service_status_from_monitoring ON public.check_results;
CREATE TRIGGER trigger_update_service_status_from_monitoring
    AFTER INSERT ON public.check_results
    FOR EACH ROW
    EXECUTE FUNCTION update_service_status_from_monitoring();

-- Create a manual function to sync all service statuses (useful for initial setup)
CREATE OR REPLACE FUNCTION sync_all_service_statuses()
RETURNS INTEGER AS $$
DECLARE
    updated_count INTEGER := 0;
    service_record RECORD;
    has_failing_checks BOOLEAN;
BEGIN
    FOR service_record IN 
        SELECT DISTINCT s.id, s.name, s.status, sp.id as status_page_id
        FROM public.services s
        JOIN public.status_pages sp ON s.status_page_id = sp.id
        WHERE EXISTS (
            SELECT 1 FROM public.service_monitoring_checks smc 
            WHERE smc.service_id = s.id
        )
    LOOP
        -- Check if any monitoring checks are currently failing
        SELECT EXISTS (
            SELECT 1 
            FROM public.service_monitoring_checks smc
            JOIN public.monitoring_checks mc ON smc.monitoring_check_id = mc.id
            WHERE smc.service_id = service_record.id
            AND mc.status = 'active'
            AND (
                SELECT cr.is_successful
                FROM public.check_results cr
                WHERE cr.monitoring_check_id = mc.id
                ORDER BY cr.created_at DESC
                LIMIT 1
            ) = FALSE
        ) INTO has_failing_checks;
        
        -- Update service status accordingly
        IF has_failing_checks AND service_record.status = 'operational' THEN
            UPDATE public.services 
            SET status = 'down', updated_at = NOW()
            WHERE id = service_record.id;
            updated_count := updated_count + 1;
        ELSIF NOT has_failing_checks AND service_record.status IN ('down', 'degraded') THEN
            UPDATE public.services 
            SET status = 'operational', updated_at = NOW()
            WHERE id = service_record.id;
            updated_count := updated_count + 1;
        END IF;
    END LOOP;
    
    RETURN updated_count;
END;
$$ LANGUAGE plpgsql; 