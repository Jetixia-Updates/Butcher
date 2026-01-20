-- Add express delivery columns to delivery_zones table
ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_enabled" boolean NOT NULL DEFAULT false;
ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_fee" decimal(10, 2) NOT NULL DEFAULT '25';
ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_hours" integer NOT NULL DEFAULT 1;
