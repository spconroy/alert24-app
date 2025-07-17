-- Migration data for status_updates table
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

-- Insert data into status_updates table
INSERT INTO status_updates (id, status_page_id, service_id, title, message, status, update_type, created_by, created_at, updated_at, deleted_at) VALUES
('09912f40-eba1-4a36-b215-09dc65f8224d', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'Service Restored', 'The API service has been fully restored and is now operating normally. We apologize for any inconvenience caused during the outage.', 'resolved', 'incident', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T18:22:15.687Z', '2025-07-03T20:22:15.687Z', null),
('079de9ea-a3ce-47b4-8f9a-3a99d84d2123', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', null, 'Scheduled Maintenance Window', 'We will be performing scheduled maintenance on our infrastructure this weekend from 2:00 AM to 4:00 AM UTC. Some services may experience brief interruptions during this time.', 'maintenance', 'maintenance', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-02T20:22:15.691Z', '2025-07-03T20:22:15.691Z', null),
('c2d6b87d-33d2-4a5a-9135-0c88c3badf8b', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', null, 'Performance Improvements Deployed', 'We have deployed several performance improvements to enhance the overall user experience. Page load times should be noticeably faster across all services.', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-06-30T20:22:15.692Z', '2025-07-03T20:22:15.692Z', null),
('e13596b7-a2ba-44d3-b146-536d58648cfa', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', null, 'Security Update Complete', 'We have successfully completed our planned security updates. All systems are now running the latest security patches and are fully operational.', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-06-26T20:22:15.694Z', '2025-07-03T20:22:15.694Z', null),
('ff189c64-4615-478f-be0f-4bf4b0cffd00', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'test', 'test', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T20:47:43.488Z', '2025-07-03T20:47:43.488Z', null),
('8f3aeb00-c4a2-4114-8d63-c705c18ba19f', '57aabcb6-dab2-4bb9-88b5-c266a84319fb', '1251f44c-c6af-41da-83d7-4d18b2b0506f', 'test', 'test', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T20:47:58.156Z', '2025-07-03T20:47:58.156Z', null),
('47b74848-e100-4f6f-ad66-18d244a02248', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'Video Generation Service status updated to Degraded', 'We are seeing increased errors on the video generation service', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T21:02:41.235Z', '2025-07-03T21:02:41.235Z', null),
('582b9668-4137-4a60-b202-c1f0d495cd3a', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'Video Generation Service status updated to Maintenance', 'Taking service down for maintainance', 'operational', 'maintenance', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T21:04:16.976Z', '2025-07-03T21:04:16.976Z', null),
('fcad7b46-74c8-4715-a107-121e385ccab1', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'Video Generation Service status updated to Down', 'having an outage', 'investigating', 'incident', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T21:06:11.152Z', '2025-07-03T21:06:11.152Z', null),
('e646701f-1972-4f49-b2c2-9413b5e4cce0', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'test', 'test', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-03T21:06:54.702Z', '2025-07-03T21:06:54.702Z', null),
('08ac78a9-95cc-493b-a5df-386a2c4f4b8a', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'test', 'test', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-04T00:11:21.792Z', '2025-07-04T00:11:21.792Z', null),
('94261345-0a12-427c-bc05-c6412c1ab1b0', '26242a8f-3b68-43e1-b546-edffd3b006e7', null, 'Video Generation Service - Service Down', 'We are experiencing a problem with our thingamagig.  We are investigating and will post an update shortly.', 'down', 'incident', null, '2025-07-07T05:26:47.398Z', '2025-07-07T05:26:47.398Z', null),
('2ffeef23-6af0-43ca-a0f2-27f46045af06', '26242a8f-3b68-43e1-b546-edffd3b006e7', 'b333095f-beff-4344-8e1f-5c1233301e65', 'Video Generation Service status updated to Operational', 'We will be performing maintainance on this service starting tomorrow at 9 PM PST', 'operational', 'general', '3b3e5e75-a6ca-4680-83b0-35455901f1d1', '2025-07-07T06:40:03.133Z', '2025-07-07T06:40:03.133Z', null); 