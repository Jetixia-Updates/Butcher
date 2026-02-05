/**
 * Database Connection for Butcher Shop
 * Using Neon PostgreSQL Serverless
 */

import { neon, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema-neon";

// Configure Neon for serverless
neonConfig.fetchConnectionCache = true;

// Get database URL from environment
const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Create Neon SQL client
const sql = neon(DATABASE_URL);

// Create Drizzle instance with schema
export const db = drizzle(sql, { schema });

// Check if database is configured
export const isDatabaseConfigured = () => !!DATABASE_URL;

// Test database connection
export const testConnection = async () => {
  try {
    const result = await sql`SELECT 1 as test`;
    console.log("✅ Neon PostgreSQL connected successfully!");
    return true;
  } catch (error) {
    console.error("❌ Neon PostgreSQL connection failed:", error);
    return false;
  }
};

// Export schema for use in queries
export * from "./schema-neon";

// Type exports for use throughout the app
export type Database = typeof db;

// ID generator helper
export const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateOrderNumber = () => `ORD-${String(Date.now()).slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
export const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
