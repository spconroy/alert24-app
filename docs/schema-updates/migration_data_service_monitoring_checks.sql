-- Migration data for service_monitoring_checks table
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

-- Insert data into service_monitoring_checks table
-- NOTE: This table may not exist in your current Supabase schema
-- Your current schema likely uses 'service_monitoring' table instead
-- This data needs to be manually reviewed and adapted

/*
-- Original data from old database - REQUIRES MANUAL ADAPTATION
-- Old schema: service_monitoring_checks (id, service_id, monitoring_check_id, failure_threshold_minutes, failure_message, created_at, updated_at)
-- Your current schema: service_monitoring (id, service_id, check_interval, timeout_seconds, expected_status_code, etc.)

-- The following data cannot be directly migrated due to schema differences:
INSERT INTO service_monitoring_checks (id, service_id, monitoring_check_id, failure_threshold_minutes, failure_message, created_at, updated_at) VALUES
('4f5f14f9-f761-4ccc-8b2d-97438fccf60d', 'b333095f-beff-4344-8e1f-5c1233301e65', '301fa220-aced-409c-810c-50e18395cec5', 1, 'Oh no, the website is down!', '2025-07-07T06:26:32.398Z', '2025-07-07T06:26:32.398Z'),
('c37df952-9fb5-412d-aeea-cc16d8b498fc', '2d1cb536-2a7b-4916-a81a-ee6e536127c9', '301fa220-aced-409c-810c-50e18395cec5', 5, '', '2025-07-07T06:55:08.518Z', '2025-07-07T06:55:08.518Z');
*/

-- To migrate this data, you would need to:
-- 1. Identify which services in your current database correspond to the service_ids in this data
-- 2. Create appropriate service_monitoring configurations for those services
-- 3. Set up monitoring parameters like check_interval, timeout_seconds, expected_status_code, etc.
-- 
-- Example transformation (after mapping service IDs):
-- INSERT INTO service_monitoring (service_id, check_interval, timeout_seconds, expected_status_code, alert_threshold)
-- VALUES ('[MAPPED_SERVICE_ID]', 300, 30, 200, 1); 