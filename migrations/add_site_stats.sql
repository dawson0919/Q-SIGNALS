-- Site Stats table for persistent visitor counter
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS site_stats (
    key TEXT PRIMARY KEY,
    value BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- Seed with initial count
INSERT INTO site_stats (key, value) VALUES ('visitor_count', 0)
ON CONFLICT (key) DO NOTHING;

-- Allow service role full access (no RLS needed for server-only table)
ALTER TABLE site_stats ENABLE ROW LEVEL SECURITY;

-- Policy: only service role (admin) can read/write
CREATE POLICY "Service role full access" ON site_stats
    FOR ALL USING (auth.role() = 'service_role');
