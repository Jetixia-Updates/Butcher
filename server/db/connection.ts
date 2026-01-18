/**
 * Database Connection for Butcher Shop
 * Using Drizzle ORM with Neon PostgreSQL
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

// Get database URL from environment
const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  console.error("DATABASE_URL environment variable is not set. Database operations will fail.");
}

// Create Neon serverless connection (use empty string if no URL to prevent crash during import)
const sql = neon(databaseUrl || "postgresql://placeholder:placeholder@localhost/placeholder");

// Create Drizzle instance with schema
export const db = drizzle(sql, { schema });

// Check if database is configured
export const isDatabaseConfigured = () => !!databaseUrl;

// Export schema for use in queries
export * from "./schema";

// Type exports for use throughout the app
export type Database = typeof db;

// ID generator helper
export const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateOrderNumber = () => `ORD-${String(Date.now()).slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
export const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
