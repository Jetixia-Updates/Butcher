import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./server/db/schema.ts",
  out: "./drizzle",
  dialect: "mysql",
  dbCredentials: {
    host: process.env.DB_HOST || "mysql.freehostia.com",
    user: process.env.DB_USER || "essref3_butcher",
    password: process.env.DB_PASSWORD || "Butcher@123",
    database: process.env.DB_NAME || "essref3_butcher",
    port: parseInt(process.env.DB_PORT || "3306"),
  },
});
