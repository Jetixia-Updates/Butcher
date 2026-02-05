/**
 * Fix in_app_notifications and chat_messages migration
 * Maps customer_id to user_id
 */

import { neon } from "@neondatabase/serverless";
import mysql from "mysql2/promise";

const NEON_URL = "postgresql://neondb_owner:npg_BFwLbQkA18jd@ep-icy-cell-aheio2vv-pooler.c-3.us-east-1.aws.neon.tech/neondb?sslmode=require";

async function fixMigration() {
  const sql = neon(NEON_URL);

  const mysqlConn = await mysql.createConnection({
    host: "mysql.freehostia.com",
    user: "essref3_butcher",
    password: "Butcher@123",
    database: "essref3_butcher",
  });

  console.log("🔄 Migrating in_app_notifications (mapping customer_id → user_id)...");

  // Clear existing data
  await mysqlConn.execute("DELETE FROM in_app_notifications");

  // Fetch from Neon
  const notifications = await sql.query('SELECT * FROM "in_app_notifications"') as any[];
  console.log(`Found ${notifications.length} notifications`);

  let migrated = 0;
  for (const row of notifications) {
    // Map customer_id to user_id
    const userId = row.customer_id || row.user_id;
    
    try {
      await mysqlConn.execute(
        `INSERT INTO in_app_notifications (id, user_id, type, title, title_ar, message, message_ar, link, link_tab, link_id, unread, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          userId,
          row.type,
          row.title,
          row.title_ar,
          row.message,
          row.message_ar,
          row.link,
          row.link_tab,
          row.link_id,
          row.unread,
          row.created_at
        ]
      );
      migrated++;
    } catch (err: any) {
      if (!err.message?.includes("Duplicate")) {
        console.log(`Error: ${err.message}`);
      }
    }
  }
  console.log(`✅ Migrated ${migrated} notifications\n`);

  console.log("🔄 Migrating chat_messages (mapping customer_id → user_id)...");

  // Clear existing data
  await mysqlConn.execute("DELETE FROM chat_messages");

  // Fetch from Neon
  const messages = await sql.query('SELECT * FROM "chat_messages"') as any[];
  console.log(`Found ${messages.length} messages`);

  migrated = 0;
  for (const row of messages) {
    // Map customer_id to user_id
    const userId = row.customer_id || row.user_id;
    
    try {
      await mysqlConn.execute(
        `INSERT INTO chat_messages (id, user_id, user_name, user_email, text, sender, attachments, read_by_admin, read_by_user, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          row.id,
          userId,
          row.user_name || row.customer_name || 'Unknown',
          row.user_email || row.customer_email || '',
          row.text,
          row.sender,
          row.attachments ? JSON.stringify(row.attachments) : null,
          row.read_by_admin || false,
          row.read_by_user || false,
          row.created_at
        ]
      );
      migrated++;
    } catch (err: any) {
      if (!err.message?.includes("Duplicate")) {
        console.log(`Error: ${err.message}`);
      }
    }
  }
  console.log(`✅ Migrated ${migrated} chat messages`);

  await mysqlConn.end();
  console.log("\n✨ Done!");
}

fixMigration().catch(console.error);
