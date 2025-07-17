-- Migration data for services table
-- Generated from old database on 2025-07-17

-- Insert services data
INSERT INTO public.services (
    id,
    status_page_id,
    name,
    description,
    status,
    sort_order,
    created_at,
    updated_at,
    deleted_at
) VALUES 
(
    '1251f44c-c6af-41da-83d7-4d18b2b0506f',
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'Service 1',
    'important service',
    'operational',
    0,
    '2025-07-03T20:07:20.231Z',
    '2025-07-03T20:07:20.231Z',
    NULL
),
(
    '1c5fd4d5-82a9-403c-9fe1-4d2dd22e3cb5',
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'Service 2',
    NULL,
    'degraded',
    0,
    '2025-07-03T20:15:44.950Z',
    '2025-07-03T20:15:44.950Z',
    NULL
),
(
    '819b5437-61b5-4011-82e2-9d7e7f85e352',
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'Service 3',
    NULL,
    'down',
    0,
    '2025-07-03T20:15:52.338Z',
    '2025-07-03T20:15:52.338Z',
    NULL
),
(
    '50ebf366-fd39-4d1c-a985-fd39af0597c5',
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'Service 5',
    NULL,
    'operational',
    0,
    '2025-07-03T20:16:29.505Z',
    '2025-07-03T20:16:29.505Z',
    NULL
),
(
    '67189cc8-0597-4113-a4cc-a98864bb6eae',
    '57aabcb6-dab2-4bb9-88b5-c266a84319fb',
    'Service 4',
    NULL,
    'operational',
    0,
    '2025-07-03T20:16:02.364Z',
    '2025-07-03T20:37:05.530Z',
    NULL
),
(
    '2d1cb536-2a7b-4916-a81a-ee6e536127c9',
    '26242a8f-3b68-43e1-b546-edffd3b006e7',
    'Audio Generation Service',
    NULL,
    'operational',
    0,
    '2025-07-03T20:53:47.781Z',
    '2025-07-03T20:53:47.781Z',
    NULL
),
(
    'e1893d70-27db-4bc6-ae32-a5d1c6c99d4a',
    '26242a8f-3b68-43e1-b546-edffd3b006e7',
    'File hosting service',
    NULL,
    'operational',
    0,
    '2025-07-03T20:53:55.205Z',
    '2025-07-03T20:53:55.205Z',
    NULL
),
(
    'b333095f-beff-4344-8e1f-5c1233301e65',
    '26242a8f-3b68-43e1-b546-edffd3b006e7',
    'Video Generation Service',
    'The service that generates videos on the website',
    'operational',
    0,
    '2025-07-03T20:53:39.577Z',
    '2025-07-07T06:40:02.635Z',
    NULL
)
ON CONFLICT (id) DO UPDATE SET
    status_page_id = EXCLUDED.status_page_id,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    status = EXCLUDED.status,
    sort_order = EXCLUDED.sort_order,
    updated_at = EXCLUDED.updated_at,
    deleted_at = EXCLUDED.deleted_at; 