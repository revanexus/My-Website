-- Reva Nexus V11 database bootstrap
-- Run supabase/schema.sql first in Supabase SQL Editor.
-- This file is intentionally small for Docker/local PostgreSQL.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS public.influencers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  role text NOT NULL DEFAULT 'AI Creator',
  image_url text NOT NULL DEFAULT '',
  video_url text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  updated_at timestamptz NOT NULL DEFAULT now()
);
