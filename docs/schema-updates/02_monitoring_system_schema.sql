-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 02: Monitoring System
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- MONITORING CHECK TYPE ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE monitoring_check_type AS ENUM (
        'http',
        'https',
        'ping',
        'tcp',
        'udp',
        'dns',
        'ssl',
        'keyword',
        'api',
        'port'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- MONITORING CHECK STATUS ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE monitoring_check_status AS ENUM (
        'active',
        'paused',
        'disabled',
        'maintenance'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- MONITORING LOCATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS monitoring_locations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Location identification
    name VARCHAR(255) NOT NULL,
    code VARCHAR(10) NOT NULL UNIQUE, -- 'us-east-1', 'eu-west-1', etc.
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
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    reliability_score DECIMAL(5, 2) DEFAULT 100.0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MONITORING CHECKS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS monitoring_checks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Check identification
    name VARCHAR(255) NOT NULL,
    description TEXT,
    check_type monitoring_check_type NOT NULL,
    
    -- Target configuration
    target_url VARCHAR(2048), -- URL, IP, or hostname
    target_port INTEGER,
    target_timeout INTEGER DEFAULT 30, -- seconds
    
    -- Check configuration (JSON for flexibility)
    configuration JSONB NOT NULL DEFAULT '{}'::jsonb,
    -- Example configurations by type:
    -- HTTP/HTTPS: {
    --   "method": "GET",
    --   "headers": {"User-Agent": "Alert24-Monitor"},
    --   "expected_status_codes": [200, 201],
    --   "follow_redirects": true,
    --   "verify_ssl": true
    -- }
    -- Keyword: {
    --   "keyword": "Welcome",
    --   "keyword_type": "present|absent",
    --   "case_sensitive": false
    -- }
    -- DNS: {
    --   "record_type": "A",
    --   "expected_result": "1.2.3.4",
    --   "name_server": "8.8.8.8"
    -- }
    -- SSL: {
    --   "days_before_expiry": 30,
    --   "verify_chain": true
    -- }
    
    -- Scheduling
    check_interval INTEGER NOT NULL DEFAULT 300, -- seconds (5 minutes)
    retry_count INTEGER DEFAULT 3,
    retry_interval INTEGER DEFAULT 60, -- seconds
    
    -- Locations
    monitoring_locations UUID[] DEFAULT '{}', -- Array of location IDs
    
    -- Status and maintenance
    status monitoring_check_status DEFAULT 'active',
    maintenance_windows JSONB DEFAULT '[]'::jsonb,
    -- Example maintenance_windows:
    -- [
    --   {
    --     "start": "2024-01-01T02:00:00Z",
    --     "end": "2024-01-01T04:00:00Z",
    --     "reason": "Scheduled maintenance"
    --   }
    -- ]
    
    -- Alerting configuration
    alert_after_failures INTEGER DEFAULT 2,
    alert_on_recovery BOOLEAN DEFAULT true,
    escalation_policy_id UUID REFERENCES escalation_policies(id),
    
    -- Integration with status pages
    status_page_component_id UUID, -- Will reference status_page_components
    auto_update_status BOOLEAN DEFAULT true,
    
    -- Metadata
    tags TEXT[],
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CHECK RESULTS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS check_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_check_id UUID NOT NULL REFERENCES monitoring_checks(id) ON DELETE CASCADE,
    monitoring_location_id UUID NOT NULL REFERENCES monitoring_locations(id),
    
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
    -- Example ssl_certificate_info:
    -- {
    --   "issuer": "Let's Encrypt",
    --   "expires_at": "2024-06-01T00:00:00Z",
    --   "subject": "*.example.com",
    --   "days_until_expiry": 45
    -- }
    
    -- DNS specific (for DNS checks)
    dns_results JSONB,
    -- Example dns_results:
    -- {
    --   "record_type": "A",
    --   "results": ["1.2.3.4", "5.6.7.8"],
    --   "query_time": 50
    -- }
    
    -- Keyword specific (for keyword checks)
    keyword_results JSONB,
    -- Example keyword_results:
    -- {
    --   "keyword": "Welcome",
    --   "found": true,
    --   "matches": 3,
    --   "context": "Welcome to our website"
    -- }
    
    -- Incident correlation
    incident_id UUID REFERENCES incidents(id),
    triggered_incident BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CHECK SCHEDULES TABLE (for cron-like scheduling)
-- =====================================================

CREATE TABLE IF NOT EXISTS check_schedules (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_check_id UUID NOT NULL REFERENCES monitoring_checks(id) ON DELETE CASCADE,
    
    -- Schedule configuration
    cron_expression VARCHAR(255), -- Standard cron expression
    next_run_at TIMESTAMP WITH TIME ZONE,
    last_run_at TIMESTAMP WITH TIME ZONE,
    
    -- Execution tracking
    is_running BOOLEAN DEFAULT false,
    run_count INTEGER DEFAULT 0,
    failure_count INTEGER DEFAULT 0,
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MONITORING ALERTS TABLE (for alert state tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS monitoring_alerts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_check_id UUID NOT NULL REFERENCES monitoring_checks(id) ON DELETE CASCADE,
    
    -- Alert details
    alert_type VARCHAR(50) NOT NULL, -- 'failure', 'recovery', 'ssl_expiry', 'performance'
    severity incident_severity NOT NULL DEFAULT 'medium',
    message TEXT NOT NULL,
    
    -- Alert state
    is_active BOOLEAN DEFAULT true,
    acknowledged_at TIMESTAMP WITH TIME ZONE,
    acknowledged_by UUID REFERENCES users(id),
    resolved_at TIMESTAMP WITH TIME ZONE,
    
    -- Correlation
    incident_id UUID REFERENCES incidents(id),
    check_result_id UUID REFERENCES check_results(id),
    
    -- Notification tracking
    notifications_sent INTEGER DEFAULT 0,
    last_notification_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- MONITORING STATISTICS TABLE (for performance tracking)
-- =====================================================

CREATE TABLE IF NOT EXISTS monitoring_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    monitoring_check_id UUID NOT NULL REFERENCES monitoring_checks(id) ON DELETE CASCADE,
    
    -- Time window
    date_hour TIMESTAMP WITH TIME ZONE NOT NULL, -- Truncated to hour
    
    -- Statistics
    total_checks INTEGER DEFAULT 0,
    successful_checks INTEGER DEFAULT 0,
    failed_checks INTEGER DEFAULT 0,
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    min_response_time INTEGER DEFAULT 0,
    max_response_time INTEGER DEFAULT 0,
    
    -- Uptime calculation
    uptime_percentage DECIMAL(5, 2) DEFAULT 100.0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CONSTRAINTS AND INDEXES
-- =====================================================

-- Unique constraints
ALTER TABLE monitoring_locations 
ADD CONSTRAINT unique_default_location 
EXCLUDE (1 WITH =) WHERE (is_default = true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_organization_id ON monitoring_checks(organization_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_check_type ON monitoring_checks(check_type);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_status ON monitoring_checks(status);
CREATE INDEX IF NOT EXISTS idx_monitoring_checks_created_at ON monitoring_checks(created_at);

CREATE INDEX IF NOT EXISTS idx_check_results_monitoring_check_id ON check_results(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_check_results_location_id ON check_results(monitoring_location_id);
CREATE INDEX IF NOT EXISTS idx_check_results_created_at ON check_results(created_at);
CREATE INDEX IF NOT EXISTS idx_check_results_is_successful ON check_results(is_successful);
CREATE INDEX IF NOT EXISTS idx_check_results_incident_id ON check_results(incident_id);

CREATE INDEX IF NOT EXISTS idx_check_schedules_monitoring_check_id ON check_schedules(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_check_schedules_next_run_at ON check_schedules(next_run_at);
CREATE INDEX IF NOT EXISTS idx_check_schedules_is_active ON check_schedules(is_active);

CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_monitoring_check_id ON monitoring_alerts(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_is_active ON monitoring_alerts(is_active);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_incident_id ON monitoring_alerts(incident_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_alerts_created_at ON monitoring_alerts(created_at);

CREATE INDEX IF NOT EXISTS idx_monitoring_statistics_monitoring_check_id ON monitoring_statistics(monitoring_check_id);
CREATE INDEX IF NOT EXISTS idx_monitoring_statistics_date_hour ON monitoring_statistics(date_hour);

-- Composite indexes for common queries
CREATE INDEX IF NOT EXISTS idx_check_results_check_location_time ON check_results(monitoring_check_id, monitoring_location_id, created_at);
CREATE INDEX IF NOT EXISTS idx_monitoring_statistics_check_date ON monitoring_statistics(monitoring_check_id, date_hour);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS (add after status page schema)
-- =====================================================

-- This will be added after status_page_components table exists
-- ALTER TABLE monitoring_checks 
-- ADD CONSTRAINT fk_monitoring_checks_status_page_component 
-- FOREIGN KEY (status_page_component_id) REFERENCES status_page_components(id);

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE monitoring_locations IS 'Global monitoring probe locations';
COMMENT ON TABLE monitoring_checks IS 'Monitoring check configurations';
COMMENT ON TABLE check_results IS 'Individual monitoring check results';
COMMENT ON TABLE check_schedules IS 'Cron-based scheduling for monitoring checks';
COMMENT ON TABLE monitoring_alerts IS 'Alert state tracking for monitoring checks';
COMMENT ON TABLE monitoring_statistics IS 'Hourly aggregated monitoring statistics';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_locations TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_checks TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON check_results TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON check_schedules TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_alerts TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON monitoring_statistics TO alert24;

-- =====================================================
-- INITIAL DATA - Default Monitoring Locations
-- =====================================================

INSERT INTO monitoring_locations (name, code, description, region, country, city, latitude, longitude, is_default)
VALUES 
  ('US East (N. Virginia)', 'us-east-1', 'Primary US East location', 'North America', 'United States', 'Ashburn', 39.0458, -77.4976, true),
  ('US West (Oregon)', 'us-west-2', 'Primary US West location', 'North America', 'United States', 'Portland', 45.5152, -122.6784, false),
  ('EU (Frankfurt)', 'eu-central-1', 'Primary EU location', 'Europe', 'Germany', 'Frankfurt', 50.1109, 8.6821, false),
  ('Asia Pacific (Singapore)', 'ap-southeast-1', 'Primary APAC location', 'Asia Pacific', 'Singapore', 'Singapore', 1.3521, 103.8198, false),
  ('Asia Pacific (Sydney)', 'ap-southeast-2', 'Secondary APAC location', 'Asia Pacific', 'Australia', 'Sydney', -33.8688, 151.2093, false)
ON CONFLICT (code) DO NOTHING; 