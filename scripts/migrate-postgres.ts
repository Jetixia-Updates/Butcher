/**
 * Neon Database Migration Script using postgres.js
 * 
 * Run with: npx tsx scripts/migrate-postgres.ts
 */

import postgres from 'postgres';
import * as fs from 'fs';
import * as path from 'path';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

async function migrate() {
  console.log('🚀 Starting Neon PostgreSQL Migration with postgres.js...\n');
  
  const sql = postgres(DATABASE_URL, {
    ssl: 'require',
    max: 1,
    idle_timeout: 20,
    connect_timeout: 30,
  });

  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const [{ now, current_database }] = await sql`SELECT NOW() as now, current_database() as current_database`;
    console.log(`✅ Connected to: ${current_database}`);
    console.log(`   Server time: ${now}\n`);

    // Read migration SQL file
    const migrationPath = path.join(process.cwd(), 'scripts', 'neon-migration.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

    console.log('📜 Running migration SQL...\n');

    // Execute the entire migration as raw SQL
    await sql.unsafe(migrationSQL);

    console.log('✅ Migration completed!\n');

    // Verify tables
    console.log('🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;

    console.log(`✅ Found ${tables.length} tables:`);
    tables.forEach(t => console.log(`   - ${t.table_name}`));

    // Verify types/enums
    const types = await sql`
      SELECT typname 
      FROM pg_type 
      WHERE typnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')
      AND typtype = 'e'
      ORDER BY typname
    `;

    console.log(`\n✅ Found ${types.length} enum types:`);
    types.forEach(t => console.log(`   - ${t.typname}`));

    // Check admin user
    const users = await sql`SELECT id, username, email, role FROM users`;
    console.log(`\n✅ Users in database: ${users.length}`);
    users.forEach(u => console.log(`   - ${u.username} (${u.email}) - ${u.role}`));

  } catch (error: any) {
    console.error('❌ Migration failed:', error.message);
    if (error.position) {
      console.error(`   Position: ${error.position}`);
    }
    throw error;
  } finally {
    await sql.end();
    console.log('\n📝 Database connection closed');
  }
}

migrate().catch(err => {
  console.error('\n❌ Fatal error:', err);
  process.exit(1);
});
