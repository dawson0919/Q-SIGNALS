-- Telegram Integration: Add columns to profiles table
-- Run this in Supabase SQL Editor: https://supabase.com/dashboard/project/zrhussirvsgsoffmrkxb/sql/new

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_chat_id TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_username TEXT;
ALTER TABLE profiles ADD COLUMN IF NOT EXISTS telegram_linked_at TIMESTAMPTZ;

-- Index for fast lookups by chat_id (used when sending notifications)
CREATE INDEX IF NOT EXISTS idx_profiles_telegram_chat_id 
ON profiles (telegram_chat_id) 
WHERE telegram_chat_id IS NOT NULL;
