import "dotenv/config";
import { neon } from "@neondatabase/serverless";

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL not set");
    process.exit(1);
  }
  const sql = neon(url);
  const rows = await sql`select table_name from information_schema.tables where table_schema = 'public' order by table_name;`;
  console.log(rows.map((r: any) => r.table_name).join("\n"));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
