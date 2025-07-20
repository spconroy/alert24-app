-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 14: Fix Authorized Domains Roles
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- UPDATE AUTHORIZED DOMAINS TABLE
-- =====================================================

-- Drop the existing check constraint
ALTER TABLE authorized_domains DROP CONSTRAINT IF EXISTS authorized_domains_auto_role_check;

-- Add updated check constraint with proper roles
ALTER TABLE authorized_domains 
ADD CONSTRAINT authorized_domains_auto_role_check 
CHECK (auto_role IN ('stakeholder', 'responder', 'admin', 'owner'));

-- Update the default value to stakeholder
ALTER TABLE authorized_domains 
ALTER COLUMN auto_role SET DEFAULT 'stakeholder';

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON CONSTRAINT authorized_domains_auto_role_check ON authorized_domains IS 'Ensures auto_role is one of: stakeholder, responder, admin, owner';