/**
 * Seed script for customers table
 * Creates test customer accounts for the application
 */

import "dotenv/config";
import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { customers, addresses, customerSessions } from "./connection";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL environment variable is not set");
}

const sql = neon(databaseUrl);
const db = drizzle(sql);

// Helper to generate unique IDs
const generateId = (prefix: string) => `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

async function seedCustomers() {
  console.log("🌱 Seeding customers...");

  try {
    // Create test customers
    const customersData = [
      {
        id: generateId("cust"),
        username: "ahmed_customer",
        email: "ahmed.customer@example.com",
        mobile: "+971501111111",
        password: "password123",
        firstName: "Ahmed",
        familyName: "Al Maktoum",
        isActive: true,
        isVerified: true,
        emirate: "Dubai",
        address: "Downtown Dubai",
        customerNumber: "CUST-0001",
        segment: "regular" as const,
        creditLimit: "0",
        currentBalance: "0",
        lifetimeValue: "0",
        totalOrders: 0,
        totalSpent: "0",
        averageOrderValue: "0",
        preferredLanguage: "en" as const,
        marketingOptIn: true,
        smsOptIn: true,
        emailOptIn: true,
        referralCount: 0,
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: generateId("cust"),
        username: "fatima_customer",
        email: "fatima.customer@example.com",
        mobile: "+971502222222",
        password: "password123",
        firstName: "Fatima",
        familyName: "Al Nahyan",
        isActive: true,
        isVerified: true,
        emirate: "Abu Dhabi",
        address: "Al Reem Island",
        customerNumber: "CUST-0002",
        segment: "regular" as const,
        creditLimit: "0",
        currentBalance: "0",
        lifetimeValue: "0",
        totalOrders: 0,
        totalSpent: "0",
        averageOrderValue: "0",
        preferredLanguage: "en" as const,
        marketingOptIn: true,
        smsOptIn: true,
        emailOptIn: true,
        referralCount: 0,
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: generateId("cust"),
        username: "mohamed_customer",
        email: "mohamed.customer@example.com",
        mobile: "+971503333333",
        password: "password123",
        firstName: "Mohamed",
        familyName: "Al Sharqi",
        isActive: true,
        isVerified: true,
        emirate: "Sharjah",
        address: "Al Majaz",
        customerNumber: "CUST-0003",
        segment: "regular" as const,
        creditLimit: "0",
        currentBalance: "0",
        lifetimeValue: "0",
        totalOrders: 0,
        totalSpent: "0",
        averageOrderValue: "0",
        preferredLanguage: "en" as const,
        marketingOptIn: true,
        smsOptIn: true,
        emailOptIn: true,
        referralCount: 0,
        preferences: {
          language: "en" as const,
          currency: "AED" as const,
          emailNotifications: true,
          smsNotifications: true,
          marketingEmails: true,
        },
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    await db.insert(customers).values(customersData).onConflictDoNothing();
    console.log("✅ Sample customers created successfully!");
    console.log("Test credentials:");
    customersData.forEach((c) => {
      console.log(`  - Username: ${c.username}, Password: ${c.password}`);
    });
  } catch (error) {
    console.error("❌ Error seeding customers:", error);
    throw error;
  }
}

// Run seed
seedCustomers()
  .then(() => process.exit(0))
  .catch(() => process.exit(1));
