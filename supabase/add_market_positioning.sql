-- Add market_positioning column to ai_insights table
-- Run this in Supabase SQL Editor

ALTER TABLE ai_insights
ADD COLUMN IF NOT EXISTS market_positioning TEXT DEFAULT 'mid-market';
