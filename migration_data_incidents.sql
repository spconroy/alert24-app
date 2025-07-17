-- Migration data for incidents table
-- Generated from old database export

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Insert data into incidents table
-- NOTE: The incidents table in your current Supabase schema has different columns
-- Your current schema: (id, organization_id, service_id, title, description, status, severity, assigned_to, created_by, started_at, resolved_at, created_at, updated_at)
-- Old schema: had additional fields like affected_services, impact_description, source, source_id, escalation_level, etc.

/*
-- Original incidents data from old database - REQUIRES MANUAL ADAPTATION
-- The following fields don't exist in your current schema:
-- affected_services, impact_description, source, source_id, acknowledged_at, escalation_level, escalated_at, escalation_policy_id, tags, external_id

-- Original INSERT (commented out):
INSERT INTO incidents (id, organization_id, title, description, severity, status, affected_services, impact_description, assigned_to, created_by, source, source_id, started_at, acknowledged_at, resolved_at, escalation_level, escalated_at, escalation_policy_id, tags, external_id, created_at, updated_at) VALUES
('7328c354-ee8c-4c6a-8786-f16db71440c0', '5e4107b7-9a16-4555-9bf2-c10ce9684e98', 'Test Incident - Schema Deployment Complete', 'This is a test incident created to verify the new incident management schema is working correctly.', 'medium', 'open', null, null, null, '3b3e5e75-a6ca-4680-83b0-35455901f1d1', 'manual', null, '2025-07-06T21:11:33.117Z', null, null, 0, null, null, null, null, '2025-07-06T21:11:33.117Z', '2025-07-06T21:11:33.117Z');
*/

-- Simplified version for your current schema (you'll need to map organization_id and created_by to valid IDs):
-- INSERT INTO incidents (id, organization_id, title, description, severity, status, created_by, started_at, created_at, updated_at)
-- VALUES (
--   '7328c354-ee8c-4c6a-8786-f16db71440c0',
--   '[MAP_TO_VALID_ORG_ID]', -- Map '5e4107b7-9a16-4555-9bf2-c10ce9684e98' to an existing organization
--   'Test Incident - Schema Deployment Complete',
--   'This is a test incident created to verify the new incident management schema is working correctly.',
--   'medium',
--   'investigating', -- Use your current schema's valid status values
--   '[MAP_TO_VALID_USER_ID]', -- Map '3b3e5e75-a6ca-4680-83b0-35455901f1d1' to an existing user
--   '2025-07-06T21:11:33.117Z',
--   '2025-07-06T21:11:33.117Z',
--   '2025-07-06T21:11:33.117Z'
-- ); 