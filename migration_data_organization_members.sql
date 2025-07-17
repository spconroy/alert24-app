-- Migration data for organization_members table
-- Generated from old database on 2025-07-17

-- Insert organization_members data
INSERT INTO public.organization_members (
    id,
    organization_id,
    user_id,
    role,
    invited_by,
    invited_at,
    accepted_at,
    invitation_token,
    invitation_expires_at,
    is_active,
    created_at,
    updated_at
) VALUES 
(
    '5e8d1777-c2df-4f78-8a78-06daac3bf747',
    'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c',
    '3b3e5e75-a6ca-4680-83b0-35455901f1d1',
    'owner',
    NULL,
    '2025-07-03T19:44:03.163Z',
    NULL,
    NULL,
    NULL,
    true,
    '2025-07-03T19:44:03.163Z',
    '2025-07-03T19:44:03.163Z'
),
(
    'a50c2108-4b9a-4b50-b4fc-b8cc744da84d',
    '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
    '3b3e5e75-a6ca-4680-83b0-35455901f1d1',
    'owner',
    NULL,
    '2025-07-03T20:53:00.978Z',
    NULL,
    NULL,
    NULL,
    true,
    '2025-07-03T20:53:00.978Z',
    '2025-07-03T20:53:00.978Z'
),
(
    'fd890658-d48a-4d1b-b3d9-cb45f770f749',
    '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
    'a3169d26-2691-445b-8298-a58efe976c09',
    'member',
    '3b3e5e75-a6ca-4680-83b0-35455901f1d1',
    '2025-07-07T02:13:18.541Z',
    NULL,
    '41c65a8811d5e62b2cadc0cbd4763e1f2080443786d31bc65203a1e34f1a104b',
    '2025-07-14T02:13:18.441Z',
    false,
    '2025-07-07T02:13:18.541Z',
    '2025-07-07T02:13:18.541Z'
)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    user_id = EXCLUDED.user_id,
    role = EXCLUDED.role,
    invited_by = EXCLUDED.invited_by,
    invited_at = EXCLUDED.invited_at,
    accepted_at = EXCLUDED.accepted_at,
    invitation_token = EXCLUDED.invitation_token,
    invitation_expires_at = EXCLUDED.invitation_expires_at,
    is_active = EXCLUDED.is_active,
    updated_at = EXCLUDED.updated_at; 