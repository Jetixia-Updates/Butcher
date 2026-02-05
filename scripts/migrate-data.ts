/**
 * Data Migration Script
 * Copies all data from MySQL (FreeHostia) to Neon PostgreSQL
 */

import mysql from 'mysql2/promise';
import postgres from 'postgres';

// Old MySQL database (FreeHostia)
const MYSQL_CONFIG = {
  host: 'mysql.freehostia.com',
  user: 'essref3_butcher',
  password: 'Butcher@123',
  database: 'essref3_butcher',
  connectTimeout: 30000,
  dateStrings: true, // Return dates as strings to handle invalid dates
};

// New Neon PostgreSQL database
const NEON_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Column mapping: MySQL column names to PostgreSQL column names
const columnMappings: Record<string, Record<string, string>> = {
  users: {
    first_name: 'first_name',
    family_name: 'family_name',
    is_active: 'is_active',
    is_verified: 'is_verified',
    created_at: 'created_at',
    updated_at: 'updated_at',
    last_login_at: 'last_login_at',
  },
  products: {
    name_ar: 'name_ar',
    cost_price: 'cost_price',
    description_ar: 'description_ar',
    min_order_quantity: 'min_order_quantity',
    max_order_quantity: 'max_order_quantity',
    is_active: 'is_active',
    is_featured: 'is_featured',
    is_premium: 'is_premium',
    created_at: 'created_at',
    updated_at: 'updated_at',
  },
};

async function migrate() {
  console.log('🚀 Starting Data Migration from MySQL to Neon PostgreSQL...\n');

  // Connect to MySQL
  console.log('📡 Connecting to MySQL (FreeHostia)...');
  let mysqlConn: mysql.Connection;
  try {
    mysqlConn = await mysql.createConnection(MYSQL_CONFIG);
    console.log('✅ MySQL connected\n');
  } catch (err: any) {
    console.error('❌ MySQL connection failed:', err.message);
    process.exit(1);
  }

  // Connect to PostgreSQL
  console.log('📡 Connecting to Neon PostgreSQL...');
  const pgSql = postgres(NEON_URL, { ssl: 'require', max: 1 });
  try {
    await pgSql`SELECT 1`;
    console.log('✅ PostgreSQL connected\n');
  } catch (err: any) {
    console.error('❌ PostgreSQL connection failed:', err.message);
    await mysqlConn.end();
    process.exit(1);
  }

  // Tables to migrate in order (respecting foreign key dependencies)
  const tables = [
    'users',
    'sessions',
    'product_categories',
    'products',
    'stock',
    'stock_movements',
    'addresses',
    'orders',
    'order_items',
    'payments',
    'delivery_zones',
    'delivery_time_slots',
    'delivery_tracking',
    'discount_codes',
    'banners',
    'app_settings',
    'notifications',
    'in_app_notifications',
    'chat_messages',
    'suppliers',
    'supplier_products',
    'purchase_orders',
    'purchase_order_items',
    'finance_accounts',
    'finance_transactions',
    'finance_expenses',
    'wallets',
    'wallet_transactions',
    'saved_cards',
    'loyalty_tiers',
    'loyalty_points',
    'loyalty_transactions',
    'product_reviews',
    'wishlists',
  ];

  const stats = {
    migrated: 0,
    skipped: 0,
    errors: 0,
  };

  for (const table of tables) {
    try {
      // Check if table exists in MySQL
      const [mysqlTables] = await mysqlConn.query(
        `SHOW TABLES LIKE '${table}'`
      );
      
      if ((mysqlTables as any[]).length === 0) {
        console.log(`⏭️  Table '${table}' not found in MySQL, skipping...`);
        stats.skipped++;
        continue;
      }

      // Get data from MySQL
      const [rows] = await mysqlConn.query(`SELECT * FROM ${table}`);
      const data = rows as any[];

      if (data.length === 0) {
        console.log(`📭 Table '${table}': 0 rows (empty)`);
        continue;
      }

      console.log(`📦 Table '${table}': ${data.length} rows to migrate...`);

      // Clear existing data in PostgreSQL (except default seed data for some tables)
      const preserveTables = ['app_settings', 'loyalty_tiers', 'delivery_zones', 'delivery_time_slots', 'product_categories'];
      if (!preserveTables.includes(table)) {
        await pgSql.unsafe(`DELETE FROM ${table}`);
      }

      // Insert data into PostgreSQL
      let inserted = 0;
      let errors = 0;

      for (const row of data) {
        try {
          // Convert MySQL data types to PostgreSQL compatible
          const pgRow = convertRow(row, table);
          
          // Build insert query
          const columns = Object.keys(pgRow);
          const values = Object.values(pgRow);
          const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
          
          const query = `
            INSERT INTO ${table} (${columns.join(', ')})
            VALUES (${placeholders})
            ON CONFLICT (id) DO UPDATE SET
            ${columns.filter(c => c !== 'id').map(c => `${c} = EXCLUDED.${c}`).join(', ')}
          `;

          await pgSql.unsafe(query, values);
          inserted++;
        } catch (err: any) {
          errors++;
          if (errors <= 3) {
            console.error(`   ❌ Error inserting into ${table}:`, err.message);
          }
        }
      }

      console.log(`   ✅ Inserted: ${inserted}, Errors: ${errors}`);
      stats.migrated++;

    } catch (err: any) {
      console.error(`❌ Failed to migrate table '${table}':`, err.message);
      stats.errors++;
    }
  }

  // Close connections
  await mysqlConn.end();
  await pgSql.end();

  console.log('\n' + '='.repeat(50));
  console.log('📊 Migration Summary:');
  console.log(`   ✅ Tables migrated: ${stats.migrated}`);
  console.log(`   ⏭️  Tables skipped: ${stats.skipped}`);
  console.log(`   ❌ Tables with errors: ${stats.errors}`);
  console.log('='.repeat(50));
}

/**
 * Convert MySQL row data to PostgreSQL compatible format
 */
function convertRow(row: any, table: string): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(row)) {
    // Convert column name from camelCase to snake_case if needed
    let pgKey = key;
    
    // Handle specific value conversions
    let pgValue = value;

    // Convert MySQL tinyint(1) to PostgreSQL boolean
    if (typeof value === 'number' && (key.startsWith('is_') || key.startsWith('enable_') || key === 'enabled' || key === 'unread')) {
      pgValue = value === 1;
    }

    // Handle date strings - convert invalid MySQL dates to null or current date
    if (typeof value === 'string' && (key.includes('_at') || key.includes('date') || key.includes('Date') || key === 'expires_at' || key === 'valid_from' || key === 'valid_to')) {
      if (value === '0000-00-00 00:00:00' || value === '0000-00-00' || value === 'Invalid Date' || !value) {
        // Use default future date for required expiry fields
        if (key === 'expires_at' || key === 'valid_to') {
          pgValue = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(); // 30 days from now
        } else if (key === 'created_at' || key === 'updated_at' || key === 'valid_from') {
          pgValue = new Date().toISOString();
        } else {
          pgValue = null;
        }
      } else {
        // Try to parse the date
        const parsed = new Date(value);
        pgValue = isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
      }
    }

    // Convert MySQL dates
    if (value instanceof Date) {
      if (isNaN(value.getTime())) {
        pgValue = key === 'created_at' || key === 'updated_at' ? new Date().toISOString() : null;
      } else {
        pgValue = value.toISOString();
      }
    }

    // Handle NULL values
    if (value === null || value === undefined) {
      pgValue = null;
    }

    // Handle JSON fields - ensure they're properly stringified for PostgreSQL
    if (typeof value === 'object' && value !== null && !(value instanceof Date)) {
      pgValue = JSON.stringify(value);
    }

    // Handle decimal/numeric values
    if (typeof value === 'string' && /^\d+\.\d+$/.test(value)) {
      pgValue = parseFloat(value);
    }

    result[pgKey] = pgValue;
  }

  return result;
}

// Run migration
migrate().catch(err => {
  console.error('❌ Migration failed:', err);
  process.exit(1);
});
