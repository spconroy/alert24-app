-- Fix Schema Issues Migration
-- This script addresses missing columns identified in the application logs

-- Add auto_recovery column to services table
ALTER TABLE services 
ADD COLUMN IF NOT EXISTS auto_recovery BOOLEAN DEFAULT true;

-- Add is_successful column to check_results table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'check_results') THEN
        ALTER TABLE check_results 
        ADD COLUMN IF NOT EXISTS is_successful BOOLEAN DEFAULT true;
    END IF;
END $$;

-- Add monitoring_check_id column to service_monitoring_checks table (if it exists)
DO $$ 
BEGIN
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'service_monitoring_checks') THEN
        ALTER TABLE service_monitoring_checks 
        ADD COLUMN IF NOT EXISTS monitoring_check_id UUID;
    END IF;
END $$;

-- Create check_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    check_time TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    is_successful BOOLEAN DEFAULT true,
    response_time INTEGER, -- in milliseconds
    status_code INTEGER,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create service_monitoring_checks table if it doesn't exist
CREATE TABLE IF NOT EXISTS service_monitoring_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    service_id UUID REFERENCES services(id) ON DELETE CASCADE,
    monitoring_check_id UUID,
    check_type VARCHAR(50) DEFAULT 'http',
    check_interval INTEGER DEFAULT 300, -- seconds
    timeout INTEGER DEFAULT 30, -- seconds
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_results_service_id ON check_results(service_id);
CREATE INDEX IF NOT EXISTS idx_check_results_check_time ON check_results(check_time);
CREATE INDEX IF NOT EXISTS idx_service_monitoring_checks_service_id ON service_monitoring_checks(service_id);

-- Update any existing records to have sensible defaults
UPDATE services SET auto_recovery = true WHERE auto_recovery IS NULL;

COMMIT; 