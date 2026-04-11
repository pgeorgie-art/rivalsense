-- ============================================================
-- Local Edge Tracker — Full Database Schema
-- Run this in Supabase SQL Editor (Dashboard > SQL Editor)
-- ============================================================

-- Enable UUID extension (already on by default in Supabase)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. BUSINESSES
-- The user's own business (benchmark anchor)
-- ============================================================
CREATE TABLE IF NOT EXISTS businesses (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  url         TEXT NOT NULL,
  category    TEXT,
  city        TEXT,
  zip         TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Each user has exactly one business profile
CREATE UNIQUE INDEX IF NOT EXISTS businesses_user_id_idx ON businesses(user_id);

-- RLS: users can only see/edit their own business
ALTER TABLE businesses ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own business" ON businesses
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 2. COMPETITORS
-- Up to 5 competitor URLs per user
-- ============================================================
CREATE TABLE IF NOT EXISTS competitors (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name        TEXT,
  url         TEXT NOT NULL,
  category    TEXT,
  slot_number INTEGER NOT NULL CHECK (slot_number BETWEEN 1 AND 5),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Enforce unique slot per user
CREATE UNIQUE INDEX IF NOT EXISTS competitors_user_slot_idx ON competitors(user_id, slot_number);

-- RLS
ALTER TABLE competitors ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own competitors" ON competitors
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 3. SCRAPE RESULTS
-- Raw + parsed scrape output for businesses and competitors
-- ============================================================
CREATE TABLE IF NOT EXISTS scrape_results (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id       UUID NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('business', 'competitor')),
  raw_content     TEXT,
  parsed_pricing  JSONB DEFAULT '[]',
  parsed_promos   JSONB DEFAULT '[]',
  scrape_status   TEXT NOT NULL DEFAULT 'pending' CHECK (scrape_status IN ('pending', 'success', 'failed')),
  error_message   TEXT,
  scraped_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scrape_results_entity_idx ON scrape_results(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS scrape_results_scraped_at_idx ON scrape_results(scraped_at DESC);

-- RLS via join — users can read scrape results for their own entities
ALTER TABLE scrape_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scrape results" ON scrape_results
  FOR SELECT USING (
    entity_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT id FROM competitors WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Service role manages scrape results" ON scrape_results
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 4. AI INSIGHTS
-- Per-competitor AI-generated summaries and SWOT
-- ============================================================
CREATE TABLE IF NOT EXISTS ai_insights (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  competitor_id       UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  summary_text        TEXT,
  swot_strengths      TEXT,
  swot_weaknesses     TEXT,
  swot_opportunities  TEXT,
  swot_threats        TEXT,
  pricing_position    TEXT CHECK (pricing_position IN ('above_market', 'at_market', 'below_market')),
  promo_patterns      JSONB DEFAULT '[]',
  generated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ai_insights_competitor_idx ON ai_insights(competitor_id);

-- RLS via join
ALTER TABLE ai_insights ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own AI insights" ON ai_insights
  FOR SELECT USING (
    competitor_id IN (
      SELECT id FROM competitors WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Service role manages AI insights" ON ai_insights
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 5. SCORES
-- Market Positioning Score (1–100) for businesses and competitors
-- ============================================================
CREATE TABLE IF NOT EXISTS scores (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entity_id       UUID NOT NULL,
  entity_type     TEXT NOT NULL CHECK (entity_type IN ('business', 'competitor')),
  score           INTEGER NOT NULL CHECK (score BETWEEN 1 AND 100),
  score_breakdown JSONB DEFAULT '{}',
  calculated_at   TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS scores_entity_idx ON scores(entity_id, entity_type);
CREATE INDEX IF NOT EXISTS scores_calculated_at_idx ON scores(calculated_at DESC);

ALTER TABLE scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users read own scores" ON scores
  FOR SELECT USING (
    entity_id IN (
      SELECT id FROM businesses WHERE user_id = auth.uid()
      UNION
      SELECT id FROM competitors WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Service role manages scores" ON scores
  FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- 6. CHAT SESSIONS
-- AI chat history per user, context-aware per screen
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_sessions (
  id                UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id           UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  messages          JSONB DEFAULT '[]',
  context_screen    TEXT,
  context_entity_id UUID,
  created_at        TIMESTAMPTZ DEFAULT NOW(),
  updated_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS chat_sessions_user_idx ON chat_sessions(user_id);

ALTER TABLE chat_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own chat sessions" ON chat_sessions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- 7. ALERTS
-- Change detection notifications per user
-- ============================================================
CREATE TABLE IF NOT EXISTS alerts (
  id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id         UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competitor_id   UUID NOT NULL REFERENCES competitors(id) ON DELETE CASCADE,
  alert_type      TEXT NOT NULL CHECK (alert_type IN ('price_change', 'new_promo', 'content_change')),
  message         TEXT NOT NULL,
  is_read         BOOLEAN DEFAULT FALSE,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_user_idx ON alerts(user_id, is_read);
CREATE INDEX IF NOT EXISTS alerts_created_at_idx ON alerts(created_at DESC);

ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own alerts" ON alerts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ============================================================
-- Helper: updated_at trigger for chat_sessions
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER chat_sessions_updated_at
  BEFORE UPDATE ON chat_sessions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
