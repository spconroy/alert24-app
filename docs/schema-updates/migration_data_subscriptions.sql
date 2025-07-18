-- Migration data for subscriptions table
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

-- Insert data into subscriptions table
INSERT INTO subscriptions (id, status_page_id, email, is_active, created_at, updated_at, deleted_at) VALUES
('286dfbf0-7170-4ab9-8597-27fd82cdf072', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'test@example.com', true, '2025-07-03T20:28:29.549Z', '2025-07-03T20:28:29.549Z', null),
('a6a335c0-7c15-4dd9-958d-01e69e412163', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'user@domain.com', true, '2025-07-03T20:28:29.549Z', '2025-07-03T20:28:29.549Z', null),
('c94b12e2-d52e-4b59-bf1f-30f56c378f5c', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', 'sean@econroy.com', true, '2025-07-03T20:28:48.419Z', '2025-07-03T20:28:48.419Z', null); 