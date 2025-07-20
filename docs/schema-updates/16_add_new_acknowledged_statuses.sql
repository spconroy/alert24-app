-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 16: Add New and Acknowledged Statuses
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- ADD NEW AND ACKNOWLEDGED STATUSES TO INCIDENT STATUS ENUM
-- =====================================================

-- Add 'new' and 'acknowledged' statuses to the incident_status enum
ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'new';
ALTER TYPE incident_status ADD VALUE IF NOT EXISTS 'acknowledged';

-- =====================================================
-- UPDATE DEFAULT STATUS FOR NEW INCIDENTS
-- =====================================================

-- Change default status from 'open' to 'new' for new incidents
ALTER TABLE incidents ALTER COLUMN status SET DEFAULT 'new';

-- =====================================================
-- COMMENTS
-- =====================================================

COMMENT ON TYPE incident_status IS 'Incident status enum with workflow: new -> acknowledged -> investigating -> identified -> monitoring -> resolved -> postmortem';

-- =====================================================
-- NOTES
-- =====================================================

-- Status workflow:
-- 1. 'new' - Incident just created, needs acknowledgment and paging
-- 2. 'acknowledged' - Someone has acknowledged the incident, escalation stops
-- 3. 'open' - Legacy status, still supported for existing incidents
-- 4. 'investigating' - Team is actively working on the issue
-- 5. 'identified' - Root cause has been identified
-- 6. 'monitoring' - Fix has been applied, monitoring for stability
-- 7. 'resolved' - Issue is completely resolved
-- 8. 'postmortem' - Incident review and postmortem phase