-- Create subscriptions table for email notifications
CREATE TABLE IF NOT EXISTS subscriptions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    status_page_id UUID NOT NULL REFERENCES status_pages(id) ON DELETE CASCADE,
    email VARCHAR(255) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    deleted_at TIMESTAMP WITH TIME ZONE DEFAULT NULL,
    
    -- Ensure one subscription per email per status page
    UNIQUE(status_page_id, email)
);

-- Grant permissions to the alert24 user
GRANT SELECT, INSERT, UPDATE, DELETE ON subscriptions TO alert24;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_subscriptions_status_page_id ON subscriptions(status_page_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_email ON subscriptions(email);
CREATE INDEX IF NOT EXISTS idx_subscriptions_active ON subscriptions(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_subscriptions_deleted_at ON subscriptions(deleted_at) WHERE deleted_at IS NULL;

-- Insert some sample subscriptions for testing
INSERT INTO subscriptions (status_page_id, email, is_active) VALUES
(
    (SELECT id FROM status_pages LIMIT 1),
    'test@example.com',
    true
),
(
    (SELECT id FROM status_pages LIMIT 1),
    'user@domain.com',
    true
)
ON CONFLICT (status_page_id, email) DO NOTHING; 