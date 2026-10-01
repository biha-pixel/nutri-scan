-- =============================================================================
-- NutriScan Initial Database Schema Migration
-- Description: Create scans and scan_items tables with RLS and indexes
-- =============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- -----------------------------------------------------------------------------
-- 1. Scans Table (Parent record representing a meal scanning event)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  image_url TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.scans IS 'Records of food scanning events initiated by authenticated users.';
COMMENT ON COLUMN public.scans.id IS 'Primary key UUID for the scan.';
COMMENT ON COLUMN public.scans.user_id IS 'Owner of the scan referencing Supabase auth.users.';
COMMENT ON COLUMN public.scans.image_url IS 'Optional URL reference to image in cloud storage (no raw binary in DB).';
COMMENT ON COLUMN public.scans.created_at IS 'UTC timestamp when the scan was created.';

-- -----------------------------------------------------------------------------
-- 2. Scan Items Table (Child records representing individual recognized foods)
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.scan_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_id UUID NOT NULL REFERENCES public.scans(id) ON DELETE CASCADE,
  food_name TEXT NOT NULL,
  confidence NUMERIC NOT NULL CHECK (confidence >= 0.0 AND confidence <= 1.0),
  nutrition_source TEXT NOT NULL DEFAULT 'usda_fdc',
  nutrition_id TEXT NULL,
  serving_basis TEXT NOT NULL DEFAULT '100g',
  nutrients JSONB NOT NULL DEFAULT '{}'::jsonb,
  highlights JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

COMMENT ON TABLE public.scan_items IS 'Individual food items identified and analyzed in a parent food scan.';
COMMENT ON COLUMN public.scan_items.scan_id IS 'Foreign key referencing parent scans.id with CASCADE deletion.';
COMMENT ON COLUMN public.scan_items.confidence IS 'AI confidence score between 0.0 and 1.0.';
COMMENT ON COLUMN public.scan_items.nutrition_source IS 'Source database (e.g. usda_fdc).';
COMMENT ON COLUMN public.scan_items.nutrition_id IS 'External identifier in the nutrition database (e.g. FDC ID).';
COMMENT ON COLUMN public.scan_items.serving_basis IS 'Portion basis for nutrition values (e.g. 100g, 1 medium).';
COMMENT ON COLUMN public.scan_items.nutrients IS 'JSONB holding calories, macronutrients (protein, carbs, fat, fiber, sugar), and micronutrients.';
COMMENT ON COLUMN public.scan_items.highlights IS 'JSONB array of deterministic rule-based nutritional highlights.';

-- -----------------------------------------------------------------------------
-- 3. Indexes for Query Performance
-- -----------------------------------------------------------------------------
-- Speeds up queries fetching a user's scan history
CREATE INDEX IF NOT EXISTS idx_scans_user_id
  ON public.scans (user_id);

-- Speeds up sorting history by date (newest first)
CREATE INDEX IF NOT EXISTS idx_scans_created_at
  ON public.scans (created_at DESC);

-- Speeds up joins from a scan to all its food items
CREATE INDEX IF NOT EXISTS idx_scan_items_scan_id
  ON public.scan_items (scan_id);

-- -----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Configuration
-- -----------------------------------------------------------------------------
ALTER TABLE public.scans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_items ENABLE ROW LEVEL SECURITY;

-- Scans Policies
DROP POLICY IF EXISTS "Users can view their own scans" ON public.scans;
CREATE POLICY "Users can view their own scans"
  ON public.scans FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own scans" ON public.scans;
CREATE POLICY "Users can insert their own scans"
  ON public.scans FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own scans" ON public.scans;
CREATE POLICY "Users can update their own scans"
  ON public.scans FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own scans" ON public.scans;
CREATE POLICY "Users can delete their own scans"
  ON public.scans FOR DELETE
  USING (auth.uid() = user_id);

-- Scan Items Policies (Enforced via parent scan ownership)
DROP POLICY IF EXISTS "Users can view items of their own scans" ON public.scan_items;
CREATE POLICY "Users can view items of their own scans"
  ON public.scan_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.scans
      WHERE public.scans.id = scan_items.scan_id
        AND public.scans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert items into their own scans" ON public.scan_items;
CREATE POLICY "Users can insert items into their own scans"
  ON public.scan_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.scans
      WHERE public.scans.id = scan_items.scan_id
        AND public.scans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update items of their own scans" ON public.scan_items;
CREATE POLICY "Users can update items of their own scans"
  ON public.scan_items FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.scans
      WHERE public.scans.id = scan_items.scan_id
        AND public.scans.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete items of their own scans" ON public.scan_items;
CREATE POLICY "Users can delete items of their own scans"
  ON public.scan_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.scans
      WHERE public.scans.id = scan_items.scan_id
        AND public.scans.user_id = auth.uid()
    )
  );
