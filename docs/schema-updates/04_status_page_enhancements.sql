-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 04: Status Page Enhancements
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- COMPONENT STATUS ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE component_status AS ENUM (
        'operational',
        'degraded_performance',
        'partial_outage',
        'major_outage',
        'maintenance'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- SUBSCRIBER TYPE ENUM
-- =====================================================

DO $$ BEGIN
    CREATE TYPE subscriber_type AS ENUM (
        'email',
        'sms',
        'webhook',
        'rss'
    );
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- =====================================================
-- ENHANCE EXISTING STATUS_PAGES TABLE
-- =====================================================

-- Add incident management columns to existing status_pages table
ALTER TABLE status_pages 
ADD COLUMN IF NOT EXISTS auto_incident_updates BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS incident_display_hours INTEGER DEFAULT 72, -- Hours to show resolved incidents
ADD COLUMN IF NOT EXISTS maintenance_display_days INTEGER DEFAULT 14, -- Days to show maintenance incidents
ADD COLUMN IF NOT EXISTS component_grouping_enabled BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS uptime_display_days INTEGER DEFAULT 90, -- Days for uptime display
ADD COLUMN IF NOT EXISTS twitter_username VARCHAR(100),
ADD COLUMN IF NOT EXISTS custom_css TEXT,
ADD COLUMN IF NOT EXISTS custom_js TEXT,
ADD COLUMN IF NOT EXISTS header_image_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS favicon_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS google_analytics_id VARCHAR(50),
ADD COLUMN IF NOT EXISTS announcement_banner TEXT,
ADD COLUMN IF NOT EXISTS announcement_banner_type VARCHAR(20) DEFAULT 'info', -- 'info', 'warning', 'success', 'error'
ADD COLUMN IF NOT EXISTS timezone VARCHAR(50) DEFAULT 'UTC',
ADD COLUMN IF NOT EXISTS date_format VARCHAR(50) DEFAULT 'MMMM D, YYYY',
ADD COLUMN IF NOT EXISTS time_format VARCHAR(50) DEFAULT 'h:mm A';

-- Add comments for new columns
COMMENT ON COLUMN status_pages.auto_incident_updates IS 'Automatically update status page when incidents are created/resolved';
COMMENT ON COLUMN status_pages.incident_display_hours IS 'Hours to display resolved incidents on status page';
COMMENT ON COLUMN status_pages.maintenance_display_days IS 'Days to display maintenance incidents';
COMMENT ON COLUMN status_pages.component_grouping_enabled IS 'Enable grouping of components by category';
COMMENT ON COLUMN status_pages.uptime_display_days IS 'Number of days to show in uptime graphs';
COMMENT ON COLUMN status_pages.custom_css IS 'Custom CSS for status page styling';
COMMENT ON COLUMN status_pages.custom_js IS 'Custom JavaScript for status page';

-- =====================================================
-- ENHANCE EXISTING STATUS_PAGE_COMPONENTS TABLE
-- =====================================================

-- Add incident management columns to existing status_page_components table
ALTER TABLE status_page_components 
ADD COLUMN IF NOT EXISTS current_status component_status DEFAULT 'operational',
ADD COLUMN IF NOT EXISTS monitoring_check_ids UUID[], -- Array of monitoring check IDs
ADD COLUMN IF NOT EXISTS auto_update_from_monitoring BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS status_aggregation_rule VARCHAR(50) DEFAULT 'worst_status', -- 'worst_status', 'majority', 'any_failure'
ADD COLUMN IF NOT EXISTS parent_component_id UUID REFERENCES status_page_components(id),
ADD COLUMN IF NOT EXISTS component_group VARCHAR(100),
ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS is_visible BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS show_uptime BOOLEAN DEFAULT true,
ADD COLUMN IF NOT EXISTS uptime_calculation_method VARCHAR(50) DEFAULT 'operational_percentage', -- 'operational_percentage', 'response_time_based'
ADD COLUMN IF NOT EXISTS description TEXT,
ADD COLUMN IF NOT EXISTS link_url VARCHAR(500);

-- Add comments for new columns
COMMENT ON COLUMN status_page_components.current_status IS 'Current operational status of the component';
COMMENT ON COLUMN status_page_components.monitoring_check_ids IS 'Array of monitoring check IDs that affect this component';
COMMENT ON COLUMN status_page_components.auto_update_from_monitoring IS 'Automatically update status based on monitoring results';
COMMENT ON COLUMN status_page_components.status_aggregation_rule IS 'How to aggregate multiple monitoring checks into component status';
COMMENT ON COLUMN status_page_components.parent_component_id IS 'Parent component for hierarchical grouping';
COMMENT ON COLUMN status_page_components.component_group IS 'Group name for organizing components';

-- =====================================================
-- ENHANCE EXISTING SUBSCRIBERS TABLE
-- =====================================================

-- Add incident management columns to existing subscribers table
ALTER TABLE subscribers 
ADD COLUMN IF NOT EXISTS subscriber_type subscriber_type DEFAULT 'email',
ADD COLUMN IF NOT EXISTS phone_number VARCHAR(20),
ADD COLUMN IF NOT EXISTS webhook_url VARCHAR(500),
ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255),
ADD COLUMN IF NOT EXISTS notification_preferences JSONB DEFAULT '{}'::jsonb,
ADD COLUMN IF NOT EXISTS subscribed_components UUID[], -- Array of component IDs to subscribe to
ADD COLUMN IF NOT EXISTS subscribed_severities incident_severity[] DEFAULT ARRAY['critical', 'high', 'medium']::incident_severity[],
ADD COLUMN IF NOT EXISTS verification_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS verified_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS unsubscribe_token VARCHAR(255),
ADD COLUMN IF NOT EXISTS unsubscribed_at TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS double_opt_in BOOLEAN DEFAULT true;

-- Add comments for new columns
COMMENT ON COLUMN subscribers.subscriber_type IS 'Type of subscription (email, sms, webhook, rss)';
COMMENT ON COLUMN subscribers.phone_number IS 'Phone number for SMS notifications';
COMMENT ON COLUMN subscribers.webhook_url IS 'Webhook URL for notifications';
COMMENT ON COLUMN subscribers.subscribed_components IS 'Array of component IDs user is subscribed to';
COMMENT ON COLUMN subscribers.subscribed_severities IS 'Incident severities user wants to be notified about';

-- =====================================================
-- STATUS PAGE INCIDENTS TABLE (public incident display)
-- =====================================================

CREATE TABLE IF NOT EXISTS status_page_incidents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    incident_id UUID NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
    
    -- Display configuration
    is_visible BOOLEAN DEFAULT true,
    display_title VARCHAR(255), -- Override incident title for public display
    display_description TEXT, -- Override incident description for public display
    
    -- Component impact
    affected_component_ids UUID[] DEFAULT '{}', -- Array of affected component IDs
    impact_override component_status, -- Override component status if needed
    
    -- Timeline display
    show_timeline BOOLEAN DEFAULT true,
    show_updates BOOLEAN DEFAULT true,
    
    -- Social media
    posted_to_twitter BOOLEAN DEFAULT false,
    twitter_post_id VARCHAR(100),
    
    -- Metadata
    auto_created BOOLEAN DEFAULT true, -- Whether this was auto-created from incident
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- COMPONENT STATUS HISTORY TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS component_status_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_component_id UUID NOT NULL REFERENCES status_page_components(id) ON DELETE CASCADE,
    
    -- Status change details
    old_status component_status,
    new_status component_status NOT NULL,
    
    -- Change metadata
    changed_by_incident_id UUID REFERENCES incidents(id),
    changed_by_monitoring_check_id UUID REFERENCES monitoring_checks(id),
    changed_by_user_id UUID REFERENCES users(id),
    
    -- Change reason
    reason VARCHAR(100), -- 'monitoring_failure', 'manual_update', 'incident_created', 'incident_resolved'
    notes TEXT,
    
    -- Duration tracking
    duration_minutes INTEGER, -- Duration in previous status
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- UPTIME CALCULATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS uptime_calculations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_component_id UUID NOT NULL REFERENCES status_page_components(id) ON DELETE CASCADE,
    
    -- Time period
    date_day DATE NOT NULL, -- Date for this calculation
    
    -- Uptime metrics
    total_minutes INTEGER DEFAULT 1440, -- Total minutes in day (1440)
    operational_minutes INTEGER DEFAULT 1440,
    degraded_minutes INTEGER DEFAULT 0,
    outage_minutes INTEGER DEFAULT 0,
    maintenance_minutes INTEGER DEFAULT 0,
    
    -- Calculated percentages
    uptime_percentage DECIMAL(5, 2) DEFAULT 100.0,
    
    -- Response time metrics (if applicable)
    avg_response_time INTEGER DEFAULT 0, -- milliseconds
    max_response_time INTEGER DEFAULT 0,
    
    -- Incident count
    incident_count INTEGER DEFAULT 0,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- SUBSCRIBER NOTIFICATIONS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS subscriber_notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    subscriber_id UUID NOT NULL REFERENCES subscribers(id) ON DELETE CASCADE,
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    incident_id UUID REFERENCES incidents(id),
    
    -- Notification details
    notification_type VARCHAR(50) NOT NULL, -- 'incident_created', 'incident_updated', 'incident_resolved', 'component_status_changed'
    subject VARCHAR(500),
    message TEXT,
    
    -- Delivery details
    sent_to VARCHAR(255) NOT NULL, -- email, phone, webhook URL
    delivery_method subscriber_type NOT NULL,
    
    -- Status tracking
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'sent', 'delivered', 'failed', 'bounced'
    sent_at TIMESTAMP WITH TIME ZONE,
    delivered_at TIMESTAMP WITH TIME ZONE,
    
    -- Error handling
    error_message TEXT,
    retry_count INTEGER DEFAULT 0,
    
    -- External tracking
    external_id VARCHAR(255), -- Provider message ID
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- STATUS PAGE ANALYTICS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS status_page_analytics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    
    -- Time period
    date_hour TIMESTAMP WITH TIME ZONE NOT NULL, -- Truncated to hour
    
    -- Visitor metrics
    unique_visitors INTEGER DEFAULT 0,
    page_views INTEGER DEFAULT 0,
    
    -- Geographic data
    country_code VARCHAR(2),
    
    -- Traffic sources
    referrer_domain VARCHAR(255),
    
    -- User agent info
    is_mobile BOOLEAN DEFAULT false,
    browser VARCHAR(100),
    
    -- Incident correlation
    incident_traffic_spike BOOLEAN DEFAULT false,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- STATUS PAGE MAINTENANCE WINDOWS TABLE
-- =====================================================

CREATE TABLE IF NOT EXISTS status_page_maintenance_windows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    
    -- Maintenance details
    title VARCHAR(255) NOT NULL,
    description TEXT,
    
    -- Timing
    scheduled_start TIMESTAMP WITH TIME ZONE NOT NULL,
    scheduled_end TIMESTAMP WITH TIME ZONE NOT NULL,
    actual_start TIMESTAMP WITH TIME ZONE,
    actual_end TIMESTAMP WITH TIME ZONE,
    
    -- Affected components
    affected_component_ids UUID[] NOT NULL,
    
    -- Status during maintenance
    maintenance_status component_status DEFAULT 'maintenance',
    
    -- Notification settings
    notify_subscribers BOOLEAN DEFAULT true,
    notification_intervals INTEGER[] DEFAULT ARRAY[72, 24, 1], -- Hours before to notify
    notifications_sent INTEGER[] DEFAULT '{}', -- Track which notifications sent
    
    -- Status
    status VARCHAR(50) DEFAULT 'scheduled', -- 'scheduled', 'in_progress', 'completed', 'cancelled'
    
    -- Created by
    created_by UUID NOT NULL REFERENCES users(id),
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- =====================================================
-- CONSTRAINTS AND INDEXES
-- =====================================================

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS idx_status_page_incidents_unique 
ON status_page_incidents(status_page_id, incident_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_uptime_calculations_unique 
ON uptime_calculations(status_page_component_id, date_day);

CREATE UNIQUE INDEX IF NOT EXISTS idx_status_page_analytics_unique 
ON status_page_analytics(status_page_id, date_hour, country_code, referrer_domain, is_mobile);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_status_page_incidents_status_page_id ON status_page_incidents(status_page_id);
CREATE INDEX IF NOT EXISTS idx_status_page_incidents_incident_id ON status_page_incidents(incident_id);
CREATE INDEX IF NOT EXISTS idx_status_page_incidents_is_visible ON status_page_incidents(is_visible);

CREATE INDEX IF NOT EXISTS idx_component_status_history_component_id ON component_status_history(status_page_component_id);
CREATE INDEX IF NOT EXISTS idx_component_status_history_created_at ON component_status_history(created_at);
CREATE INDEX IF NOT EXISTS idx_component_status_history_incident_id ON component_status_history(changed_by_incident_id);

CREATE INDEX IF NOT EXISTS idx_uptime_calculations_component_id ON uptime_calculations(status_page_component_id);
CREATE INDEX IF NOT EXISTS idx_uptime_calculations_date_day ON uptime_calculations(date_day);

CREATE INDEX IF NOT EXISTS idx_subscriber_notifications_subscriber_id ON subscriber_notifications(subscriber_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_notifications_status_page_id ON subscriber_notifications(status_page_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_notifications_incident_id ON subscriber_notifications(incident_id);
CREATE INDEX IF NOT EXISTS idx_subscriber_notifications_status ON subscriber_notifications(status);
CREATE INDEX IF NOT EXISTS idx_subscriber_notifications_created_at ON subscriber_notifications(created_at);

CREATE INDEX IF NOT EXISTS idx_status_page_analytics_status_page_id ON status_page_analytics(status_page_id);
CREATE INDEX IF NOT EXISTS idx_status_page_analytics_date_hour ON status_page_analytics(date_hour);

CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status_page_id ON status_page_maintenance_windows(status_page_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_scheduled_start ON status_page_maintenance_windows(scheduled_start);
CREATE INDEX IF NOT EXISTS idx_maintenance_windows_status ON status_page_maintenance_windows(status);

-- Add indexes for enhanced columns
CREATE INDEX IF NOT EXISTS idx_status_page_components_current_status ON status_page_components(current_status);
CREATE INDEX IF NOT EXISTS idx_status_page_components_parent_id ON status_page_components(parent_component_id);
CREATE INDEX IF NOT EXISTS idx_status_page_components_component_group ON status_page_components(component_group);
CREATE INDEX IF NOT EXISTS idx_status_page_components_display_order ON status_page_components(display_order);

CREATE INDEX IF NOT EXISTS idx_subscribers_subscriber_type ON subscribers(subscriber_type);
CREATE INDEX IF NOT EXISTS idx_subscribers_verified_at ON subscribers(verified_at);
CREATE INDEX IF NOT EXISTS idx_subscribers_unsubscribed_at ON subscribers(unsubscribed_at);

-- =====================================================
-- FOREIGN KEY CONSTRAINTS
-- =====================================================

-- Add foreign key for monitoring checks (will be added after monitoring schema is created)
-- This constraint will be added in a later migration after monitoring_checks table exists

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TABLE status_page_incidents IS 'Public incident display on status pages';
COMMENT ON TABLE component_status_history IS 'History of component status changes';
COMMENT ON TABLE uptime_calculations IS 'Daily uptime calculations for components';
COMMENT ON TABLE subscriber_notifications IS 'Notification delivery tracking for subscribers';
COMMENT ON TABLE status_page_analytics IS 'Status page visitor analytics';
COMMENT ON TABLE status_page_maintenance_windows IS 'Scheduled maintenance windows';

-- =====================================================
-- GRANT PERMISSIONS
-- =====================================================

-- Grant appropriate permissions
GRANT SELECT, INSERT, UPDATE, DELETE ON status_page_incidents TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON component_status_history TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON uptime_calculations TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriber_notifications TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON status_page_analytics TO alert24;
GRANT SELECT, INSERT, UPDATE, DELETE ON status_page_maintenance_windows TO alert24;

-- =====================================================
-- UPDATE EXISTING DATA WITH DEFAULT VALUES
-- =====================================================

-- Update existing status_pages with default values
UPDATE status_pages 
SET 
    auto_incident_updates = true,
    incident_display_hours = 72,
    maintenance_display_days = 14,
    component_grouping_enabled = true,
    uptime_display_days = 90,
    timezone = 'UTC',
    date_format = 'MMMM D, YYYY',
    time_format = 'h:mm A'
WHERE auto_incident_updates IS NULL;

-- Update existing status_page_components with default values
UPDATE status_page_components 
SET 
    current_status = 'operational',
    auto_update_from_monitoring = false,
    status_aggregation_rule = 'worst_status',
    display_order = 0,
    is_visible = true,
    show_uptime = true,
    uptime_calculation_method = 'operational_percentage'
WHERE current_status IS NULL;

-- Update existing subscribers with default values
UPDATE subscribers 
SET 
    subscriber_type = 'email',
    notification_preferences = '{"all_incidents": true, "maintenance_windows": true}'::jsonb,
    subscribed_severities = ARRAY['critical', 'high', 'medium']::incident_severity[],
    double_opt_in = true
WHERE subscriber_type IS NULL; 