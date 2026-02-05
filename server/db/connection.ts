/**
 * Database Connection for Butcher Shop
 * Using Drizzle ORM with MySQL (FreeHostia)
 */

import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "./schema";

// Get database credentials from environment or use defaults
const dbConfig = {
  host: process.env.DB_HOST || "mysql.freehostia.com",
  user: process.env.DB_USER || "essref3_butcher",
  password: process.env.DB_PASSWORD || "Butcher@123",
  database: process.env.DB_NAME || "essref3_butcher",
  port: parseInt(process.env.DB_PORT || "3306"),
};

// Create MySQL connection pool
const pool = mysql.createPool({
  ...dbConfig,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// Create Drizzle instance with schema
export const db = drizzle(pool, { schema, mode: "default" });

// Check if database is configured
export const isDatabaseConfigured = () => !!dbConfig.host;

// Test database connection
export const testConnection = async () => {
  try {
    const connection = await pool.getConnection();
    console.log("✅ MySQL database connected successfully!");
    connection.release();
    return true;
  } catch (error) {
    console.error("❌ MySQL database connection failed:", error);
    return false;
  }
};

// Export schema for use in queries
export * from "./schema";

// Type exports for use throughout the app
export type Database = typeof db;

// ID generator helper
export const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
export const generateOrderNumber = () => `ORD-${String(Date.now()).slice(-6)}${Math.random().toString(36).substr(2, 3).toUpperCase()}`;
export const generateToken = () => `tok_${Date.now()}_${Math.random().toString(36).substr(2, 16)}`;
