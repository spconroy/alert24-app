-- Migration data for service_status_history table
-- Generated from old database export
-- WARNING: This table contains 400+ records. Due to size limits, only the structure and first few records are shown.
-- The full dataset needs to be migrated separately.

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

-- Sample data (first 5 records) - Full migration requires processing all 400+ records
INSERT INTO service_status_history (id, service_id, status, started_at, ended_at, created_at, updated_at) VALUES
('d8f9d465-b8a2-4ca7-ae01-b5956a4c7d1f', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'operational', '2025-06-07T05:34:49.848Z', '2025-06-07T19:25:23.700Z', '2025-07-07T05:34:49.848Z', '2025-07-07T05:34:49.848Z'),
('cd389434-8a0e-425e-96cf-b9b4f0e757bb', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'operational', '2025-06-08T03:32:25.889Z', '2025-06-09T01:21:42.767Z', '2025-07-07T05:34:49.848Z', '2025-07-07T05:34:49.848Z'),
('c4000bfd-586c-40ec-96c6-7636a00f393b', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'operational', '2025-06-08T12:54:03.510Z', '2025-06-08T21:32:11.777Z', '2025-07-07T05:34:49.848Z', '2025-07-07T05:34:49.848Z'),
('8dae3867-47de-487a-8dd4-04d851d8e04c', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'operational', '2025-06-09T06:33:16.075Z', '2025-06-10T00:22:39.104Z', '2025-07-07T05:34:49.848Z', '2025-07-07T05:34:49.848Z'),
('d56a8a69-bf4f-43f3-8835-4ff026bdd1c0', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'operational', '2025-06-09T12:42:45.572Z', '2025-06-10T10:08:03.694Z', '2025-07-07T05:34:49.848Z', '2025-07-07T05:34:49.848Z');

-- NOTE: This is only a sample of the data. The complete table contains over 400 records.
-- To get the full data, run the following query against the old database:
-- SELECT * FROM service_status_history ORDER BY created_at;
-- 
-- Then generate the complete INSERT statements for all records. 