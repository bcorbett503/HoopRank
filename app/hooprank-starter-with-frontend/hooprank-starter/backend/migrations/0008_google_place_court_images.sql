ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_provider TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_place_id TEXT;
ALTER TABLE courts ADD COLUMN IF NOT EXISTS image_place_updated_at TIMESTAMP;

CREATE INDEX IF NOT EXISTS idx_courts_image_place_id
  ON courts (image_place_id)
  WHERE image_place_id IS NOT NULL;
