-- Create team_groups and team_memberships tables for Alert24
-- Run this in your Supabase SQL Editor

-- Create team_groups table
CREATE TABLE IF NOT EXISTS team_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  color VARCHAR(7) DEFAULT '#0066CC',
  team_lead_id UUID REFERENCES users(id),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create team_memberships table
CREATE TABLE IF NOT EXISTS team_memberships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_group_id UUID NOT NULL REFERENCES team_groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'member',
  is_active BOOLEAN DEFAULT true,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_team_groups_organization_id ON team_groups(organization_id);
CREATE INDEX IF NOT EXISTS idx_team_groups_is_active ON team_groups(is_active);
CREATE INDEX IF NOT EXISTS idx_team_memberships_team_group_id ON team_memberships(team_group_id);
CREATE INDEX IF NOT EXISTS idx_team_memberships_user_id ON team_memberships(user_id);

-- Enable Row Level Security
ALTER TABLE team_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE team_memberships ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY team_groups_organization_isolation ON team_groups
  FOR ALL TO authenticated
  USING (organization_id IN (
    SELECT organization_id FROM organization_members 
    WHERE user_id = auth.uid()
  ));

CREATE POLICY team_memberships_organization_isolation ON team_memberships
  FOR ALL TO authenticated
  USING (team_group_id IN (
    SELECT id FROM team_groups 
    WHERE organization_id IN (
      SELECT organization_id FROM organization_members 
      WHERE user_id = auth.uid()
    )
  ));

-- Allow users to see their own memberships
CREATE POLICY team_memberships_user_access ON team_memberships
  FOR ALL TO authenticated
  USING (user_id = auth.uid());

-- Insert sample team for testing (replace organization_id with real ID)
INSERT INTO team_groups (organization_id, name, description, color) 
SELECT id, 'Engineering Team', 'Core engineering team responsible for platform development', '#1976d2'
FROM organizations 
LIMIT 1
ON CONFLICT DO NOTHING;

-- Grant permissions
GRANT ALL ON team_groups TO authenticated;
GRANT ALL ON team_memberships TO authenticated;

-- Verify tables were created
SELECT 'team_groups' as table_name, COUNT(*) as record_count FROM team_groups
UNION ALL
SELECT 'team_memberships' as table_name, COUNT(*) as record_count FROM team_memberships; 