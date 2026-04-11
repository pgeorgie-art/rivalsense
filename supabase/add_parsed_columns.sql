-- Add parsed_pricing and parsed_promos columns to ai_insights
-- Run this in Supabase SQL Editor

ALTER TABLE ai_insights
ADD COLUMN IF NOT EXISTS parsed_pricing JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS parsed_promos JSONB DEFAULT '[]';
