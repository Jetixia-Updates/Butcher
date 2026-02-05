/**
 * Neon Database Migration Script
 * 
 * This script creates all tables in Neon PostgreSQL
 * Run with: npx tsx scripts/migrate-to-neon.ts
 */

import { neon } from '@neondatabase/serverless';

const DATABASE_URL = process.env.DATABASE_URL || 
  'postgresql://neondb_owner:npg_GHrRQzwk9E4n@ep-hidden-paper-ajua0bg2-pooler.c-3.us-east-2.aws.neon.tech/neondb?sslmode=require';

// Define all the migration statements
const migrationStatements = [
  // Drop tables
  `DROP TABLE IF EXISTS loyalty_tiers CASCADE`,
  `DROP TABLE IF EXISTS delivery_time_slots CASCADE`,
  `DROP TABLE IF EXISTS banners CASCADE`,
  `DROP TABLE IF EXISTS app_settings CASCADE`,
  `DROP TABLE IF EXISTS loyalty_transactions CASCADE`,
  `DROP TABLE IF EXISTS loyalty_points CASCADE`,
  `DROP TABLE IF EXISTS product_reviews CASCADE`,
  `DROP TABLE IF EXISTS wishlists CASCADE`,
  `DROP TABLE IF EXISTS wallet_transactions CASCADE`,
  `DROP TABLE IF EXISTS wallets CASCADE`,
  `DROP TABLE IF EXISTS saved_cards CASCADE`,
  `DROP TABLE IF EXISTS finance_expenses CASCADE`,
  `DROP TABLE IF EXISTS finance_transactions CASCADE`,
  `DROP TABLE IF EXISTS finance_accounts CASCADE`,
  `DROP TABLE IF EXISTS purchase_order_items CASCADE`,
  `DROP TABLE IF EXISTS purchase_orders CASCADE`,
  `DROP TABLE IF EXISTS supplier_products CASCADE`,
  `DROP TABLE IF EXISTS suppliers CASCADE`,
  `DROP TABLE IF EXISTS chat_messages CASCADE`,
  `DROP TABLE IF EXISTS in_app_notifications CASCADE`,
  `DROP TABLE IF EXISTS notifications CASCADE`,
  `DROP TABLE IF EXISTS discount_codes CASCADE`,
  `DROP TABLE IF EXISTS delivery_tracking CASCADE`,
  `DROP TABLE IF EXISTS delivery_zones CASCADE`,
  `DROP TABLE IF EXISTS payments CASCADE`,
  `DROP TABLE IF EXISTS order_items CASCADE`,
  `DROP TABLE IF EXISTS orders CASCADE`,
  `DROP TABLE IF EXISTS stock_movements CASCADE`,
  `DROP TABLE IF EXISTS stock CASCADE`,
  `DROP TABLE IF EXISTS products CASCADE`,
  `DROP TABLE IF EXISTS product_categories CASCADE`,
  `DROP TABLE IF EXISTS addresses CASCADE`,
  `DROP TABLE IF EXISTS sessions CASCADE`,
  `DROP TABLE IF EXISTS users CASCADE`,
  
  // Drop enums
  `DROP TYPE IF EXISTS user_role CASCADE`,
  `DROP TYPE IF EXISTS unit CASCADE`,
  `DROP TYPE IF EXISTS order_status CASCADE`,
  `DROP TYPE IF EXISTS payment_status CASCADE`,
  `DROP TYPE IF EXISTS payment_method CASCADE`,
  `DROP TYPE IF EXISTS currency CASCADE`,
  `DROP TYPE IF EXISTS stock_movement_type CASCADE`,
  `DROP TYPE IF EXISTS delivery_tracking_status CASCADE`,
  `DROP TYPE IF EXISTS discount_type CASCADE`,
  `DROP TYPE IF EXISTS notification_type CASCADE`,
  `DROP TYPE IF EXISTS notification_channel CASCADE`,
  `DROP TYPE IF EXISTS notification_status CASCADE`,
  `DROP TYPE IF EXISTS supplier_status CASCADE`,
  `DROP TYPE IF EXISTS supplier_payment_terms CASCADE`,
  `DROP TYPE IF EXISTS purchase_order_status CASCADE`,
  `DROP TYPE IF EXISTS finance_account_type CASCADE`,
  `DROP TYPE IF EXISTS finance_transaction_type CASCADE`,
  `DROP TYPE IF EXISTS finance_transaction_status CASCADE`,
  `DROP TYPE IF EXISTS expense_status CASCADE`,
  `DROP TYPE IF EXISTS wallet_transaction_type CASCADE`,
  `DROP TYPE IF EXISTS loyalty_transaction_type CASCADE`,
  
  // Create enums
  `CREATE TYPE user_role AS ENUM ('customer', 'admin', 'staff', 'delivery')`,
  `CREATE TYPE unit AS ENUM ('kg', 'piece', 'gram')`,
  `CREATE TYPE order_status AS ENUM ('pending', 'confirmed', 'processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'refunded')`,
  `CREATE TYPE payment_status AS ENUM ('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded')`,
  `CREATE TYPE payment_method AS ENUM ('card', 'cod', 'bank_transfer')`,
  `CREATE TYPE currency AS ENUM ('AED', 'USD', 'EUR')`,
  `CREATE TYPE stock_movement_type AS ENUM ('in', 'out', 'adjustment', 'reserved', 'released')`,
  `CREATE TYPE delivery_tracking_status AS ENUM ('assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'failed')`,
  `CREATE TYPE discount_type AS ENUM ('percentage', 'fixed')`,
  `CREATE TYPE notification_type AS ENUM ('order_placed', 'order_confirmed', 'order_processing', 'order_ready', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_received', 'payment_failed', 'refund_processed', 'low_stock', 'promotional')`,
  `CREATE TYPE notification_channel AS ENUM ('sms', 'email', 'push')`,
  `CREATE TYPE notification_status AS ENUM ('pending', 'sent', 'delivered', 'failed')`,
  `CREATE TYPE supplier_status AS ENUM ('active', 'inactive', 'pending', 'suspended')`,
  `CREATE TYPE supplier_payment_terms AS ENUM ('net_7', 'net_15', 'net_30', 'net_60', 'cod', 'prepaid')`,
  `CREATE TYPE purchase_order_status AS ENUM ('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled')`,
  `CREATE TYPE finance_account_type AS ENUM ('cash', 'bank', 'card_payments', 'cod_collections', 'petty_cash')`,
  `CREATE TYPE finance_transaction_type AS ENUM ('sale', 'refund', 'expense', 'purchase', 'adjustment', 'payout')`,
  `CREATE TYPE finance_transaction_status AS ENUM ('pending', 'completed', 'failed', 'cancelled')`,
  `CREATE TYPE expense_status AS ENUM ('pending', 'approved', 'paid', 'overdue', 'cancelled', 'reimbursed')`,
  `CREATE TYPE wallet_transaction_type AS ENUM ('credit', 'debit', 'refund', 'topup', 'cashback')`,
  `CREATE TYPE loyalty_transaction_type AS ENUM ('earn', 'redeem', 'bonus', 'expire')`,
  
  // Create tables
  `CREATE TABLE users (
    id VARCHAR(100) PRIMARY KEY,
    username VARCHAR(100) NOT NULL UNIQUE,
    email VARCHAR(255) NOT NULL UNIQUE,
    mobile VARCHAR(20) NOT NULL,
    password TEXT NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    family_name VARCHAR(100) NOT NULL,
    role user_role NOT NULL DEFAULT 'customer',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_verified BOOLEAN NOT NULL DEFAULT FALSE,
    emirate VARCHAR(100),
    address TEXT,
    preferences JSONB,
    permissions JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_login_at TIMESTAMP
  )`,
  
  `CREATE TABLE sessions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    token TEXT NOT NULL,
    expires_at TIMESTAMP NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE addresses (
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
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE product_categories (
    id VARCHAR(100) PRIMARY KEY,
    name_en VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100) NOT NULL,
    icon VARCHAR(50),
    color VARCHAR(100),
    sort_order INTEGER NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE products (
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
    unit unit NOT NULL DEFAULT 'kg',
    min_order_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0.25,
    max_order_quantity DECIMAL(10, 2) NOT NULL DEFAULT 10,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    is_premium BOOLEAN NOT NULL DEFAULT FALSE,
    rating DECIMAL(3, 2) NOT NULL DEFAULT 0,
    tags JSONB DEFAULT '[]',
    badges JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE stock (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL UNIQUE,
    quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    reserved_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    available_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    low_stock_threshold INTEGER NOT NULL DEFAULT 5,
    reorder_point INTEGER NOT NULL DEFAULT 10,
    reorder_quantity INTEGER NOT NULL DEFAULT 20,
    last_restocked_at TIMESTAMP,
    expiry_date TIMESTAMP,
    batch_number VARCHAR(100),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE stock_movements (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    type stock_movement_type NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    previous_quantity DECIMAL(10, 2) NOT NULL,
    new_quantity DECIMAL(10, 2) NOT NULL,
    reason TEXT NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    performed_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE orders (
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
    status order_status NOT NULL DEFAULT 'pending',
    payment_status payment_status NOT NULL DEFAULT 'pending',
    payment_method payment_method NOT NULL,
    address_id VARCHAR(100) NOT NULL,
    delivery_address JSONB NOT NULL,
    delivery_notes TEXT,
    delivery_zone_id VARCHAR(100),
    estimated_delivery_at TIMESTAMP,
    actual_delivery_at TIMESTAMP,
    status_history JSONB DEFAULT '[]',
    source VARCHAR(20) NOT NULL DEFAULT 'web',
    ip_address VARCHAR(50),
    user_agent TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE order_items (
    id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    product_name_ar VARCHAR(200),
    sku VARCHAR(50) NOT NULL,
    quantity DECIMAL(10, 2) NOT NULL,
    unit_price DECIMAL(10, 2) NOT NULL,
    total_price DECIMAL(10, 2) NOT NULL,
    notes TEXT
  )`,
  
  `CREATE TABLE payments (
    id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency currency NOT NULL DEFAULT 'AED',
    method payment_method NOT NULL,
    status payment_status NOT NULL DEFAULT 'pending',
    card_brand VARCHAR(50),
    card_last4 VARCHAR(4),
    card_expiry_month INTEGER,
    card_expiry_year INTEGER,
    gateway_transaction_id TEXT,
    gateway_response TEXT,
    refunded_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    refunds JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE delivery_zones (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    emirate VARCHAR(100) NOT NULL,
    areas JSONB NOT NULL,
    delivery_fee DECIMAL(10, 2) NOT NULL,
    minimum_order DECIMAL(10, 2) NOT NULL,
    estimated_minutes INTEGER NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    express_enabled BOOLEAN NOT NULL DEFAULT FALSE,
    express_fee DECIMAL(10, 2) NOT NULL DEFAULT 25,
    express_hours INTEGER NOT NULL DEFAULT 1
  )`,
  
  `CREATE TABLE delivery_tracking (
    id VARCHAR(100) PRIMARY KEY,
    order_id VARCHAR(100) NOT NULL,
    order_number VARCHAR(50) NOT NULL,
    driver_id VARCHAR(100),
    driver_name VARCHAR(200),
    driver_mobile VARCHAR(20),
    status delivery_tracking_status NOT NULL DEFAULT 'assigned',
    current_location JSONB,
    estimated_arrival TIMESTAMP,
    actual_arrival TIMESTAMP,
    delivery_proof JSONB,
    timeline JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE discount_codes (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(50) NOT NULL UNIQUE,
    type discount_type NOT NULL,
    value DECIMAL(10, 2) NOT NULL,
    minimum_order DECIMAL(10, 2) NOT NULL DEFAULT 0,
    maximum_discount DECIMAL(10, 2),
    usage_limit INTEGER NOT NULL DEFAULT 0,
    usage_count INTEGER NOT NULL DEFAULT 0,
    user_limit INTEGER NOT NULL DEFAULT 1,
    valid_from TIMESTAMP NOT NULL,
    valid_to TIMESTAMP NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    applicable_products JSONB,
    applicable_categories JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE notifications (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    type notification_type NOT NULL,
    channel notification_channel NOT NULL,
    title VARCHAR(200) NOT NULL,
    message TEXT NOT NULL,
    message_ar TEXT,
    status notification_status NOT NULL DEFAULT 'pending',
    sent_at TIMESTAMP,
    delivered_at TIMESTAMP,
    failure_reason TEXT,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE in_app_notifications (
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
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE chat_messages (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(200) NOT NULL,
    user_email VARCHAR(255) NOT NULL,
    text TEXT NOT NULL,
    sender VARCHAR(10) NOT NULL,
    attachments JSONB,
    read_by_admin BOOLEAN NOT NULL DEFAULT FALSE,
    read_by_user BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE suppliers (
    id VARCHAR(100) PRIMARY KEY,
    code VARCHAR(20) NOT NULL UNIQUE,
    name VARCHAR(200) NOT NULL,
    name_ar VARCHAR(200),
    email VARCHAR(255) NOT NULL,
    phone VARCHAR(20) NOT NULL,
    website TEXT,
    tax_number VARCHAR(50),
    address JSONB NOT NULL,
    contacts JSONB DEFAULT '[]',
    payment_terms supplier_payment_terms NOT NULL DEFAULT 'net_30',
    currency currency NOT NULL DEFAULT 'AED',
    credit_limit DECIMAL(12, 2) NOT NULL DEFAULT 0,
    current_balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    categories JSONB DEFAULT '[]',
    rating DECIMAL(3, 2) DEFAULT 0,
    on_time_delivery_rate DECIMAL(5, 2) DEFAULT 0,
    quality_score DECIMAL(5, 2) DEFAULT 0,
    total_orders INTEGER NOT NULL DEFAULT 0,
    total_spent DECIMAL(12, 2) NOT NULL DEFAULT 0,
    status supplier_status NOT NULL DEFAULT 'active',
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    last_order_at TIMESTAMP
  )`,
  
  `CREATE TABLE supplier_products (
    id VARCHAR(100) PRIMARY KEY,
    supplier_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    supplier_sku VARCHAR(100),
    unit_cost DECIMAL(10, 2) NOT NULL,
    minimum_order_quantity INTEGER NOT NULL DEFAULT 1,
    lead_time_days INTEGER NOT NULL DEFAULT 7,
    is_preferred BOOLEAN NOT NULL DEFAULT FALSE,
    last_purchase_price DECIMAL(10, 2),
    last_purchase_date TIMESTAMP,
    notes TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE purchase_orders (
    id VARCHAR(100) PRIMARY KEY,
    order_number VARCHAR(50) NOT NULL UNIQUE,
    supplier_id VARCHAR(100) NOT NULL,
    supplier_name VARCHAR(200) NOT NULL,
    subtotal DECIMAL(12, 2) NOT NULL,
    tax_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    tax_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
    shipping_cost DECIMAL(10, 2) NOT NULL DEFAULT 0,
    discount DECIMAL(10, 2) NOT NULL DEFAULT 0,
    total DECIMAL(12, 2) NOT NULL,
    status purchase_order_status NOT NULL DEFAULT 'draft',
    payment_status VARCHAR(20) NOT NULL DEFAULT 'pending',
    order_date TIMESTAMP NOT NULL DEFAULT NOW(),
    expected_delivery_date TIMESTAMP NOT NULL,
    actual_delivery_date TIMESTAMP,
    delivery_address TEXT NOT NULL,
    delivery_notes TEXT,
    tracking_number VARCHAR(100),
    created_by VARCHAR(100) NOT NULL,
    approved_by VARCHAR(100),
    approved_at TIMESTAMP,
    internal_notes TEXT,
    supplier_notes TEXT,
    status_history JSONB DEFAULT '[]',
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE purchase_order_items (
    id VARCHAR(100) PRIMARY KEY,
    purchase_order_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    product_name VARCHAR(200) NOT NULL,
    supplier_sku VARCHAR(100),
    quantity DECIMAL(10, 2) NOT NULL,
    unit_cost DECIMAL(10, 2) NOT NULL,
    total_cost DECIMAL(10, 2) NOT NULL,
    received_quantity DECIMAL(10, 2) NOT NULL DEFAULT 0,
    notes TEXT
  )`,
  
  `CREATE TABLE finance_accounts (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    name_ar VARCHAR(100),
    type finance_account_type NOT NULL,
    balance DECIMAL(14, 2) NOT NULL DEFAULT 0,
    currency currency NOT NULL DEFAULT 'AED',
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    bank_name VARCHAR(100),
    account_number VARCHAR(50),
    iban VARCHAR(50),
    last_reconciled TIMESTAMP,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE finance_transactions (
    id VARCHAR(100) PRIMARY KEY,
    type finance_transaction_type NOT NULL,
    status finance_transaction_status NOT NULL DEFAULT 'pending',
    amount DECIMAL(12, 2) NOT NULL,
    currency currency NOT NULL DEFAULT 'AED',
    description TEXT NOT NULL,
    description_ar TEXT,
    category VARCHAR(50),
    reference VARCHAR(100),
    reference_type VARCHAR(50),
    reference_id VARCHAR(100),
    account_id VARCHAR(100) NOT NULL,
    account_name VARCHAR(100) NOT NULL,
    created_by VARCHAR(100) NOT NULL,
    notes TEXT,
    attachments JSONB,
    metadata JSONB,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE finance_expenses (
    id VARCHAR(100) PRIMARY KEY,
    expense_number VARCHAR(50) NOT NULL,
    category VARCHAR(50) NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    currency currency NOT NULL DEFAULT 'AED',
    description TEXT NOT NULL,
    vendor VARCHAR(200),
    status expense_status NOT NULL DEFAULT 'pending',
    created_by VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE saved_cards (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    brand VARCHAR(50) NOT NULL,
    last4 VARCHAR(4) NOT NULL,
    expiry_month INTEGER NOT NULL,
    expiry_year INTEGER NOT NULL,
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    token TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE wallets (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    balance DECIMAL(12, 2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE wallet_transactions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    type wallet_transaction_type NOT NULL,
    amount DECIMAL(10, 2) NOT NULL,
    description TEXT NOT NULL,
    description_ar TEXT NOT NULL,
    reference VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE wishlists (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    product_id VARCHAR(100) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE product_reviews (
    id VARCHAR(100) PRIMARY KEY,
    product_id VARCHAR(100) NOT NULL,
    user_id VARCHAR(100) NOT NULL,
    user_name VARCHAR(200) NOT NULL,
    rating INTEGER NOT NULL,
    title VARCHAR(200) NOT NULL,
    comment TEXT NOT NULL,
    images JSONB,
    is_verified_purchase BOOLEAN NOT NULL DEFAULT FALSE,
    helpful_count INTEGER NOT NULL DEFAULT 0,
    is_approved BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE loyalty_points (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL UNIQUE,
    points INTEGER NOT NULL DEFAULT 0,
    total_earned INTEGER NOT NULL DEFAULT 0,
    referral_code VARCHAR(20) UNIQUE,
    referred_by VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE loyalty_transactions (
    id VARCHAR(100) PRIMARY KEY,
    user_id VARCHAR(100) NOT NULL,
    type loyalty_transaction_type NOT NULL,
    points INTEGER NOT NULL,
    description TEXT NOT NULL,
    order_id VARCHAR(100),
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE app_settings (
    id VARCHAR(100) PRIMARY KEY DEFAULT 'default',
    vat_rate DECIMAL(5, 4) NOT NULL DEFAULT 0.05,
    delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 15,
    free_delivery_threshold DECIMAL(10, 2) NOT NULL DEFAULT 200,
    express_delivery_fee DECIMAL(10, 2) NOT NULL DEFAULT 25,
    minimum_order_amount DECIMAL(10, 2) NOT NULL DEFAULT 50,
    max_orders_per_day INTEGER NOT NULL DEFAULT 100,
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
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE banners (
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
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE delivery_time_slots (
    id VARCHAR(100) PRIMARY KEY,
    label VARCHAR(100) NOT NULL,
    label_ar VARCHAR(100) NOT NULL,
    start_time VARCHAR(10) NOT NULL,
    end_time VARCHAR(10) NOT NULL,
    is_express_slot BOOLEAN NOT NULL DEFAULT FALSE,
    max_orders INTEGER NOT NULL DEFAULT 20,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  `CREATE TABLE loyalty_tiers (
    id VARCHAR(100) PRIMARY KEY,
    name VARCHAR(50) NOT NULL,
    name_ar VARCHAR(50) NOT NULL,
    min_points INTEGER NOT NULL,
    multiplier DECIMAL(3, 1) NOT NULL DEFAULT 1,
    benefits JSONB NOT NULL,
    benefits_ar JSONB NOT NULL,
    icon VARCHAR(10) NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    created_at TIMESTAMP NOT NULL DEFAULT NOW()
  )`,
  
  // Create indexes
  `CREATE INDEX idx_users_email ON users(email)`,
  `CREATE INDEX idx_users_mobile ON users(mobile)`,
  `CREATE INDEX idx_sessions_user_id ON sessions(user_id)`,
  `CREATE INDEX idx_sessions_token ON sessions(token)`,
  `CREATE INDEX idx_addresses_user_id ON addresses(user_id)`,
  `CREATE INDEX idx_products_category ON products(category)`,
  `CREATE INDEX idx_products_sku ON products(sku)`,
  `CREATE INDEX idx_orders_user_id ON orders(user_id)`,
  `CREATE INDEX idx_orders_status ON orders(status)`,
  `CREATE INDEX idx_order_items_order_id ON order_items(order_id)`,
  `CREATE INDEX idx_payments_order_id ON payments(order_id)`,
  `CREATE INDEX idx_notifications_user_id ON notifications(user_id)`,
  `CREATE INDEX idx_in_app_notifications_user_id ON in_app_notifications(user_id)`,
  `CREATE INDEX idx_wishlists_user_id ON wishlists(user_id)`,
  `CREATE INDEX idx_product_reviews_product_id ON product_reviews(product_id)`,
  `CREATE INDEX idx_loyalty_points_user_id ON loyalty_points(user_id)`,
  `CREATE INDEX idx_wallet_transactions_user_id ON wallet_transactions(user_id)`,
  
  // Insert default data
  `INSERT INTO app_settings (id) VALUES ('default')`,
  
  `INSERT INTO users (id, username, email, mobile, password, first_name, family_name, role, is_active, is_verified)
   VALUES ('admin-default', 'admin', 'admin@aljazirabutcher.ae', '+971501234567', 'admin123', 'Admin', 'User', 'admin', TRUE, TRUE)`,
  
  `INSERT INTO product_categories (id, name_en, name_ar, icon, color, sort_order, is_active) VALUES
   ('cat-beef', 'Beef', 'لحم بقر', '🥩', 'red', 1, TRUE),
   ('cat-lamb', 'Lamb', 'لحم ضأن', '🍖', 'orange', 2, TRUE),
   ('cat-chicken', 'Chicken', 'دجاج', '🍗', 'yellow', 3, TRUE),
   ('cat-seafood', 'Seafood', 'مأكولات بحرية', '🦐', 'blue', 4, TRUE),
   ('cat-marinated', 'Marinated', 'متبل', '🌶️', 'green', 5, TRUE),
   ('cat-processed', 'Processed', 'مصنعة', '🌭', 'purple', 6, TRUE)`,
  
  `INSERT INTO delivery_zones (id, name, name_ar, emirate, areas, delivery_fee, minimum_order, estimated_minutes, is_active, express_enabled) VALUES
   ('zone-dubai-downtown', 'Dubai Downtown', 'وسط دبي', 'Dubai', '["Downtown Dubai", "Business Bay", "DIFC"]', 15, 50, 45, TRUE, TRUE),
   ('zone-dubai-marina', 'Dubai Marina', 'دبي مارينا', 'Dubai', '["Dubai Marina", "JBR", "JLT"]', 15, 50, 60, TRUE, TRUE),
   ('zone-abu-dhabi', 'Abu Dhabi City', 'مدينة أبوظبي', 'Abu Dhabi', '["Downtown", "Corniche", "Al Reem Island"]', 25, 100, 90, TRUE, FALSE),
   ('zone-sharjah', 'Sharjah City', 'مدينة الشارقة', 'Sharjah', '["Al Majaz", "Al Nahda", "Al Khan"]', 20, 75, 75, TRUE, FALSE)`,
  
  `INSERT INTO delivery_time_slots (id, label, label_ar, start_time, end_time, is_express_slot, max_orders, enabled, sort_order) VALUES
   ('slot-morning', 'Morning', 'صباحاً', '08:00', '12:00', FALSE, 20, TRUE, 1),
   ('slot-afternoon', 'Afternoon', 'بعد الظهر', '12:00', '16:00', FALSE, 20, TRUE, 2),
   ('slot-evening', 'Evening', 'مساءً', '16:00', '20:00', FALSE, 20, TRUE, 3),
   ('slot-night', 'Night', 'ليلاً', '20:00', '22:00', FALSE, 15, TRUE, 4),
   ('slot-express', 'Express (1 Hour)', 'سريع (ساعة واحدة)', '00:00', '23:59', TRUE, 10, TRUE, 0)`,
  
  `INSERT INTO loyalty_tiers (id, name, name_ar, min_points, multiplier, benefits, benefits_ar, icon, sort_order) VALUES
   ('tier-bronze', 'Bronze', 'برونزي', 0, 1.0, '["1 point per AED spent", "Access to member-only deals"]', '["نقطة واحدة لكل درهم", "الوصول إلى عروض الأعضاء"]', '🥉', 1),
   ('tier-silver', 'Silver', 'فضي', 1000, 1.5, '["1.5x points", "Free delivery on orders over 100 AED", "Birthday bonus"]', '["1.5x نقاط", "توصيل مجاني للطلبات فوق 100 درهم", "مكافأة عيد الميلاد"]', '🥈', 2),
   ('tier-gold', 'Gold', 'ذهبي', 5000, 2.0, '["2x points", "Free delivery always", "Priority support", "Exclusive offers"]', '["2x نقاط", "توصيل مجاني دائماً", "دعم أولوية", "عروض حصرية"]', '🥇', 3),
   ('tier-platinum', 'Platinum', 'بلاتيني', 15000, 3.0, '["3x points", "Personal account manager", "Early access to new products", "VIP events"]', '["3x نقاط", "مدير حساب شخصي", "وصول مبكر للمنتجات الجديدة", "فعاليات VIP"]', '💎', 4)`,
  
  `INSERT INTO finance_accounts (id, name, name_ar, type, balance, currency, is_active) VALUES
   ('acc-main-cash', 'Main Cash Account', 'حساب النقدية الرئيسي', 'cash', 0, 'AED', TRUE),
   ('acc-bank', 'Bank Account', 'الحساب البنكي', 'bank', 0, 'AED', TRUE),
   ('acc-card', 'Card Payments', 'مدفوعات البطاقات', 'card_payments', 0, 'AED', TRUE)`,
];

async function runMigration() {
  console.log('🚀 Starting Neon PostgreSQL Migration...\n');
  
  const sql = neon(DATABASE_URL);
  
  try {
    // Test connection
    console.log('📡 Testing database connection...');
    const result = await sql`SELECT NOW() as current_time, current_database() as db`;
    console.log(`✅ Connected to: ${result[0].db}`);
    console.log(`   Server time: ${result[0].current_time}\n`);
    
    console.log(`📊 Running ${migrationStatements.length} migration statements...\n`);
    
    let successCount = 0;
    let errorCount = 0;
    
    for (let i = 0; i < migrationStatements.length; i++) {
      const statement = migrationStatements[i];
      const preview = statement.substring(0, 50).replace(/\n/g, ' ').trim();
      
      try {
        await sql.unsafe(statement);
        successCount++;
        if (i < 55 || i % 5 === 0 || i >= migrationStatements.length - 10) {
          console.log(`✅ [${i + 1}/${migrationStatements.length}] ${preview}...`);
        }
      } catch (error: any) {
        errorCount++;
        console.error(`❌ [${i + 1}/${migrationStatements.length}] ${preview}...`);
        console.error(`   Error: ${error.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(50));
    console.log(`📊 Migration Summary:`);
    console.log(`   ✅ Successful: ${successCount}`);
    console.log(`   ❌ Failed: ${errorCount}`);
    console.log('='.repeat(50) + '\n');
    
    // Verify tables were created
    console.log('🔍 Verifying tables...');
    const tables = await sql`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `;
    
    console.log(`✅ Found ${tables.length} tables:\n`);
    tables.forEach((t, i) => {
      console.log(`   ${i + 1}. ${t.table_name}`);
    });
    
    if (tables.length > 0) {
      // Verify default data
      console.log('\n🔍 Verifying default data...');
      try {
        const users = await sql`SELECT COUNT(*) as count FROM users`;
        const categories = await sql`SELECT COUNT(*) as count FROM product_categories`;
        const settings = await sql`SELECT COUNT(*) as count FROM app_settings`;
        
        console.log(`   Users: ${users[0].count}`);
        console.log(`   Categories: ${categories[0].count}`);
        console.log(`   App Settings: ${settings[0].count}`);
      } catch (e: any) {
        console.log(`   Could not verify data: ${e.message}`);
      }
      
      console.log('\n🎉 Migration completed successfully!');
    }
    
    console.log('\n📝 Next steps:');
    console.log('   1. Set DATABASE_URL in Netlify environment variables');
    console.log('   2. Deploy: netlify deploy --prod');
    
  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message || error);
    process.exit(1);
  }
}

// Run migration
runMigration();
