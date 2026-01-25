/**
 * Comprehensive Database Migration Script
 * Aligns the database schema with the application code (schema.ts)
 * Fixes missing tables and column mismatches for Chat and Notifications
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    console.error("❌ DATABASE_URL environment variable is not set");
    process.exit(1);
}

async function migrate() {
    console.log("🚀 Starting database migration...");

    const sql = neon(databaseUrl!);

    try {
        // 1. Fix in_app_notifications
        console.log("📦 Migrating in_app_notifications...");

        // Create table if it doesn't exist
        await sql`
      CREATE TABLE IF NOT EXISTS "in_app_notifications" (
        "id" text PRIMARY KEY NOT NULL,
        "user_id" text,
        "customer_id" text,
        "type" varchar(50) NOT NULL,
        "title" varchar(200) NOT NULL,
        "title_ar" varchar(200) NOT NULL,
        "message" text NOT NULL,
        "message_ar" text NOT NULL,
        "link" text,
        "link_tab" varchar(50),
        "link_id" text,
        "unread" boolean DEFAULT true NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;

        // Ensure columns exist and have correct constraints (for existing table)
        await sql`ALTER TABLE "in_app_notifications" ADD COLUMN IF NOT EXISTS "customer_id" text`;
        await sql`ALTER TABLE "in_app_notifications" ALTER COLUMN "user_id" DROP NOT NULL`;

        console.log("✅ in_app_notifications synchronized");

        // 2. Fix chat_messages
        console.log("💬 Migrating chat_messages...");

        await sql`
      CREATE TABLE IF NOT EXISTS "chat_messages" (
        "id" text PRIMARY KEY NOT NULL,
        "customer_id" text NOT NULL,
        "customer_name" varchar(200) NOT NULL,
        "customer_email" varchar(255) NOT NULL,
        "text" text NOT NULL,
        "sender" varchar(10) NOT NULL,
        "attachments" jsonb,
        "read_by_admin" boolean DEFAULT false NOT NULL,
        "read_by_customer" boolean DEFAULT false NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;

        // If table exists from old migration (with user_id), add customer_id and other fields
        await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_id" text`;
        await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_name" varchar(200)`;
        await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_email" varchar(255)`;
        await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "read_by_admin" boolean DEFAULT false NOT NULL`;
        await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "read_by_customer" boolean DEFAULT false NOT NULL`;

        // Rename/map columns if needed (optional cleanup if user_id exists and customer_id is empty)
        // For safety, we just ensure the new columns exist.

        console.log("✅ chat_messages synchronized");

        // 3. Ensure Express Delivery columns (from previous migration script)
        console.log("🚚 Verifying delivery_zones...");
        await sql`ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_enabled" boolean NOT NULL DEFAULT false`;
        await sql`ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_fee" decimal(10, 2) NOT NULL DEFAULT '25'`;
        await sql`ALTER TABLE "delivery_zones" ADD COLUMN IF NOT EXISTS "express_hours" integer NOT NULL DEFAULT 1`;
        console.log("✅ delivery_zones synchronized");

        console.log("\n✨ All migrations completed successfully!");

    } catch (error) {
        console.error("❌ Migration failed:", error);
        process.exit(1);
    }
}

migrate();
