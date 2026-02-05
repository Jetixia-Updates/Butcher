/**
 * Database Migration Script for MySQL
 * Creates all tables in the MySQL database (FreeHostia)
 */

import "dotenv/config";
import mysql from "mysql2/promise";

const dbConfig = {
  host: process.env.DB_HOST || "mysql.freehostia.com",
  user: process.env.DB_USER || "essref3_butcher",
  password: process.env.DB_PASSWORD || "Butcher@123",
  database: process.env.DB_NAME || "essref3_butcher",
  port: parseInt(process.env.DB_PORT || "3306"),
};

async function migrate() {
  console.log("🚀 Starting MySQL database migration...");
  console.log(`📍 Host: ${dbConfig.host}`);
  console.log(`📁 Database: ${dbConfig.database}`);

  let connection;
  try {
    connection = await mysql.createConnection(dbConfig);
    console.log("✅ Connected to MySQL database!");

    // Create users table
    console.log("👤 Creating users table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS users (
        id VARCHAR(100) PRIMARY KEY,
        username VARCHAR(100) NOT NULL UNIQUE,
        email VARCHAR(255) NOT NULL UNIQUE,
        mobile VARCHAR(20) NOT NULL,
        password TEXT NOT NULL,
        first_name VARCHAR(100) NOT NULL,
        family_name VARCHAR(100) NOT NULL,
        role ENUM('customer', 'admin', 'staff', 'delivery') NOT NULL DEFAULT 'customer',
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_verified BOOLEAN NOT NULL DEFAULT FALSE,
        emirate VARCHAR(100),
        address TEXT,
        preferences JSON,
        permissions JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_login_at TIMESTAMP NULL
      )
    `);

    // Create sessions table
    console.log("🔐 Creating sessions table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS sessions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        token TEXT NOT NULL,
        expires_at TIMESTAMP NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_sessions_user_id (user_id)
      )
    `);

    // Create addresses table
    console.log("📍 Creating addresses table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS addresses (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        label VARCHAR(50) NOT NULL,
        full_name VARCHAR(200) NOT NULL,
        mobile VARCHAR(20) NOT NULL,
        emirate VARCHAR(100) NOT NULL,
        area VARCHAR(200) NOT NULL,
        street TEXT NOT NULL,
        building VARCHAR(200) NOT NULL,
        floor VARCHAR(20),
        apartment VARCHAR(50),
        landmark TEXT,
        latitude FLOAT,
        longitude FLOAT,
        is_default BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_addresses_user_id (user_id)
      )
    `);

    // Create product_categories table
    console.log("📁 Creating product_categories table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS product_categories (
        id VARCHAR(100) PRIMARY KEY,
        name_en VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100) NOT NULL,
        icon VARCHAR(50),
        color VARCHAR(100),
        sort_order INT NOT NULL DEFAULT 0,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create products table
    console.log("📦 Creating products table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS products (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(200) NOT NULL,
        name_ar VARCHAR(200),
        sku VARCHAR(50) NOT NULL UNIQUE,
        barcode VARCHAR(100),
        price DECIMAL(10, 2) NOT NULL,
        cost_price DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(5, 2) NOT NULL DEFAULT 0,
        category VARCHAR(100) NOT NULL,
        description TEXT,
        description_ar TEXT,
        image TEXT,
        unit ENUM('kg', 'piece', 'gram') NOT NULL DEFAULT 'kg',
        min_order_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.25,
        max_order_quantity DECIMAL(10, 2) NOT NULL DEFAULT 10,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        is_featured BOOLEAN NOT NULL DEFAULT FALSE,
        is_premium BOOLEAN NOT NULL DEFAULT FALSE,
        rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
        tags JSON,
        badges JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create stock table
    console.log("📊 Creating stock table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock (
        id VARCHAR(100) PRIMARY KEY,
        product_id VARCHAR(100) NOT NULL UNIQUE,
        quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
        reserved_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
        available_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
        low_stock_threshold INT NOT NULL DEFAULT 5,
        reorder_point INT NOT NULL DEFAULT 10,
        reorder_quantity INT NOT NULL DEFAULT 20,
        last_restocked_at TIMESTAMP NULL,
        expiry_date TIMESTAMP NULL,
        batch_number VARCHAR(100),
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create stock_movements table
    console.log("📈 Creating stock_movements table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS stock_movements (
        id VARCHAR(100) PRIMARY KEY,
        product_id VARCHAR(100) NOT NULL,
        type ENUM('in', 'out', 'adjustment', 'reserved', 'released') NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        previous_quantity DECIMAL(10, 2) NOT NULL,
        new_quantity DECIMAL(10, 2) NOT NULL,
        reason TEXT NOT NULL,
        reference_type VARCHAR(50),
        reference_id VARCHAR(100),
        performed_by VARCHAR(100) NOT NULL,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_stock_movements_product (product_id)
      )
    `);

    // Create orders table
    console.log("🛒 Creating orders table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS orders (
        id VARCHAR(100) PRIMARY KEY,
        order_number VARCHAR(50) NOT NULL UNIQUE,
        user_id VARCHAR(100) NOT NULL,
        customer_name VARCHAR(200) NOT NULL,
        customer_email VARCHAR(255) NOT NULL,
        customer_mobile VARCHAR(20) NOT NULL,
        subtotal DECIMAL(10, 2) NOT NULL,
        discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        discount_code VARCHAR(50),
        delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 0,
        vat_amount DECIMAL(10, 2) NOT NULL,
        vat_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
        total DECIMAL(10, 2) NOT NULL,
        status ENUM('pending', 'confirmed', 'processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'refunded') NOT NULL DEFAULT 'pending',
        payment_status ENUM('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'pending',
        payment_method ENUM('card', 'cod', 'bank_transfer') NOT NULL,
        address_id VARCHAR(100) NOT NULL,
        delivery_address JSON NOT NULL,
        delivery_notes TEXT,
        delivery_zone_id VARCHAR(100),
        estimated_delivery_at TIMESTAMP NULL,
        actual_delivery_at TIMESTAMP NULL,
        status_history JSON,
        source VARCHAR(20) NOT NULL DEFAULT 'web',
        ip_address VARCHAR(50),
        user_agent TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_orders_user_id (user_id),
        INDEX idx_orders_status (status)
      )
    `);

    // Create order_items table
    console.log("📋 Creating order_items table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS order_items (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        product_id VARCHAR(100) NOT NULL,
        product_name VARCHAR(200) NOT NULL,
        product_name_ar VARCHAR(200),
        sku VARCHAR(50) NOT NULL,
        quantity DECIMAL(10, 2) NOT NULL,
        unit_price DECIMAL(10, 2) NOT NULL,
        total_price DECIMAL(10, 2) NOT NULL,
        notes TEXT,
        INDEX idx_order_items_order (order_id)
      )
    `);

    // Create payments table
    console.log("💳 Creating payments table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS payments (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        order_number VARCHAR(50) NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency ENUM('AED', 'USD', 'EUR') NOT NULL DEFAULT 'AED',
        method ENUM('card', 'cod', 'bank_transfer') NOT NULL,
        status ENUM('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded') NOT NULL DEFAULT 'pending',
        card_brand VARCHAR(50),
        card_last4 VARCHAR(4),
        card_expiry_month INT,
        card_expiry_year INT,
        gateway_transaction_id TEXT,
        gateway_response TEXT,
        refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
        refunds JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_payments_order (order_id)
      )
    `);

    // Create delivery_zones table
    console.log("🚚 Creating delivery_zones table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_zones (
        id VARCHAR(100) PRIMARY KEY,
        name VARCHAR(100) NOT NULL,
        name_ar VARCHAR(100),
        emirate VARCHAR(100) NOT NULL,
        areas JSON NOT NULL,
        delivery_fee DECIMAL(10, 2) NOT NULL,
        minimum_order DECIMAL(10, 2) NOT NULL,
        estimated_minutes INT NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        express_enabled BOOLEAN NOT NULL DEFAULT FALSE,
        express_fee DECIMAL(10, 2) NOT NULL DEFAULT 25,
        express_hours INT NOT NULL DEFAULT 1
      )
    `);

    // Create delivery_tracking table
    console.log("📍 Creating delivery_tracking table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS delivery_tracking (
        id VARCHAR(100) PRIMARY KEY,
        order_id VARCHAR(100) NOT NULL,
        order_number VARCHAR(50) NOT NULL,
        driver_id VARCHAR(100),
        driver_name VARCHAR(200),
        driver_mobile VARCHAR(20),
        status ENUM('assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'failed') NOT NULL DEFAULT 'assigned',
        current_location JSON,
        estimated_arrival TIMESTAMP NULL,
        actual_arrival TIMESTAMP NULL,
        delivery_proof JSON,
        timeline JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        INDEX idx_delivery_tracking_order (order_id)
      )
    `);

    // Create discount_codes table
    console.log("🎫 Creating discount_codes table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS discount_codes (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(50) NOT NULL UNIQUE,
        type ENUM('percentage', 'fixed') NOT NULL,
        value DECIMAL(10, 2) NOT NULL,
        minimum_order DECIMAL(10, 2) NOT NULL DEFAULT 0,
        maximum_discount DECIMAL(10, 2),
        usage_limit INT NOT NULL DEFAULT 0,
        usage_count INT NOT NULL DEFAULT 0,
        user_limit INT NOT NULL DEFAULT 1,
        valid_from TIMESTAMP NOT NULL,
        valid_to TIMESTAMP NOT NULL,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        applicable_products JSON,
        applicable_categories JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create notifications table
    console.log("🔔 Creating notifications table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS notifications (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        type ENUM('order_placed', 'order_confirmed', 'order_processing', 'order_ready', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_received', 'payment_failed', 'refund_processed', 'low_stock', 'promotional') NOT NULL,
        channel ENUM('sms', 'email', 'push') NOT NULL,
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        message_ar TEXT,
        status ENUM('pending', 'sent', 'delivered', 'failed') NOT NULL DEFAULT 'pending',
        sent_at TIMESTAMP NULL,
        delivered_at TIMESTAMP NULL,
        failure_reason TEXT,
        metadata JSON,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_notifications_user (user_id)
      )
    `);

    // Create in_app_notifications table
    console.log("📱 Creating in_app_notifications table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS in_app_notifications (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        type VARCHAR(50) NOT NULL,
        title VARCHAR(200) NOT NULL,
        title_ar VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        message_ar TEXT NOT NULL,
        link TEXT,
        link_tab VARCHAR(50),
        link_id VARCHAR(100),
        unread BOOLEAN NOT NULL DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_in_app_notifications_user (user_id)
      )
    `);

    // Create chat_messages table
    console.log("💬 Creating chat_messages table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS chat_messages (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        user_name VARCHAR(200) NOT NULL,
        user_email VARCHAR(255) NOT NULL,
        text TEXT NOT NULL,
        sender VARCHAR(10) NOT NULL,
        attachments JSON,
        read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
        read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_chat_messages_user (user_id)
      )
    `);

    // Create suppliers table
    console.log("🏭 Creating suppliers table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS suppliers (
        id VARCHAR(100) PRIMARY KEY,
        code VARCHAR(20) NOT NULL UNIQUE,
        name VARCHAR(200) NOT NULL,
        name_ar VARCHAR(200),
        email VARCHAR(255) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        website TEXT,
        tax_number VARCHAR(50),
        address JSON NOT NULL,
        contacts JSON,
        payment_terms ENUM('net_7', 'net_15', 'net_30', 'net_60', 'cod', 'prepaid') NOT NULL DEFAULT 'net_30',
        currency ENUM('AED', 'USD', 'EUR') NOT NULL DEFAULT 'AED',
        credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0,
        current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
        categories JSON,
        rating DECIMAL(3, 2) DEFAULT 0,
        on_time_delivery_rate DECIMAL(5, 2) DEFAULT 0,
        quality_score DECIMAL(5, 2) DEFAULT 0,
        total_orders INT NOT NULL DEFAULT 0,
        total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
        status ENUM('active', 'inactive', 'pending', 'suspended') NOT NULL DEFAULT 'active',
        notes TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        last_order_at TIMESTAMP NULL
      )
    `);

    // Create wallets table
    console.log("👛 Creating wallets table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wallets (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL UNIQUE,
        balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create wallet_transactions table
    console.log("💰 Creating wallet_transactions table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS wallet_transactions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        type ENUM('credit', 'debit', 'refund', 'topup', 'cashback') NOT NULL,
        amount DECIMAL(10, 2) NOT NULL,
        description TEXT NOT NULL,
        description_ar TEXT NOT NULL,
        reference VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_wallet_transactions_user (user_id)
      )
    `);

    // Create loyalty_points table
    console.log("⭐ Creating loyalty_points table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS loyalty_points (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL UNIQUE,
        points INT NOT NULL DEFAULT 0,
        total_earned INT NOT NULL DEFAULT 0,
        referral_code VARCHAR(20) UNIQUE,
        referred_by VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create loyalty_transactions table
    console.log("🎁 Creating loyalty_transactions table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS loyalty_transactions (
        id VARCHAR(100) PRIMARY KEY,
        user_id VARCHAR(100) NOT NULL,
        type ENUM('earn', 'redeem', 'bonus', 'expire') NOT NULL,
        points INT NOT NULL,
        description TEXT NOT NULL,
        order_id VARCHAR(100),
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_loyalty_transactions_user (user_id)
      )
    `);

    // Create app_settings table
    console.log("⚙️ Creating app_settings table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS app_settings (
        id VARCHAR(100) PRIMARY KEY DEFAULT 'default',
        vat_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
        delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 15,
        free_delivery_threshold DECIMAL(10, 2) NOT NULL DEFAULT 200,
        express_delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 25,
        minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 50,
        max_orders_per_day INT NOT NULL DEFAULT 100,
        enable_cash_on_delivery BOOLEAN NOT NULL DEFAULT TRUE,
        enable_card_payment BOOLEAN NOT NULL DEFAULT TRUE,
        enable_wallet BOOLEAN NOT NULL DEFAULT TRUE,
        enable_loyalty BOOLEAN NOT NULL DEFAULT TRUE,
        enable_reviews BOOLEAN NOT NULL DEFAULT TRUE,
        enable_wishlist BOOLEAN NOT NULL DEFAULT TRUE,
        enable_express_delivery BOOLEAN NOT NULL DEFAULT TRUE,
        enable_scheduled_delivery BOOLEAN NOT NULL DEFAULT TRUE,
        enable_welcome_bonus BOOLEAN NOT NULL DEFAULT TRUE,
        welcome_bonus DECIMAL(10, 2) NOT NULL DEFAULT 50,
        cashback_percentage DECIMAL(5, 2) NOT NULL DEFAULT 2,
        loyalty_points_per_aed DECIMAL(5, 2) NOT NULL DEFAULT 1,
        loyalty_point_value DECIMAL(5, 4) NOT NULL DEFAULT 0.1,
        store_phone VARCHAR(20) DEFAULT '+971 4 123 4567',
        store_email VARCHAR(255) DEFAULT 'support@aljazirabutcher.ae',
        store_address TEXT,
        store_address_ar TEXT,
        working_hours_start VARCHAR(10) DEFAULT '08:00',
        working_hours_end VARCHAR(10) DEFAULT '22:00',
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Create banners table
    console.log("🖼️ Creating banners table...");
    await connection.execute(`
      CREATE TABLE IF NOT EXISTS banners (
        id VARCHAR(100) PRIMARY KEY,
        title_en VARCHAR(200) NOT NULL,
        title_ar VARCHAR(200) NOT NULL,
        subtitle_en TEXT,
        subtitle_ar TEXT,
        image TEXT,
        bg_color VARCHAR(100) NOT NULL DEFAULT 'from-red-800 to-red-900',
        link TEXT,
        badge VARCHAR(50),
        badge_ar VARCHAR(50),
        enabled BOOLEAN NOT NULL DEFAULT TRUE,
        sort_order INT NOT NULL DEFAULT 0,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
      )
    `);

    // Seed default categories
    console.log("🌱 Seeding default categories...");
    const [existingCategories] = await connection.execute("SELECT COUNT(*) as count FROM product_categories");
    if ((existingCategories as any)[0].count === 0) {
      await connection.execute(`
        INSERT INTO product_categories (id, name_en, name_ar, icon, color, sort_order, is_active)
        VALUES 
          ('Beef', 'Beef', 'لحم بقري', '🥩', 'bg-red-100 text-red-600', 1, TRUE),
          ('Lamb', 'Lamb', 'لحم ضأن', '🍖', 'bg-orange-100 text-orange-600', 2, TRUE),
          ('Goat', 'Goat', 'لحم ماعز', '🐐', 'bg-amber-100 text-amber-600', 3, TRUE),
          ('Chicken', 'Chicken', 'دجاج', '🍗', 'bg-yellow-100 text-yellow-600', 4, TRUE),
          ('Premium', 'Premium', 'فاخر', '⭐', 'bg-purple-100 text-purple-600', 5, TRUE)
      `);
      console.log("✅ Default categories seeded");
    }

    // Seed admin user
    console.log("👤 Seeding admin user...");
    const [existingAdmin] = await connection.execute("SELECT COUNT(*) as count FROM users WHERE role = 'admin'");
    if ((existingAdmin as any)[0].count === 0) {
      await connection.execute(`
        INSERT INTO users (id, username, email, mobile, password, first_name, family_name, role, is_active, is_verified, emirate)
        VALUES ('admin_1', 'admin', 'admin@butcher.ae', '+971501234567', 'admin123', 'Admin', 'User', 'admin', TRUE, TRUE, 'Dubai')
      `);
      console.log("✅ Admin user seeded");
    }

    // Seed default app settings
    console.log("⚙️ Seeding default app settings...");
    const [existingSettings] = await connection.execute("SELECT COUNT(*) as count FROM app_settings");
    if ((existingSettings as any)[0].count === 0) {
      await connection.execute(`INSERT INTO app_settings (id) VALUES ('default')`);
      console.log("✅ Default app settings seeded");
    }

    console.log("\n✨ All migrations completed successfully!");
    console.log("🎉 MySQL database is ready to use!");

  } catch (error) {
    console.error("❌ Migration failed:", error);
    process.exit(1);
  } finally {
    if (connection) {
      await connection.end();
    }
  }
}

migrate();
