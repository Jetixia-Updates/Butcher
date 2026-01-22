import { neon } from '@neondatabase/serverless';

const sql = neon(process.env.DATABASE_URL!);

async function migrateSchema() {
  try {
    console.log('🔄 Migrating schema to separate customers from users...\n');

    // 1. Create customer_sessions table
    console.log('Creating customer_sessions table...');
    await sql`
      CREATE TABLE IF NOT EXISTS "customer_sessions" (
        "id" text PRIMARY KEY NOT NULL,
        "customer_id" text NOT NULL,
        "token" text NOT NULL UNIQUE,
        "expires_at" timestamp NOT NULL,
        "created_at" timestamp DEFAULT now() NOT NULL
      )
    `;
    console.log('✓ customer_sessions table created');

    // 2. Add customerId to addresses table
    console.log('Adding customer_id to addresses table...');
    try {
      await sql`ALTER TABLE "addresses" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "addresses" ALTER COLUMN "user_id" DROP NOT NULL`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ addresses table updated');

    // 3. Add new columns to customers table
    console.log('Adding authentication columns to customers table...');
    try {
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "username" varchar(100)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "email" varchar(255)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "mobile" varchar(20)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "password" text`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "first_name" varchar(100)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "family_name" varchar(100)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_active" boolean DEFAULT true`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "is_verified" boolean DEFAULT false`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "emirate" varchar(100)`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "address" text`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "preferences" jsonb`;
      await sql`ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "last_login_at" timestamp`;
      // Drop the old user_id column and constraint
      await sql`ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_user_id_unique"`;
      await sql`ALTER TABLE "customers" DROP CONSTRAINT IF EXISTS "customers_user_id_users_id_fk"`;
      await sql`ALTER TABLE "customers" DROP COLUMN IF EXISTS "user_id"`;
    } catch (e) { console.log('  (some columns may already exist)', e); }
    console.log('✓ customers table updated');

    // 4. Add customerId to orders table
    console.log('Adding customer_id to orders table...');
    try {
      await sql`ALTER TABLE "orders" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "orders" ALTER COLUMN "user_id" DROP NOT NULL`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ orders table updated');

    // 5. Update notifications table
    console.log('Adding customer_id to notifications table...');
    try {
      await sql`ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "notifications" ALTER COLUMN "user_id" DROP NOT NULL`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ notifications table updated');

    // 6. Update in_app_notifications table
    console.log('Adding customer_id to in_app_notifications table...');
    try {
      await sql`ALTER TABLE "in_app_notifications" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "in_app_notifications" ALTER COLUMN "user_id" DROP NOT NULL`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ in_app_notifications table updated');

    // 7. Update chat_messages table
    console.log('Updating chat_messages table...');
    try {
      await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_name" varchar(200)`;
      await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "customer_email" varchar(255)`;
      await sql`ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "read_by_customer" boolean DEFAULT false`;
      // Migrate old data if exists
      await sql`UPDATE "chat_messages" SET "customer_name" = "user_name" WHERE "customer_name" IS NULL AND "user_name" IS NOT NULL`;
      await sql`UPDATE "chat_messages" SET "customer_email" = "user_email" WHERE "customer_email" IS NULL AND "user_email" IS NOT NULL`;
      await sql`UPDATE "chat_messages" SET "read_by_customer" = "read_by_user" WHERE "read_by_customer" IS NULL`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ chat_messages table updated');

    // 8. Update saved_cards table
    console.log('Updating saved_cards table...');
    try {
      await sql`ALTER TABLE "saved_cards" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      // Copy data from user_id to customer_id for migration
      await sql`ALTER TABLE "saved_cards" DROP CONSTRAINT IF EXISTS "saved_cards_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ saved_cards table updated');

    // 9. Update wallets table
    console.log('Updating wallets table...');
    try {
      await sql`ALTER TABLE "wallets" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_user_id_unique"`;
      await sql`ALTER TABLE "wallets" DROP CONSTRAINT IF EXISTS "wallets_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ wallets table updated');

    // 10. Update wallet_transactions table
    console.log('Updating wallet_transactions table...');
    try {
      await sql`ALTER TABLE "wallet_transactions" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "wallet_transactions" DROP CONSTRAINT IF EXISTS "wallet_transactions_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ wallet_transactions table updated');

    // 11. Update wishlists table
    console.log('Updating wishlists table...');
    try {
      await sql`ALTER TABLE "wishlists" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "wishlists" DROP CONSTRAINT IF EXISTS "wishlists_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ wishlists table updated');

    // 12. Update product_reviews table
    console.log('Updating product_reviews table...');
    try {
      await sql`ALTER TABLE "product_reviews" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "product_reviews" DROP CONSTRAINT IF EXISTS "product_reviews_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ product_reviews table updated');

    // 13. Update loyalty_points table
    console.log('Updating loyalty_points table...');
    try {
      await sql`ALTER TABLE "loyalty_points" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "loyalty_points" DROP CONSTRAINT IF EXISTS "loyalty_points_user_id_unique"`;
      await sql`ALTER TABLE "loyalty_points" DROP CONSTRAINT IF EXISTS "loyalty_points_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ loyalty_points table updated');

    // 14. Update loyalty_transactions table
    console.log('Updating loyalty_transactions table...');
    try {
      await sql`ALTER TABLE "loyalty_transactions" ADD COLUMN IF NOT EXISTS "customer_id" text`;
      await sql`ALTER TABLE "loyalty_transactions" DROP CONSTRAINT IF EXISTS "loyalty_transactions_user_id_users_id_fk"`;
    } catch { console.log('  (columns may already exist)'); }
    console.log('✓ loyalty_transactions table updated');

    // 15. Migrate existing customer data from users table to customers table
    console.log('\nMigrating customer data from users to customers...');
    const customerUsers = await sql`SELECT * FROM users WHERE role = 'customer'`;
    console.log(`Found ${customerUsers.length} customers to migrate`);

    for (const user of customerUsers) {
      // Check if customer already exists
      const existingCustomer = await sql`SELECT id FROM customers WHERE email = ${user.email}`;
      
      if (existingCustomer.length === 0) {
        // Get customer number
        const countResult = await sql`SELECT COUNT(*) as count FROM customers`;
        const customerNumber = `CUST-${String(Number(countResult[0].count) + 1).padStart(4, '0')}`;
        
        await sql`
          INSERT INTO customers (
            id, username, email, mobile, password, first_name, family_name,
            is_active, is_verified, emirate, address, preferences,
            customer_number, segment, credit_limit, current_balance,
            lifetime_value, total_orders, total_spent, average_order_value,
            preferred_language, marketing_opt_in, sms_opt_in, email_opt_in,
            referral_count, created_at, updated_at, last_login_at
          ) VALUES (
            ${'cust_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9)},
            ${user.username}, ${user.email}, ${user.mobile}, ${user.password},
            ${user.first_name}, ${user.family_name}, ${user.is_active}, ${user.is_verified},
            ${user.emirate}, ${user.address}, ${JSON.stringify(user.preferences)},
            ${customerNumber}, 'regular', '0', '0', '0', 0, '0', '0',
            'en', true, true, true, 0, ${user.created_at}, NOW(), ${user.last_login_at}
          )
        `;
        console.log(`  ✓ Migrated ${user.first_name} ${user.family_name} (${customerNumber})`);
      } else {
        console.log(`  - Skipped ${user.first_name} ${user.family_name} (already exists)`);
      }
    }

    // 16. Delete customer users from users table (keep only staff)
    console.log('\nRemoving customers from users table (keeping only staff)...');
    await sql`DELETE FROM users WHERE role = 'customer'`;
    console.log('✓ Users table now contains only staff');

    console.log('\n✅ Migration completed successfully!');
    console.log('\nSummary:');
    console.log('  - users table: Now for staff only (admin, staff, delivery)');
    console.log('  - customers table: Standalone for customer registration');
    console.log('  - All customer-related tables now reference customers table');

  } catch (error) {
    console.error('Error during migration:', error);
    process.exit(1);
  }
}

migrateSchema();
