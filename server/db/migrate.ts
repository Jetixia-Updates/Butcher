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

    // 4. Fix Finance Tables
    console.log("💰 Migrating finance tables...");

    await sql`
          CREATE TABLE IF NOT EXISTS "finance_accounts" (
            "id" text PRIMARY KEY NOT NULL,
            "name" varchar(100) NOT NULL,
            "name_ar" varchar(100),
            "type" text NOT NULL,
            "balance" decimal(14, 2) DEFAULT '0' NOT NULL,
            "currency" text DEFAULT 'AED' NOT NULL,
            "is_active" boolean DEFAULT true NOT NULL,
            "bank_name" varchar(100),
            "account_number" varchar(50),
            "iban" varchar(50),
            "last_reconciled" timestamp,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          )
        `;

    await sql`
          CREATE TABLE IF NOT EXISTS "finance_transactions" (
            "id" text PRIMARY KEY NOT NULL,
            "type" text NOT NULL,
            "status" text DEFAULT 'pending' NOT NULL,
            "amount" decimal(12, 2) NOT NULL,
            "currency" text DEFAULT 'AED' NOT NULL,
            "description" text NOT NULL,
            "description_ar" text,
            "category" text,
            "reference" varchar(100),
            "reference_type" varchar(50),
            "reference_id" text,
            "account_id" text NOT NULL,
            "account_name" varchar(100) NOT NULL,
            "created_by" text NOT NULL,
            "notes" text,
            "attachments" jsonb,
            "metadata" jsonb,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          )
        `;

    await sql`
          CREATE TABLE IF NOT EXISTS "finance_expenses" (
            "id" text PRIMARY KEY NOT NULL,
            "expense_number" varchar(50) NOT NULL,
            "category" text NOT NULL,
            "function" varchar(50) DEFAULT 'administrative',
            "gross_amount" decimal(10, 2) NOT NULL,
            "vat_amount" decimal(10, 2) DEFAULT '0',
            "vat_rate" decimal(5, 2) DEFAULT '5',
            "is_vat_recoverable" boolean DEFAULT true,
            "withholding_tax" decimal(10, 2) DEFAULT '0',
            "amount" decimal(10, 2) NOT NULL,
            "currency" text DEFAULT 'AED' NOT NULL,
            "exchange_rate" decimal(10, 6) DEFAULT '1',
            "base_currency_amount" decimal(10, 2),
            "description" text NOT NULL,
            "description_ar" text,
            "vendor_id" text,
            "vendor" varchar(200),
            "vendor_trn" varchar(20),
            "invoice_number" varchar(100),
            "invoice_date" timestamp,
            "received_date" timestamp,
            "due_date" timestamp,
            "paid_at" timestamp,
            "payment_terms" text DEFAULT 'net_30',
            "status" text DEFAULT 'pending' NOT NULL,
            "accountId" text,
            "is_recurring" boolean DEFAULT false,
            "recurring_frequency" text,
            "recurring_end_date" timestamp,
            "cost_center_id" text,
            "department_id" text,
            "project_id" text,
            "is_reimbursement" boolean DEFAULT false,
            "employee_id" text,
            "created_by" text NOT NULL,
            "notes" text,
            "attachments" jsonb,
            "created_at" timestamp DEFAULT now() NOT NULL,
            "updated_at" timestamp DEFAULT now() NOT NULL
          )
        `;

    console.log("✅ finance tables synchronized");

    console.log("\n✨ All migrations completed successfully!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  }
}

migrate();
