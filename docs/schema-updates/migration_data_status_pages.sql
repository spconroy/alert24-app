-- Migration data for status_pages table
-- Generated from old database on 2025-07-17

-- Insert status_pages data
INSERT INTO public.status_pages (
    id,
    organization_id,
    name,
    slug,
    description,
    is_public,
    created_at,
    updated_at,
    deleted_at
) VALUES 
(
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'e4ee98dd-afc5-45a1-8afa-ff1b93b9105c',
    'Test Page 1',
    'test-page-1',
    'test page 1',
    true,
    '2025-07-03T19:50:23.440Z',
    '2025-07-03T19:50:23.440Z',
    NULL
),
(
    '26242a8f-3b68-43e1-b546-edffd3b006e7',
    '80fe7a23-0a4d-461b-bb4a-f0a5fd251781',
    'Company Services',
    'company-services',
    NULL,
    true,
    '2025-07-03T20:53:17.756Z',
    '2025-07-03T20:53:17.756Z',
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    organization_id = EXCLUDED.organization_id,
    name = EXCLUDED.name,
    slug = EXCLUDED.slug,
    description = EXCLUDED.description,
    is_public = EXCLUDED.is_public,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at; 