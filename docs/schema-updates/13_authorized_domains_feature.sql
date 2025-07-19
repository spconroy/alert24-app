-- =====================================================
-- Alert24 Incident Management Platform
-- Schema Update 13: Authorized Domains Feature
-- =====================================================

-- Set schema
SET search_path TO public;

-- =====================================================
-- AUTHORIZED DOMAINS TABLE
-- =====================================================

-- Table to store authorized email domains for organizations
CREATE TABLE IF NOT EXISTS authorized_domains (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    
    -- Domain information
    domain VARCHAR(255) NOT NULL, -- e.g., "company.com", "example.org"
    description TEXT, -- Optional description/notes
    
    -- Auto-enrollment settings
    auto_role VARCHAR(50) NOT NULL DEFAULT 'member' CHECK (auto_role IN ('admin', 'member')),
    is_active BOOLEAN DEFAULT true,
    
    -- Security settings
    require_verification BOOLEAN DEFAULT true, -- Require email verification before auto-enrollment
    max_auto_enrollments INTEGER DEFAULT NULL, -- Limit number of auto-enrollments (NULL = unlimited)
    current_enrollments INTEGER DEFAULT 0, -- Track current auto-enrollments
    
    -- Administrative tracking
    created_by UUID NOT NULL REFERENCES users(id),
    last_used_at TIMESTAMP WITH TIME ZONE,
    
    -- Audit fields
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    
    -- Ensure unique domain per organization
    UNIQUE(organization_id, domain)
);

-- =====================================================
-- DOMAIN ENROLLMENT LOG TABLE
-- =====================================================

-- Audit log for tracking all domain-based auto-enrollments
CREATE TABLE IF NOT EXISTS domain_enrollment_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    authorized_domain_id UUID NOT NULL REFERENCES authorized_domains(id) ON DELETE CASCADE,
    organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    
    -- Enrollment details
    email VARCHAR(255) NOT NULL,
    domain VARCHAR(255) NOT NULL,
    assigned_role VARCHAR(50) NOT NULL,
    
    -- Enrollment context
    enrollment_method VARCHAR(50) NOT NULL DEFAULT 'oauth_signin', -- 'oauth_signin', 'manual_verification'
    ip_address INET,
    user_agent TEXT,
    
    -- Status tracking
    status VARCHAR(50) NOT NULL DEFAULT 'enrolled' CHECK (status IN ('enrolled', 'revoked', 'suspended')),
    
    -- Audit fields
    enrolled_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMP WITH TIME ZONE,
    revoked_by UUID REFERENCES users(id),
    revoke_reason TEXT
);

-- =====================================================
-- INDEXES FOR PERFORMANCE
-- =====================================================

-- Authorized domains indexes
CREATE INDEX IF NOT EXISTS idx_authorized_domains_organization_id ON authorized_domains(organization_id);
CREATE INDEX IF NOT EXISTS idx_authorized_domains_domain ON authorized_domains(domain);
CREATE INDEX IF NOT EXISTS idx_authorized_domains_is_active ON authorized_domains(is_active);
CREATE INDEX IF NOT EXISTS idx_authorized_domains_lookup ON authorized_domains(domain, is_active) WHERE is_active = true;

-- Domain enrollment log indexes
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_authorized_domain_id ON domain_enrollment_log(authorized_domain_id);
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_organization_id ON domain_enrollment_log(organization_id);
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_user_id ON domain_enrollment_log(user_id);
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_email ON domain_enrollment_log(email);
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_domain ON domain_enrollment_log(domain);
CREATE INDEX IF NOT EXISTS idx_domain_enrollment_log_enrolled_at ON domain_enrollment_log(enrolled_at);

-- =====================================================
-- ROW LEVEL SECURITY
-- =====================================================

-- Enable RLS for authorized domains
ALTER TABLE authorized_domains ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see authorized domains for organizations they're members of
CREATE POLICY authorized_domains_organization_access ON authorized_domains
    FOR ALL TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- Enable RLS for domain enrollment log
ALTER TABLE domain_enrollment_log ENABLE ROW LEVEL SECURITY;

-- Policy: Users can only see enrollment logs for organizations they're members of
CREATE POLICY domain_enrollment_log_organization_access ON domain_enrollment_log
    FOR ALL TO authenticated
    USING (
        organization_id IN (
            SELECT organization_id FROM organization_members 
            WHERE user_id = auth.uid() AND is_active = true
        )
    );

-- =====================================================
-- FUNCTIONS FOR DOMAIN OPERATIONS
-- =====================================================

-- Function to extract domain from email address
CREATE OR REPLACE FUNCTION extract_domain_from_email(email_address TEXT)
RETURNS TEXT AS $$
BEGIN
    -- Extract domain part after @ symbol
    RETURN LOWER(TRIM(SPLIT_PART(email_address, '@', 2)));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Function to check if email domain is authorized for any organization
CREATE OR REPLACE FUNCTION check_authorized_domain(email_address TEXT)
RETURNS TABLE(
    organization_id UUID,
    organization_name VARCHAR,
    authorized_domain_id UUID,
    domain VARCHAR,
    auto_role VARCHAR,
    description TEXT
) AS $$
DECLARE
    user_domain TEXT;
BEGIN
    -- Extract domain from email
    user_domain := extract_domain_from_email(email_address);
    
    -- Find matching authorized domains
    RETURN QUERY
    SELECT 
        ad.organization_id,
        o.name as organization_name,
        ad.id as authorized_domain_id,
        ad.domain,
        ad.auto_role,
        ad.description
    FROM authorized_domains ad
    JOIN organizations o ON ad.organization_id = o.id
    WHERE ad.domain = user_domain
    AND ad.is_active = true
    AND o.deleted_at IS NULL
    AND (ad.max_auto_enrollments IS NULL OR ad.current_enrollments < ad.max_auto_enrollments);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to enroll user via authorized domain
CREATE OR REPLACE FUNCTION enroll_user_via_domain(
    p_user_id UUID,
    p_email TEXT,
    p_ip_address INET DEFAULT NULL,
    p_user_agent TEXT DEFAULT NULL
)
RETURNS TABLE(
    success BOOLEAN,
    organization_id UUID,
    role VARCHAR,
    message TEXT
) AS $$
DECLARE
    domain_record RECORD;
    enrollment_count INTEGER;
BEGIN
    -- Check for authorized domain
    SELECT * INTO domain_record
    FROM check_authorized_domain(p_email)
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN QUERY SELECT false, NULL::UUID, NULL::VARCHAR, 'No authorized domain found for email'::TEXT;
        RETURN;
    END IF;
    
    -- Check if user is already a member
    SELECT COUNT(*) INTO enrollment_count
    FROM organization_members
    WHERE user_id = p_user_id 
    AND organization_id = domain_record.organization_id;
    
    IF enrollment_count > 0 THEN
        RETURN QUERY SELECT false, domain_record.organization_id, NULL::VARCHAR, 'User already member of organization'::TEXT;
        RETURN;
    END IF;
    
    -- Add user to organization
    INSERT INTO organization_members (
        organization_id,
        user_id,
        role,
        accepted_at,
        is_active
    ) VALUES (
        domain_record.organization_id,
        p_user_id,
        domain_record.auto_role,
        NOW(),
        true
    );
    
    -- Log the enrollment
    INSERT INTO domain_enrollment_log (
        authorized_domain_id,
        organization_id,
        user_id,
        email,
        domain,
        assigned_role,
        ip_address,
        user_agent
    ) VALUES (
        domain_record.authorized_domain_id,
        domain_record.organization_id,
        p_user_id,
        p_email,
        domain_record.domain,
        domain_record.auto_role,
        p_ip_address,
        p_user_agent
    );
    
    -- Update enrollment counter
    UPDATE authorized_domains
    SET current_enrollments = current_enrollments + 1,
        last_used_at = NOW(),
        updated_at = NOW()
    WHERE id = domain_record.authorized_domain_id;
    
    RETURN QUERY SELECT true, domain_record.organization_id, domain_record.auto_role, 'Successfully enrolled via authorized domain'::TEXT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to validate domain format
CREATE OR REPLACE FUNCTION validate_domain_format(domain_name TEXT)
RETURNS BOOLEAN AS $$
BEGIN
    -- Basic domain validation (simplified)
    -- Domain must contain at least one dot and valid characters
    RETURN domain_name ~ '^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$'
    AND LENGTH(domain_name) <= 253
    AND LENGTH(domain_name) >= 3;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =====================================================
-- TRIGGERS FOR AUDIT TRAIL
-- =====================================================

-- Trigger to update updated_at timestamp for authorized_domains
CREATE OR REPLACE FUNCTION update_authorized_domains_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_authorized_domains_updated_at
    BEFORE UPDATE ON authorized_domains
    FOR EACH ROW
    EXECUTE FUNCTION update_authorized_domains_updated_at();

-- =====================================================
-- SAMPLE DATA (OPTIONAL - FOR TESTING)
-- =====================================================

-- Insert sample authorized domains for testing (uncomment if needed)
/*
-- Example: Allow all @alert24.com emails to auto-join as admins
INSERT INTO authorized_domains (organization_id, domain, description, auto_role, created_by)
SELECT 
    o.id,
    'alert24.com',
    'Alert24 company domain - auto-enroll as admin',
    'admin',
    u.id
FROM organizations o
CROSS JOIN users u
WHERE o.name = 'Alert24' AND u.email LIKE '%@alert24.com'
LIMIT 1;

-- Example: Allow @customer.com emails to auto-join as members
INSERT INTO authorized_domains (organization_id, domain, description, auto_role, created_by)
SELECT 
    o.id,
    'customer.com',
    'Customer company domain - auto-enroll as members',
    'member',
    u.id
FROM organizations o
CROSS JOIN users u
WHERE o.name = 'Customer Organization' AND u.role = 'owner'
LIMIT 1;
*/

-- =====================================================
-- COMMENTS FOR DOCUMENTATION
-- =====================================================

COMMENT ON TABLE authorized_domains IS 'Organizations can whitelist email domains for automatic user enrollment';
COMMENT ON TABLE domain_enrollment_log IS 'Audit log tracking all domain-based auto-enrollments for security and compliance';

COMMENT ON COLUMN authorized_domains.domain IS 'Email domain to whitelist (e.g., company.com)';
COMMENT ON COLUMN authorized_domains.auto_role IS 'Role automatically assigned to users from this domain';
COMMENT ON COLUMN authorized_domains.max_auto_enrollments IS 'Maximum number of auto-enrollments allowed (NULL = unlimited)';
COMMENT ON COLUMN authorized_domains.require_verification IS 'Whether email verification is required before auto-enrollment';

COMMENT ON FUNCTION check_authorized_domain(TEXT) IS 'Check if an email domain is authorized for auto-enrollment in any organization';
COMMENT ON FUNCTION enroll_user_via_domain(UUID, TEXT, INET, TEXT) IS 'Automatically enroll a user based on authorized domain during OAuth signin';
COMMENT ON FUNCTION validate_domain_format(TEXT) IS 'Validate that a domain name has proper format and length'; 