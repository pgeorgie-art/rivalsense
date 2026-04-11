-- Add sentiment column to ai_insights table
-- Run this in Supabase SQL Editor

ALTER TABLE ai_insights
ADD COLUMN IF NOT EXISTS sentiment JSONB DEFAULT '{
  "overall": "unknown",
  "rating_estimate": "unknown",
  "review_count_estimate": "unknown",
  "positives": [],
  "negatives": [],
  "summary": "No sentiment data available",
  "sources": []
}'::jsonb;
