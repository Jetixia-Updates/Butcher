-- Migration: Add product_categories table for dynamic category management
CREATE TABLE IF NOT EXISTS "product_categories" (
  "id" text PRIMARY KEY NOT NULL,
  "name_en" varchar(100) NOT NULL,
  "name_ar" varchar(100) NOT NULL,
  "icon" varchar(50) NOT NULL DEFAULT '🥩',
  "color" varchar(100) NOT NULL DEFAULT 'bg-red-100 text-red-600',
  "sort_order" integer NOT NULL DEFAULT 0,
  "is_active" boolean NOT NULL DEFAULT true,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);

-- Seed default categories
INSERT INTO "product_categories" ("id", "name_en", "name_ar", "icon", "color", "sort_order", "is_active")
VALUES 
  ('Beef', 'Beef', 'لحم بقري', '🥩', 'bg-red-100 text-red-600', 1, true),
  ('Lamb', 'Lamb', 'لحم ضأن', '🍖', 'bg-orange-100 text-orange-600', 2, true),
  ('Goat', 'Goat', 'لحم ماعز', '🐐', 'bg-amber-100 text-amber-600', 3, true),
  ('Chicken', 'Chicken', 'دجاج', '🍗', 'bg-yellow-100 text-yellow-600', 4, true),
  ('Premium', 'Premium', 'فاخر', '⭐', 'bg-purple-100 text-purple-600', 5, true)
ON CONFLICT ("id") DO NOTHING;
