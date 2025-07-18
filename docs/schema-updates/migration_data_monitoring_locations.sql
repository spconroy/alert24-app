-- Migration data for monitoring_locations table
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

-- Insert data into monitoring_locations table
-- NOTE: The monitoring_locations table does not exist in your current Supabase schema
-- Your current schema uses a simpler monitoring system without global probe locations
-- This data is preserved for reference but cannot be directly migrated

/*
-- Original monitoring_locations data from old database - TABLE DOES NOT EXIST IN CURRENT SCHEMA
-- This advanced monitoring system with global probe locations is not part of your current setup
-- If you need this functionality, you would need to run the advanced monitoring schema updates first

INSERT INTO monitoring_locations (id, name, code, description, region, country, city, latitude, longitude, is_active, is_default, avg_response_time, reliability_score, created_at, updated_at) VALUES
('02130ac9-582f-4a83-98a9-5e731450a9d3', 'US East (N. Virginia)', 'us-east-1', 'Primary US East location', 'North America', 'United States', 'Ashburn', '39.04580000', '-77.49760000', true, true, 0, '100.00', '2025-07-06T21:11:24.747Z', '2025-07-06T21:11:24.747Z'),
('1ee505f0-33cf-4fc8-8282-4fda5b665ae9', 'US West (Oregon)', 'us-west-2', 'Primary US West location', 'North America', 'United States', 'Portland', '45.51520000', '-122.67840000', true, false, 0, '100.00', '2025-07-06T21:11:24.747Z', '2025-07-06T21:11:24.747Z'),
('054ebefc-0092-4f9a-a274-4e71ac94088a', 'EU (Frankfurt)', 'eu-cent-1', 'Primary EU location', 'Europe', 'Germany', 'Frankfurt', '50.11090000', '8.68210000', true, false, 0, '100.00', '2025-07-06T21:11:24.747Z', '2025-07-06T21:11:24.747Z'),
('658b6f48-3809-40f4-864b-11010dfb7ab7', 'Asia Pacific (Singapore)', 'ap-se-1', 'Primary APAC location', 'Asia Pacific', 'Singapore', 'Singapore', '1.35210000', '103.81980000', true, false, 0, '100.00', '2025-07-06T21:11:24.747Z', '2025-07-06T21:11:24.747Z'),
('13cf4f24-07a9-4959-be5c-61db5c197295', 'Asia Pacific (Sydney)', 'ap-se-2', 'Secondary APAC location', 'Asia Pacific', 'Australia', 'Sydney', '-33.86880000', '151.20930000', true, false, 0, '100.00', '2025-07-06T21:11:24.747Z', '2025-07-06T21:11:24.747Z');
*/

-- These monitoring locations were:
-- 1. US East (N. Virginia) - us-east-1 (default location)
-- 2. US West (Oregon) - us-west-2  
-- 3. EU (Frankfurt) - eu-cent-1
-- 4. Asia Pacific (Singapore) - ap-se-1
-- 5. Asia Pacific (Sydney) - ap-se-2
--
-- If you need global monitoring locations, you would need to:
-- 1. Create the monitoring_locations table using the schema from docs/schema-updates/02_monitoring_system_schema.sql
-- 2. Then run this migration file 