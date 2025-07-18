-- Migration data for on_call_schedules table
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

-- Insert data into on_call_schedules table
-- NOTE: The on_call_schedules table may not exist in your current Supabase schema OR has different columns
-- Your current schema may have simpler fields like: (id, organization_id, name, description, timezone, schedule_rules, created_at, updated_at)
-- Old schema: had complex fields like is_active, schedule_type, rotation_config, members, overrides

/*
-- Original on_call_schedules data from old database - REQUIRES MANUAL ADAPTATION
-- The following fields may not exist in your current schema:
-- is_active, schedule_type, rotation_config, members, overrides

-- Original INSERT (commented out):
INSERT INTO on_call_schedules (id, organization_id, name, description, is_active, timezone, schedule_type, rotation_config, members, overrides, created_at, updated_at) VALUES
('938a5e41-b43e-4346-a7e0-4363a4a49c9b', '80fe7a23-0a4d-461b-bb4a-f0a5fd251781', 'Test Schedule 1', 'test', true, 'America/Los_Angeles', 'weekly', '{"end_date": null, "timezone": "America/Los_Angeles", "start_date": "2025-07-07T04:34:10.181Z", "rotation_day": 1, "rotation_type": "weekly", "rotation_interval_hours": 168}', '[{"id": "3b3e5e75-a6ca-4680-83b0-35455901f1d1", "name": "Sean Conroy", "email": "sean@inventivehq.com", "order": 1}]', '[]', '2025-07-07T03:34:29.117Z', '2025-07-07T04:45:12.062Z');
*/

-- If your database has an on_call_schedules table, simplified version might look like:
-- INSERT INTO on_call_schedules (id, organization_id, name, description, timezone, schedule_rules, created_at, updated_at)
-- VALUES (
--   '938a5e41-b43e-4346-a7e0-4363a4a49c9b',
--   '[MAP_TO_VALID_ORG_ID]', -- Map '80fe7a23-0a4d-461b-bb4a-f0a5fd251781' to an existing organization
--   'Test Schedule 1',
--   'test',
--   'America/Los_Angeles',
--   '[{"id": "3b3e5e75-a6ca-4680-83b0-35455901f1d1", "name": "Sean Conroy", "email": "sean@inventivehq.com", "order": 1}]'::jsonb,
--   '2025-07-07T03:34:29.117Z',
--   '2025-07-07T04:45:12.062Z'
-- );
--
-- Note: The on_call_schedules table may not exist at all in your current schema. 