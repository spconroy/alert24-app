-- Create status_updates table for tracking status changes and incidents
CREATE TABLE IF NOT EXISTS public.status_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  status_page_id UUID NOT NULL REFERENCES public.status_pages(id) ON DELETE CASCADE,
  service_id UUID REFERENCES public.services(id) ON DELETE CASCADE, -- NULL for general updates
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  status VARCHAR(50) NOT NULL CHECK (status IN ('investigating', 'identified', 'monitoring', 'resolved', 'operational', 'degraded', 'down', 'maintenance')),
  update_type VARCHAR(50) NOT NULL DEFAULT 'incident' CHECK (update_type IN ('incident', 'maintenance', 'general')),
  created_by UUID REFERENCES public.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMP WITH TIME ZONE
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_status_updates_status_page_id ON public.status_updates(status_page_id);
CREATE INDEX IF NOT EXISTS idx_status_updates_created_at ON public.status_updates(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_status_updates_service_id ON public.status_updates(service_id);

-- Insert sample status updates for testing
INSERT INTO public.status_updates (status_page_id, service_id, title, message, status, update_type, created_by, created_at)
SELECT 
  sp.id as status_page_id,
  s.id as service_id,
  'Service Restored' as title,
  'The API service has been fully restored and is now operating normally. We apologize for any inconvenience caused during the outage.' as message,
  'resolved' as status,
  'incident' as update_type,
  u.id as created_by,
  NOW() - INTERVAL '2 hours' as created_at
FROM public.status_pages sp
JOIN public.services s ON s.status_page_id = sp.id
JOIN public.users u ON u.email = 'sean@inventivehq.com'
WHERE sp.slug = 'test-page-1'
LIMIT 1;

INSERT INTO public.status_updates (status_page_id, service_id, title, message, status, update_type, created_by, created_at)
SELECT 
  sp.id as status_page_id,
  s.id as service_id,
  'Investigating API Issues' as title,
  'We are currently investigating reports of slow response times on our API service. Our team is working to identify the root cause.' as message,
  'investigating' as status,
  'incident' as update_type,
  u.id as created_by,
  NOW() - INTERVAL '4 hours' as created_at
FROM public.status_pages sp
JOIN public.services s ON s.status_page_id = sp.id AND s.name LIKE '%API%'
JOIN public.users u ON u.email = 'sean@inventivehq.com'
WHERE sp.slug = 'test-page-1'
LIMIT 1;

INSERT INTO public.status_updates (status_page_id, title, message, status, update_type, created_by, created_at)
SELECT 
  sp.id as status_page_id,
  'Scheduled Maintenance Window' as title,
  'We will be performing scheduled maintenance on our infrastructure this weekend from 2:00 AM to 4:00 AM UTC. Some services may experience brief interruptions during this time.' as message,
  'maintenance' as status,
  'maintenance' as update_type,
  u.id as created_by,
  NOW() - INTERVAL '1 day' as created_at
FROM public.status_pages sp
JOIN public.users u ON u.email = 'sean@inventivehq.com'
WHERE sp.slug = 'test-page-1';

INSERT INTO public.status_updates (status_page_id, title, message, status, update_type, created_by, created_at)
SELECT 
  sp.id as status_page_id,
  'Performance Improvements Deployed' as title,
  'We have deployed several performance improvements to enhance the overall user experience. Page load times should be noticeably faster across all services.' as message,
  'operational' as status,
  'general' as update_type,
  u.id as created_by,
  NOW() - INTERVAL '3 days' as created_at
FROM public.status_pages sp
JOIN public.users u ON u.email = 'sean@inventivehq.com'
WHERE sp.slug = 'test-page-1';

INSERT INTO public.status_updates (status_page_id, title, message, status, update_type, created_by, created_at)
SELECT 
  sp.id as status_page_id,
  'Security Update Complete' as title,
  'We have successfully completed our planned security updates. All systems are now running the latest security patches and are fully operational.' as message,
  'operational' as status,
  'general' as update_type,
  u.id as created_by,
  NOW() - INTERVAL '1 week' as created_at
FROM public.status_pages sp
JOIN public.users u ON u.email = 'sean@inventivehq.com'
WHERE sp.slug = 'test-page-1'; 