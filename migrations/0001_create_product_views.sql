-- Cloudflare D1 schema for the storefront product-view counter.
-- Apply with: wrangler d1 migrations apply <DATABASE_NAME>
CREATE TABLE IF NOT EXISTS product_views (
  visitor_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  view_day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (visitor_id, product_id, view_day)
);

CREATE INDEX IF NOT EXISTS idx_product_views_product_id
  ON product_views (product_id);

CREATE INDEX IF NOT EXISTS idx_product_views_day
  ON product_views (view_day);

CREATE INDEX IF NOT EXISTS idx_product_views_product_day
  ON product_views (product_id, view_day);
