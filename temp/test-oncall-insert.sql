-- Test insert into on_call_schedules table
-- This will help identify what's missing

-- First, let's try a minimal insert to see what fails
INSERT INTO on_call_schedules (
    organization_id,
    name,
    description,
    is_active,
    timezone,
    rotation_config,
    members
) VALUES (
    '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
    'Test Schedule',
    'Test description',
    true,
    'UTC',
    '{"type": "weekly", "duration_hours": 168}'::jsonb,
    '[{"user_id": "3b3e5e75-a6ca-4680-83b0-35455901f1d1", "order": 1}]'::jsonb
);

-- If that works, clean up
DELETE FROM on_call_schedules WHERE name = 'Test Schedule';