-- Run this in Supabase SQL Editor to add all new feature columns/tables

-- 1. market_positioning column
ALTER TABLE ai_insights
ADD COLUMN IF NOT EXISTS market_positioning TEXT DEFAULT 'mid-market';

-- 2. share_links table (for shareable insight links)
CREATE TABLE IF NOT EXISTS share_links (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  token UUID NOT NULL UNIQUE,
  competitor_id UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS share_links_token_idx ON share_links(token);

-- 3. reports table (for weekly intelligence reports)
CREATE TABLE IF NOT EXISTS reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  generated_at TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS reports_user_id_idx ON reports(user_id);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own reports" ON reports
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own reports" ON reports
  FOR INSERT WITH CHECK (auth.uid() = user_id);
