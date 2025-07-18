-- Migration data for check_results table
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

-- Insert data into check_results table
-- Note: Mapping old monitoring schema to current simplified schema
-- monitoring_check_id -> service_id (will need manual mapping)
-- Note: This data needs to be manually reviewed and mapped to existing services
-- The following INSERT statements are commented out and need service_id mapping:

/*
-- Original data structure from old database - REQUIRES MANUAL MAPPING
-- Old schema: (id, monitoring_check_id, monitoring_location_id, is_successful, response_time, status_code, response_body, response_headers, error_message, ssl_certificate_info, dns_results, keyword_results, incident_id, triggered_incident, created_at)
-- New schema: (id, service_id, checked_at, status, response_time, status_code, error_message, created_at)

INSERT INTO check_results (id, service_id, checked_at, status, response_time, status_code, error_message, created_at) VALUES
('83113a11-263f-4e0b-874d-3c5a58a006c4', '301fa220-aced-409c-810c-50e18395cec5', '02130ac9-582f-4a83-98a9-5e731450a9d3', true, 209, 200, null, '{"nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}", "date": "Mon, 07 Jul 2025 03:53:41 GMT", "link": "<https://inventivehq.com/wp-json/>; rel=\"https://api.w.org/\", <https://inventivehq.com/wp-json/wp/v2/pages/4913>; rel=\"alternate\"; title=\"JSON\"; type=\"application/json\", <https://inventivehq.com/>; rel=shortlink", "vary": "Accept-Encoding", "cf-ray": "95b46573d8adf7a3-LAX", "server": "cloudflare", "alt-svc": "h3=\":443\"; ma=86400", "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=SBgd2xruKEkrRXbqfdXS2Q3z8JBevFsuCoI8bPUlUTvTJ%2FHes9AJIKDcJL6B%2FHh4TflvbP4FKFj7igvppDYs0lYXFrUm36fVZJu6wJHaLswNtnULqI%2FsjaXeOkR%2Bv8yBNA%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}", "cf-apo-via": "tcache", "connection": "keep-alive", "content-type": "text/html; charset=UTF-8", "cache-control": "max-age=14400", "cf-edge-cache": "cache,platform=wordpress", "last-modified": "Mon, 07 Jul 2025 03:27:41 GMT", "server-timing": "cfL4;desc=\"?proto=TCP&rtt=15734&min_rtt=14418&rtt_var=3936&sent=6&recv=9&lost=0&retrans=0&sent_bytes=3011&recv_bytes=1918&delivery_rate=175217&cwnd=252&unsent_bytes=0&cid=493fdd8e92608afa&ts=128&x=0\"", "cf-cache-status": "HIT", "content-encoding": "br", "speculation-rules": "\"/cdn-cgi/speculation\"", "transfer-encoding": "chunked"}', null, null, null, null, null, false, '2025-07-07T03:53:41.902Z'),
('47bec3c4-c1ad-4277-a430-d2b2f9498dbf', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 70, null, null, null, 'fetch failed', null, null, null, null, false, '2025-07-07T04:11:39.876Z'),
('05c5cbae-9869-40aa-8d17-8b9d82ba45da', '301fa220-aced-409c-810c-50e18395cec5', '02130ac9-582f-4a83-98a9-5e731450a9d3', true, 154, 200, null, '{"age": "1079", "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}", "date": "Mon, 07 Jul 2025 04:11:40 GMT", "link": "<https://inventivehq.com/wp-json/>; rel=\"https://api.w.org/\", <https://inventivehq.com/wp-json/wp/v2/pages/4913>; rel=\"alternate\"; title=\"JSON\"; type=\"application/json\", <https://inventivehq.com/>; rel=shortlink", "vary": "Accept-Encoding", "cf-ray": "95b47fc75969f7a9-LAX", "server": "cloudflare", "alt-svc": "h3=\":443\"; ma=86400", "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=0g%2BnRZJ8cQh2L4B8yLYdKxzqpLv0xMjTZgOS2IJHTkLSDQDMkRwcsRdcI9VOjUzL6riBICYp%2Bgtnl5spuvvKxefcYSgUKGA1traRQuK6cwD8Xb%2BejG7WjJqZqsEygtzoCg%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}", "cf-apo-via": "tcache", "connection": "keep-alive", "content-type": "text/html; charset=UTF-8", "cache-control": "max-age=14400", "cf-edge-cache": "cache,platform=wordpress", "last-modified": "Mon, 07 Jul 2025 03:27:41 GMT", "server-timing": "cfL4;desc=\"?proto=TCP&rtt=15139&min_rtt=14116&rtt_var=5862&sent=6&recv=8&lost=0&retrans=0&sent_bytes=3011&recv_bytes=1918&delivery_rate=174615&cwnd=252&unsent_bytes=0&cid=7a310581efe6d625&ts=85&x=0\"", "cf-cache-status": "HIT", "content-encoding": "br", "speculation-rules": "\"/cdn-cgi/speculation\"", "transfer-encoding": "chunked"}', null, null, null, null, null, false, '2025-07-07T04:11:40.163Z'),
('4bfe28b1-12c6-4ea8-883f-453ae7df29b9', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 3, null, null, null, 'fetch failed', null, null, null, null, false, '2025-07-07T04:12:16.293Z'),
('baae44ed-fc9c-4940-a662-4bbf6a01b8a9', '301fa220-aced-409c-810c-50e18395cec5', '02130ac9-582f-4a83-98a9-5e731450a9d3', true, 159, 200, null, '{"age": "1115", "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}", "date": "Mon, 07 Jul 2025 04:12:16 GMT", "link": "<https://inventivehq.com/wp-json/>; rel=\"https://api.w.org/\", <https://inventivehq.com/wp-json/wp/v2/pages/4913>; rel=\"alternate\"; title=\"JSON\"; type=\"application/json\", <https://inventivehq.com/>; rel=shortlink", "vary": "Accept-Encoding", "cf-ray": "95b480aadb8adbdd-LAX", "server": "cloudflare", "alt-svc": "h3=\":443\"; ma=86400", "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=dMeuaHxzWJ8bdH4EFTCDOzg%2FJmLiICGJmwU%2B66WIwrfdY3V1L8lOKXq63MvK09e76Uo6ZHIIkP3DcJgKvFWT0a%2FbW56OMh6MSJXdbtwBs3m6SG%2BbXcdSo%2BeRsC3AhLJb0Q%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}", "cf-apo-via": "tcache", "connection": "keep-alive", "content-type": "text/html; charset=UTF-8", "cache-control": "max-age=14400", "cf-edge-cache": "cache,platform=wordpress", "last-modified": "Mon, 07 Jul 2025 03:27:41 GMT", "server-timing": "cfL4;desc=\"?proto=TCP&rtt=17165&min_rtt=16866&rtt_var=5095&sent=7&recv=8&lost=0&retrans=0&sent_bytes=3010&recv_bytes=1918&delivery_rate=159243&cwnd=252&unsent_bytes=0&cid=6f89f5e3358b6ebe&ts=118&x=0\"", "cf-cache-status": "HIT", "content-encoding": "br", "speculation-rules": "\"/cdn-cgi/speculation\"", "transfer-encoding": "chunked"}', null, null, null, null, null, false, '2025-07-07T04:12:16.586Z'),
('f76cbc2d-70f1-4956-9ea5-f80956a11291', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 3, null, null, null, 'fetch failed', null, null, null, null, false, '2025-07-07T04:21:09.399Z'),
('ea1cf82e-2ad9-4fee-ab69-bc11485f9bec', '301fa220-aced-409c-810c-50e18395cec5', '02130ac9-582f-4a83-98a9-5e731450a9d3', true, 164, 200, null, '{"age": "1648", "nel": "{\"success_fraction\":0,\"report_to\":\"cf-nel\",\"max_age\":604800}", "date": "Mon, 07 Jul 2025 04:21:09 GMT", "link": "<https://inventivehq.com/wp-json/>; rel=\"https://api.w.org/\", <https://inventivehq.com/wp-json/wp/v2/pages/4913>; rel=\"alternate\"; title=\"JSON\"; type=\"application/json\", <https://inventivehq.com/>; rel=shortlink", "vary": "Accept-Encoding", "cf-ray": "95b48daedfa87d3b-LAX", "server": "cloudflare", "alt-svc": "h3=\":443\"; ma=86400", "report-to": "{\"endpoints\":[{\"url\":\"https:\\/\\/a.nel.cloudflare.com\\/report\\/v4?s=cM3zgy8vJw36BYMPO3V%2BvN8aLBZM%2BWxR4lVjcrAGhHc93jkBbJp3nk4u1wXAMyovQFLPMJHWA1kbJuTtG%2B23K8IoQpqhIw1i7ny0YeH6vrvP8EBXmpVPKu1cY6HV3DlguQ%3D%3D\"}],\"group\":\"cf-nel\",\"max_age\":604800}", "cf-apo-via": "tcache", "connection": "keep-alive", "content-type": "text/html; charset=UTF-8", "cache-control": "max-age=14400", "cf-edge-cache": "cache,platform=wordpress", "last-modified": "Mon, 07 Jul 2025 03:27:41 GMT", "server-timing": "cfL4;desc=\"?proto=TCP&rtt=16522&min_rtt=13870&rtt_var=6601&sent=7&recv=8&lost=0&retrans=0&sent_bytes=3010&recv_bytes=1918&delivery_rate=208795&cwnd=251&unsent_bytes=0&cid=c285fbdfca2c6857&ts=95&x=0\"", "cf-cache-status": "HIT", "content-encoding": "br", "speculation-rules": "\"/cdn-cgi/speculation\"", "transfer-encoding": "chunked"}', null, null, null, null, null, false, '2025-07-07T04:21:09.711Z'),
('62f92e00-1ea1-4f97-bb8d-e9c3c72ebe96', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 5000, null, null, null, 'Test trigger', null, null, null, null, false, '2025-07-07T05:24:13.903Z'),
('4d3531b0-8e73-4d57-91a2-e9b39c777785', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 5000, null, null, null, 'Test trigger after fix', null, null, null, null, false, '2025-07-07T05:25:33.199Z'),
('e080f23a-9864-4f45-bf1d-96922fd43d13', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 5000, null, null, null, 'Test transition trigger', null, null, null, null, false, '2025-07-07T05:26:01.233Z'),
('388d7409-076c-4932-b899-837e9600f197', '92eaa216-cbd8-4c2c-889b-91928b29163c', '02130ac9-582f-4a83-98a9-5e731450a9d3', false, 5000, null, null, null, 'Test simplified trigger', null, null, null, null, false, '2025-07-07T05:26:47.398Z');
*/

-- To migrate this data to your current schema, you need to:
-- 1. Map monitoring_check_id values to existing service_id values in your services table
-- 2. Convert is_successful (boolean) to status ('up'/'down')
-- 3. Map created_at to checked_at
-- 4. Extract error_message from the original error_message field
-- 
-- Example transformation for one record:
-- INSERT INTO check_results (id, service_id, checked_at, status, response_time, status_code, error_message, created_at)
-- VALUES (
--   '83113a11-263f-4e0b-874d-3c5a58a006c4',
--   '[MAPPED_SERVICE_ID]', -- Map from monitoring_check_id to your service
--   '2025-07-07T03:53:41.902Z',
--   'up', -- Convert from is_successful=true
--   209,
--   200,
--   null,
--   '2025-07-07T03:53:41.902Z'
-- ); 