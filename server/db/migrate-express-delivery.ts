/**
 * Standalone migration script to add express delivery columns
 * Run this with: npx tsx server/db/migrate-express-delivery.ts
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("❌ DATABASE_URL environment variable is not set");
  process.exit(1);
}

async function migrate() {
  console.log("🚀 Starting express delivery migration...");
  
  const sql = neon(databaseUrl);
  
  try {
    // Add express delivery columns to delivery_zones table
    await sql`
      ALTER TABLE "delivery_zones" 
      ADD COLUMN IF NOT EXISTS "express_enabled" boolean NOT NULL DEFAULT false
    `;
    console.log("✅ Added express_enabled column");
    
    await sql`
      ALTER TABLE "delivery_zones" 
      ADD COLUMN IF NOT EXISTS "express_fee" decimal(10, 2) NOT NULL DEFAULT '25'
    `;
    console.log("✅ Added express_fee column");
    
    await sql`
      ALTER TABLE "delivery_zones" 
      ADD COLUMN IF NOT EXISTS "express_hours" integer NOT NULL DEFAULT 1
    `;
    console.log("✅ Added express_hours column");
    
    console.log("\n✨ Migration completed successfully!");
    
    // Verify the columns exist
    const zones = await sql`SELECT * FROM delivery_zones LIMIT 1`;
    if (zones.length > 0) {
      const firstZone = zones[0];
      console.log("\n📋 Sample zone with new columns:");
      console.log({
        id: firstZone.id,
        name: firstZone.name,
        expressEnabled: firstZone.express_enabled,
        expressFee: firstZone.express_fee,
        expressHours: firstZone.express_hours,
      });
    }
    
  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
