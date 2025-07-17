-- =====================================================
-- Alert24 Check Results Table Migration
-- =====================================================
-- This script creates the check_results table and related infrastructure
-- Run this in Supabase SQL Editor to enable proper monitoring results storage

-- Create check_results table if it doesn't exist
CREATE TABLE IF NOT EXISTS check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_check_id UUID NOT NULL,
    monitoring_location_id UUID DEFAULT '00000000-0000-0000-0000-000000000001',
    
    -- Result details
    is_successful BOOLEAN NOT NULL,
    response_time INTEGER, -- milliseconds
    status_code INTEGER,
    
    -- Response information
    response_body TEXT,
    response_headers JSONB,
    error_message TEXT,
    
    -- SSL specific (for HTTPS/SSL checks)
    ssl_certificate_info JSONB,
    
    -- DNS specific (for DNS checks)
    dns_results JSONB,
    
    -- Keyword specific (for keyword checks)
    keyword_results JSONB,
    
    -- Incident correlation
    incident_id UUID,
    triggered_incident BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create monitoring_locations table if it doesn't exist (referenced by check_results)
CREATE TABLE IF NOT EXISTS monitoring_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Location identification
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE,
    description TEXT,
    
    -- Geographic information
    region VARCHAR(100) NOT NULL,
    country VARCHAR(100) NOT NULL,
    city VARCHAR(100),
    latitude DECIMAL(10, 8),
    longitude DECIMAL(11, 8),
    
    -- Location status
    is_active BOOLEAN DEFAULT true,
    is_default BOOLEAN DEFAULT false,
    
    -- Performance metrics
    avg_response_time INTEGER DEFAULT 0,
    reliability_score DECIMAL(5, 2) DEFAULT 100.0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Insert default monitoring locations if they don't exist
INSERT INTO monitoring_locations (id, name, code, description, region, country, city, latitude, longitude, is_default)
VALUES 
  ('00000000-0000-0000-0000-000000000001', 'US East (N. Virginia)', 'us-east-1', 'Primary US East location', 'North America', 'United States', 'Ashburn', 39.0458, -77.4976, true),
  ('00000000-0000-0000-0000-000000000002', 'US West (Oregon)', 'us-west-2', 'Primary US West location', 'North America', 'United States', 'Portland', 45.5152, -122.6784, false),
  ('00000000-0000-0000-0000-000000000003', 'EU (Frankfurt)', 'eu-central-1', 'Primary EU location', 'Europe', 'Germany', 'Frankfurt', 50.1109, 8.6821, false),
  ('00000000-0000-0000-0000-000000000004', 'Asia Pacific (Singapore)', 'ap-southeast-1', 'Primary APAC location', 'Asia Pacific', 'Singapore', 'Singapore', 1.3521, 103.8198, false),
  ('00000000-0000-0000-0000-000000000005', 'Asia Pacific (Sydney)', 'ap-southeast-2', 'Secondary APAC location', 'Asia Pacific', 'Australia', 'Sydney', -33.8688, 151.2093, false)
ON CONFLICT (code) DO NOTHING;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_check_results_monitoring_check_id ON check_results(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_check_results_location_id ON check_results(monitoring_location_id);
CREATE INDEX IF NOT EXISTS idx_check_results_created_at ON check_results(created_at);
CREATE INDEX IF NOT EXISTS idx_check_results_is_successful ON check_results(is_successful);
CREATE INDEX IF NOT EXISTS idx_check_results_incident_id ON check_results(incident_id);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_check_results_check_location_time ON check_results(monitoring_check_id, monitoring_location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_check_results_check_success_time ON check_results(monitoring_check_id, is_successful, created_at);

-- Add foreign key constraints if the referenced tables exist
DO $$ 
BEGIN
    -- Add foreign key to monitoring_check_id if services table exists and has monitoring checks
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'services') THEN
        -- For now, we'll skip the foreign key constraint since monitoring checks are stored in services table
        -- This can be added later when full monitoring_checks table is implemented
        NULL;
    END IF;
    
    -- Add foreign key to monitoring_location_id
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'monitoring_locations') THEN
        BEGIN
            ALTER TABLE check_results 
            ADD CONSTRAINT fk_check_results_monitoring_location
            FOREIGN KEY (monitoring_location_id) REFERENCES monitoring_locations(id);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
    
    -- Add foreign key to incident_id if incidents table exists
    IF EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'incidents') THEN
        BEGIN
            ALTER TABLE check_results 
            ADD CONSTRAINT fk_check_results_incident
            FOREIGN KEY (incident_id) REFERENCES incidents(id);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END;
    END IF;
END $$;

-- Add constraint to ensure only one default location
ALTER TABLE monitoring_locations 
ADD CONSTRAINT unique_default_location 
EXCLUDE (1 WITH =) WHERE (is_default = true);

-- Grant appropriate permissions (adjust role name as needed)
-- GRANT SELECT, INSERT, UPDATE, DELETE ON check_results TO your_app_role;
-- GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_locations TO your_app_role;

-- Verification queries
DO $$
BEGIN
    RAISE NOTICE 'Check results table created successfully';
    RAISE NOTICE 'Monitoring locations table created with % locations', 
        (SELECT COUNT(*) FROM monitoring_locations);
    RAISE NOTICE 'Migration completed successfully!';
END $$; 