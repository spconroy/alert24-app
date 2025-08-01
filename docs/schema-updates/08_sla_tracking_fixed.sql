-- SLA Tracking Schema (Fixed)
-- This tracks service status changes over time for uptime calculations and timeline visualization

-- Create service_status_history table
CREATE TABLE IF NOT EXISTS public.service_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
    status VARCHAR(50) NOT NULL CHECK (status IN ('operational', 'degraded', 'down', 'maintenance')),
    started_at TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_service_status_history_service_id 
ON public.service_status_history(service_id);

CREATE INDEX IF NOT EXISTS idx_service_status_history_started_at 
ON public.service_status_history(started_at);

CREATE INDEX IF NOT EXISTS idx_service_status_history_status 
ON public.service_status_history(status);

-- Add comments for documentation
COMMENT ON TABLE public.service_status_history IS 'Tracks service status changes over time for SLA calculations';
COMMENT ON COLUMN public.service_status_history.service_id IS 'ID of the service';
COMMENT ON COLUMN public.service_status_history.status IS 'Status during this period';
COMMENT ON COLUMN public.service_status_history.started_at IS 'When this status period started';
COMMENT ON COLUMN public.service_status_history.ended_at IS 'When this status period ended (NULL for current)';

-- Function to calculate uptime percentage for a service over a time period
CREATE OR REPLACE FUNCTION calculate_service_uptime(
    p_service_id UUID,
    p_start_date TIMESTAMP WITH TIME ZONE DEFAULT NOW() - INTERVAL '30 days',
    p_end_date TIMESTAMP WITH TIME ZONE DEFAULT NOW()
) RETURNS DECIMAL(5,2) AS $$
DECLARE
    total_minutes DECIMAL;
    operational_minutes DECIMAL;
    uptime_percentage DECIMAL(5,2);
BEGIN
    -- Calculate total minutes in the period
    total_minutes := EXTRACT(EPOCH FROM (p_end_date - p_start_date)) / 60;
    
    -- Calculate operational minutes (operational + maintenance counts as uptime)
    SELECT COALESCE(SUM(
        CASE 
            WHEN ended_at IS NULL THEN 
                EXTRACT(EPOCH FROM (LEAST(p_end_date, NOW()) - GREATEST(started_at, p_start_date))) / 60
            ELSE 
                EXTRACT(EPOCH FROM (LEAST(ended_at, p_end_date) - GREATEST(started_at, p_start_date))) / 60
        END
    ), 0) INTO operational_minutes
    FROM public.service_status_history
    WHERE service_id = p_service_id
    AND status IN ('operational', 'maintenance')  -- Count both as uptime
    AND started_at < p_end_date
    AND (ended_at IS NULL OR ended_at > p_start_date);
    
    -- Calculate percentage
    IF total_minutes > 0 THEN
        uptime_percentage := (operational_minutes / total_minutes) * 100;
    ELSE
        uptime_percentage := 100.00;
    END IF;
    
    -- Ensure it's between 0 and 100
    uptime_percentage := GREATEST(0, LEAST(100, uptime_percentage));
    
    RETURN uptime_percentage;
END;
$$ LANGUAGE plpgsql;

-- Function to get status timeline data for visualization (simplified for 90 day periods)
CREATE OR REPLACE FUNCTION get_service_timeline(
    p_service_id UUID,
    p_days INTEGER DEFAULT 90
) RETURNS TABLE(
    period_start TIMESTAMP WITH TIME ZONE,
    period_end TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50),
    duration_hours DECIMAL(8,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ssh.started_at AS period_start,
        COALESCE(ssh.ended_at, NOW()) AS period_end,
        ssh.status,
        EXTRACT(EPOCH FROM (COALESCE(ssh.ended_at, NOW()) - ssh.started_at)) / 3600 AS duration_hours
    FROM public.service_status_history ssh
    WHERE ssh.service_id = p_service_id
    AND ssh.started_at >= NOW() - (p_days || ' days')::INTERVAL
    ORDER BY ssh.started_at;
END;
$$ LANGUAGE plpgsql;

-- Trigger function to automatically track status changes
CREATE OR REPLACE FUNCTION track_service_status_change()
RETURNS TRIGGER AS $$
BEGIN
    -- End the current status period if there is one
    UPDATE public.service_status_history 
    SET ended_at = NOW(), updated_at = NOW()
    WHERE service_id = NEW.id 
    AND ended_at IS NULL;
    
    -- Start a new status period
    INSERT INTO public.service_status_history (
        service_id,
        status,
        started_at
    ) VALUES (
        NEW.id,
        NEW.status,
        NOW()
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger on services table to track status changes
DROP TRIGGER IF EXISTS trigger_track_service_status_change ON public.services;
CREATE TRIGGER trigger_track_service_status_change
    AFTER UPDATE OF status ON public.services
    FOR EACH ROW
    WHEN (OLD.status IS DISTINCT FROM NEW.status)
    EXECUTE FUNCTION track_service_status_change();

-- Function to populate historical data for existing services (run once)
CREATE OR REPLACE FUNCTION populate_historical_status_data()
RETURNS INTEGER AS $$
DECLARE
    service_record RECORD;
    days_back INTEGER := 30;
    loop_timestamp TIMESTAMP WITH TIME ZONE;
    populated_count INTEGER := 0;
BEGIN
    FOR service_record IN 
        SELECT id, name, status FROM public.services WHERE deleted_at IS NULL
    LOOP
        -- Create initial historical data for the last 30 days
        loop_timestamp := NOW() - (days_back || ' days')::INTERVAL;
        
        -- Create mostly operational periods with occasional incidents
        WHILE loop_timestamp < NOW() - INTERVAL '1 hour' LOOP
            -- 90% chance of operational status for 6-24 hour periods
            IF random() < 0.9 THEN
                INSERT INTO public.service_status_history (
                    service_id,
                    status,
                    started_at,
                    ended_at
                ) VALUES (
                    service_record.id,
                    'operational',
                    loop_timestamp,
                    loop_timestamp + ((6 + random() * 18) || ' hours')::INTERVAL
                );
                loop_timestamp := loop_timestamp + ((6 + random() * 18) || ' hours')::INTERVAL;
            -- 7% chance of degraded status for 1-6 hours
            ELSIF random() < 0.97 THEN
                INSERT INTO public.service_status_history (
                    service_id,
                    status,
                    started_at,
                    ended_at
                ) VALUES (
                    service_record.id,
                    'degraded',
                    loop_timestamp,
                    loop_timestamp + ((1 + random() * 5) || ' hours')::INTERVAL
                );
                loop_timestamp := loop_timestamp + ((1 + random() * 5) || ' hours')::INTERVAL;
            -- 2% chance of maintenance for 2-8 hours
            ELSIF random() < 0.99 THEN
                INSERT INTO public.service_status_history (
                    service_id,
                    status,
                    started_at,
                    ended_at
                ) VALUES (
                    service_record.id,
                    'maintenance',
                    loop_timestamp,
                    loop_timestamp + ((2 + random() * 6) || ' hours')::INTERVAL
                );
                loop_timestamp := loop_timestamp + ((2 + random() * 6) || ' hours')::INTERVAL;
            -- 1% chance of outage for 15 minutes to 2 hours
            ELSE
                INSERT INTO public.service_status_history (
                    service_id,
                    status,
                    started_at,
                    ended_at
                ) VALUES (
                    service_record.id,
                    'down',
                    loop_timestamp,
                    loop_timestamp + ((15 + random() * 105) || ' minutes')::INTERVAL
                );
                loop_timestamp := loop_timestamp + ((15 + random() * 105) || ' minutes')::INTERVAL;
            END IF;
        END LOOP;
        
        -- Add current status period (ongoing)
        INSERT INTO public.service_status_history (
            service_id,
            status,
            started_at,
            ended_at
        ) VALUES (
            service_record.id,
            service_record.status,
            loop_timestamp,
            NULL  -- Ongoing period
        );
        
        populated_count := populated_count + 1;
    END LOOP;
    
    RETURN populated_count;
END;
$$ LANGUAGE plpgsql; 