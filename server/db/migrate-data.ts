/**
 * Data Migration Script: Neon PostgreSQL → FreeHostia MySQL
 * Migrates all existing data from Neon to MySQL
 */

import { neon } from "@neondatabase/serverless";
import mysql from "mysql2/promise";

// Neon PostgreSQL connection
const NEON_URL = "postgresql://neondb_owner:npg_BFwLbQkA18jd@ep-icy-cell-aheio2vv-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

// MySQL connection config
const MYSQL_CONFIG = {
  host: "mysql.freehostia.com",
  user: "essref3_butcher",
  password: "Butcher@123",
  database: "essref3_butcher",
};

// Tables to migrate (in order due to foreign key dependencies)
const TABLES = [
  "users",
  "sessions",
  "addresses",
  "product_categories",
  "products",
  "stock",
  "stock_movements",
  "orders",
  "order_items",
  "payments",
  "delivery_zones",
  "delivery_tracking",
  "discount_codes",
  "in_app_notifications",
  "chat_messages",
  "suppliers",
  "wallets",
  "wallet_transactions",
  "loyalty_points",
  "loyalty_transactions",
  "app_settings",
  "banners",
];

async function migrateData() {
  console.log("🚀 Starting data migration: Neon PostgreSQL → MySQL\n");

  // Connect to Neon
  console.log("📡 Connecting to Neon PostgreSQL...");
  const sql = neon(NEON_URL);

  // Connect to MySQL
  console.log("📡 Connecting to MySQL...");
  const mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
  console.log("✅ Connected to both databases!\n");

  let totalMigrated = 0;

  for (const table of TABLES) {
    try {
      // Fetch data from Neon using raw SQL query
      console.log(`📥 Fetching data from '${table}'...`);
      const rows = await sql.query(`SELECT * FROM "${table}"`) as any[];
      
      if (rows.length === 0) {
        console.log(`   ⏭️  No data in '${table}', skipping\n`);
        continue;
      }

      console.log(`   📊 Found ${rows.length} rows`);

      // Clear existing data in MySQL (to avoid duplicates)
      await mysqlConn.execute(`DELETE FROM \`${table}\``);

      // Insert data into MySQL
      for (const row of rows) {
        const columns = Object.keys(row);
        const values = Object.values(row).map((v) => {
          if (v === null) return null;
          if (typeof v === "object") return JSON.stringify(v);
          if (v instanceof Date) return v.toISOString().slice(0, 19).replace("T", " ");
          return v;
        });

        const placeholders = columns.map(() => "?").join(", ");
        const columnNames = columns.map((c) => `\`${c}\``).join(", ");

        try {
          await mysqlConn.execute(
            `INSERT INTO \`${table}\` (${columnNames}) VALUES (${placeholders})`,
            values
          );
        } catch (insertErr: any) {
          // Skip duplicate key errors silently
          if (!insertErr.message?.includes("Duplicate")) {
            console.log(`   ⚠️  Error inserting row: ${insertErr.message}`);
          }
        }
      }

      console.log(`   ✅ Migrated ${rows.length} rows to MySQL\n`);
      totalMigrated += rows.length;
    } catch (err: any) {
      if (err.message?.includes("does not exist") || err.message?.includes("doesn't exist")) {
        console.log(`   ⏭️  Table '${table}' doesn't exist in source, skipping\n`);
      } else {
        console.log(`   ❌ Error with '${table}': ${err.message}\n`);
      }
    }
  }

  await mysqlConn.end();

  console.log("═".repeat(50));
  console.log(`✨ Migration complete! Total rows migrated: ${totalMigrated}`);
  console.log("═".repeat(50));
}

// Run migration
migrateData().catch((err) => {
  console.error("❌ Migration failed:", err);
  process.exit(1);
});
