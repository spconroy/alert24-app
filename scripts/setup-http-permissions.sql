-- HTTP Database Permissions Setup
-- Run this on your PostgreSQL database to ensure proper permissions for HTTP access

-- Create roles for JWT authentication
DO $$ 
BEGIN
  -- Create anonymous role if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    CREATE ROLE anon NOLOGIN;
  END IF;
  
  -- Create authenticated role if it doesn't exist  
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    CREATE ROLE authenticated NOLOGIN;
  END IF;
  
  -- Create service_role for admin operations
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
    CREATE ROLE service_role NOLOGIN BYPASSRLS;
  END IF;
END $$;

-- Grant basic permissions to authenticated role
GRANT USAGE ON SCHEMA alert24_schema TO authenticated;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table permissions for authenticated users
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA alert24_schema TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- Grant sequence permissions for auto-increment fields
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA alert24_schema TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Grant function execution permissions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA alert24_schema TO authenticated;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO authenticated;

-- Set default privileges for future objects
ALTER DEFAULT PRIVILEGES IN SCHEMA alert24_schema GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA alert24_schema GRANT USAGE, SELECT ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA alert24_schema GRANT EXECUTE ON FUNCTIONS TO authenticated;

-- Anonymous role permissions (read-only for public data)
GRANT USAGE ON SCHEMA alert24_schema TO anon;
GRANT SELECT ON alert24_schema.status_pages TO anon;
GRANT SELECT ON alert24_schema.status_updates TO anon;
GRANT SELECT ON alert24_schema.services TO anon;

-- Service role gets full access
GRANT ALL PRIVILEGES ON SCHEMA alert24_schema TO service_role;
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA alert24_schema TO service_role;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA alert24_schema TO service_role;
GRANT ALL PRIVILEGES ON ALL FUNCTIONS IN SCHEMA alert24_schema TO service_role;

-- Create or replace function to execute SQL (for HTTP API)
CREATE OR REPLACE FUNCTION alert24_schema.execute_sql(query_text TEXT, query_params JSONB DEFAULT '[]')
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  result JSONB;
  rec RECORD;
  rows_data JSONB := '[]'::JSONB;
BEGIN
  -- Security check: only allow certain operations
  IF NOT (query_text ~* '^(SELECT|INSERT|UPDATE|DELETE|WITH)') THEN
    RAISE EXCEPTION 'Only SELECT, INSERT, UPDATE, DELETE, and WITH statements are allowed';
  END IF;
  
  -- Execute the query and collect results
  FOR rec IN 
    EXECUTE query_text USING query_params
  LOOP
    rows_data := rows_data || jsonb_build_array(to_jsonb(rec));
  END LOOP;
  
  result := jsonb_build_object(
    'data', rows_data,
    'row_count', jsonb_array_length(rows_data),
    'status', 'success'
  );
  
  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN jsonb_build_object(
      'error', SQLERRM,
      'status', 'error'
    );
END;
$$;

-- Grant execution permission on the SQL execution function
GRANT EXECUTE ON FUNCTION alert24_schema.execute_sql(TEXT, JSONB) TO authenticated;
GRANT EXECUTE ON FUNCTION alert24_schema.execute_sql(TEXT, JSONB) TO service_role;

-- Create RPC endpoint for health checks
CREATE OR REPLACE FUNCTION alert24_schema.health_check()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN jsonb_build_object(
    'status', 'healthy',
    'database', current_database(),
    'user', current_user,
    'timestamp', NOW(),
    'version', version()
  );
END;
$$;

GRANT EXECUTE ON FUNCTION alert24_schema.health_check() TO anon;
GRANT EXECUTE ON FUNCTION alert24_schema.health_check() TO authenticated;

-- Set up Row Level Security policies for JWT roles
ALTER TABLE alert24_schema.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert24_schema.organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE alert24_schema.organization_members ENABLE ROW LEVEL SECURITY;

-- Policy for users to see their own data
CREATE POLICY "Users can view own data" ON alert24_schema.users
  FOR ALL USING (id = (current_setting('request.jwt.claims', true)::jsonb ->> 'user_id')::uuid);

-- Policy for organization members to see organization data
CREATE POLICY "Members can view organization data" ON alert24_schema.organizations
  FOR ALL USING (
    id IN (
      SELECT organization_id 
      FROM alert24_schema.organization_members 
      WHERE user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'user_id')::uuid
    )
  );

-- Policy for organization membership
CREATE POLICY "Users can view own memberships" ON alert24_schema.organization_members
  FOR ALL USING (user_id = (current_setting('request.jwt.claims', true)::jsonb ->> 'user_id')::uuid);

-- Public status pages don't need RLS
CREATE POLICY "Public status pages" ON alert24_schema.status_pages
  FOR SELECT USING (true);

CREATE POLICY "Public status updates" ON alert24_schema.status_updates  
  FOR SELECT USING (true);

-- Grant HTTP access to key functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA alert24_schema TO authenticated;

-- Show current permissions
\echo 'Permissions setup completed!'
\echo 'Checking role permissions...'

SELECT 
  r.rolname,
  r.rolsuper,
  r.rolinherit,
  r.rolcreaterole,
  r.rolcreatedb,
  r.rolcanlogin,
  r.rolbypassrls
FROM pg_roles r 
WHERE r.rolname IN ('anon', 'authenticated', 'service_role')
ORDER BY r.rolname; 