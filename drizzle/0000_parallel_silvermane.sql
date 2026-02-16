CREATE TYPE "public"."currency" AS ENUM('AED', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."delivery_tracking_status" AS ENUM('assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'approved', 'paid', 'overdue', 'cancelled', 'reimbursed');--> statement-breakpoint
CREATE TYPE "public"."finance_account_type" AS ENUM('cash', 'bank', 'card_payments', 'cod_collections', 'petty_cash');--> statement-breakpoint
CREATE TYPE "public"."finance_transaction_status" AS ENUM('pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."finance_transaction_type" AS ENUM('sale', 'refund', 'expense', 'purchase', 'adjustment', 'payout');--> statement-breakpoint
CREATE TYPE "public"."loyalty_transaction_type" AS ENUM('earn', 'redeem', 'bonus', 'expire');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_placed', 'order_confirmed', 'order_processing', 'order_ready', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_received', 'payment_failed', 'refund_processed', 'low_stock', 'promotional', 'customer_welcome');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'cod', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('in', 'out', 'adjustment', 'reserved', 'released');--> statement-breakpoint
CREATE TYPE "public"."supplier_payment_terms" AS ENUM('net_7', 'net_15', 'net_30', 'net_60', 'cod', 'prepaid');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'inactive', 'pending', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('kg', 'piece', 'gram');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin', 'staff', 'delivery');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit', 'refund', 'topup', 'cashback');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"label" varchar(50) NOT NULL,
	"full_name" varchar(200) NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"emirate" varchar(100) NOT NULL,
	"area" varchar(200) NOT NULL,
	"street" text NOT NULL,
	"building" varchar(200) NOT NULL,
	"floor" varchar(20),
	"apartment" varchar(50),
	"landmark" text,
	"latitude" double precision,
	"longitude" double precision,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" varchar(100) PRIMARY KEY DEFAULT 'default' NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.05' NOT NULL,
	"delivery_fee" numeric(10, 2) DEFAULT '15' NOT NULL,
	"free_delivery_threshold" numeric(10, 2) DEFAULT '200' NOT NULL,
	"express_delivery_fee" numeric(10, 2) DEFAULT '25' NOT NULL,
	"minimum_order_amount" numeric(10, 2) DEFAULT '50' NOT NULL,
	"max_orders_per_day" integer DEFAULT 100 NOT NULL,
	"enable_cash_on_delivery" boolean DEFAULT true NOT NULL,
	"enable_card_payment" boolean DEFAULT true NOT NULL,
	"enable_wallet" boolean DEFAULT true NOT NULL,
	"enable_loyalty" boolean DEFAULT true NOT NULL,
	"enable_reviews" boolean DEFAULT true NOT NULL,
	"enable_wishlist" boolean DEFAULT true NOT NULL,
	"enable_express_delivery" boolean DEFAULT true NOT NULL,
	"enable_scheduled_delivery" boolean DEFAULT true NOT NULL,
	"enable_welcome_bonus" boolean DEFAULT true NOT NULL,
	"welcome_bonus" numeric(10, 2) DEFAULT '50' NOT NULL,
	"cashback_percentage" numeric(5, 2) DEFAULT '2' NOT NULL,
	"loyalty_points_per_aed" numeric(5, 2) DEFAULT '1' NOT NULL,
	"loyalty_point_value" numeric(5, 4) DEFAULT '0.1' NOT NULL,
	"store_phone" varchar(20) DEFAULT '+971 4 123 4567',
	"store_email" varchar(255) DEFAULT 'support@aljazirabutcher.ae',
	"store_address" text,
	"store_address_ar" text,
	"working_hours_start" varchar(10) DEFAULT '08:00',
	"working_hours_end" varchar(10) DEFAULT '22:00',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"title_en" varchar(200) NOT NULL,
	"title_ar" varchar(200) NOT NULL,
	"subtitle_en" text,
	"subtitle_ar" text,
	"image" text,
	"bg_color" varchar(100) DEFAULT 'from-red-800 to-red-900' NOT NULL,
	"link" text,
	"badge" varchar(50),
	"badge_ar" varchar(50),
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"user_name" varchar(200) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"sender" varchar(10) NOT NULL,
	"attachments" json,
	"read_by_admin" boolean DEFAULT false NOT NULL,
	"read_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_time_slots" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"label" varchar(100) NOT NULL,
	"label_ar" varchar(100) NOT NULL,
	"start_time" varchar(10) NOT NULL,
	"end_time" varchar(10) NOT NULL,
	"is_express_slot" boolean DEFAULT false NOT NULL,
	"max_orders" integer DEFAULT 20 NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_tracking" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"driver_id" varchar(100),
	"driver_name" varchar(200),
	"driver_mobile" varchar(20),
	"status" "delivery_tracking_status" DEFAULT 'assigned' NOT NULL,
	"current_location" json,
	"estimated_arrival" timestamp,
	"actual_arrival" timestamp,
	"delivery_proof" json,
	"timeline" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"emirate" varchar(100) NOT NULL,
	"areas" json NOT NULL,
	"delivery_fee" numeric(10, 2) NOT NULL,
	"minimum_order" numeric(10, 2) NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"express_enabled" boolean DEFAULT false NOT NULL,
	"express_fee" numeric(10, 2) DEFAULT '25' NOT NULL,
	"express_hours" integer DEFAULT 1 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"code" varchar(50) NOT NULL,
	"type" "discount_type" NOT NULL,
	"value" numeric(10, 2) NOT NULL,
	"minimum_order" numeric(10, 2) DEFAULT '0' NOT NULL,
	"maximum_discount" numeric(10, 2),
	"usage_limit" integer DEFAULT 0 NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"user_limit" integer DEFAULT 1 NOT NULL,
	"valid_from" timestamp NOT NULL,
	"valid_to" timestamp NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"applicable_products" json,
	"applicable_categories" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "finance_accounts" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"type" "finance_account_type" NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"bank_name" varchar(100),
	"account_number" varchar(50),
	"iban" varchar(50),
	"last_reconciled" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_expenses" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"expense_number" varchar(50) NOT NULL,
	"category" varchar(50) NOT NULL,
	"function" varchar(50) DEFAULT 'administrative',
	"gross_amount" numeric(10, 2) NOT NULL,
	"vat_amount" numeric(10, 2) DEFAULT '0',
	"vat_rate" numeric(5, 2) DEFAULT '5',
	"is_vat_recoverable" boolean DEFAULT true,
	"withholding_tax" numeric(10, 2) DEFAULT '0',
	"amount" numeric(10, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"exchange_rate" numeric(10, 6) DEFAULT '1',
	"base_currency_amount" numeric(10, 2),
	"description" text NOT NULL,
	"description_ar" text,
	"vendor_id" varchar(100),
	"vendor" varchar(200),
	"vendor_trn" varchar(20),
	"invoice_number" varchar(100),
	"invoice_date" timestamp,
	"received_date" timestamp,
	"payment_terms" varchar(20) DEFAULT 'net_30',
	"due_date" timestamp,
	"early_payment_discount" numeric(5, 2) DEFAULT '0',
	"early_payment_days" integer DEFAULT 0,
	"paid_at" timestamp,
	"paid_amount" numeric(10, 2) DEFAULT '0',
	"payment_reference" varchar(100),
	"payment_method" varchar(50),
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"approval_status" varchar(20) DEFAULT 'draft',
	"cost_center_id" varchar(100),
	"cost_center_name" varchar(100),
	"project_id" varchar(100),
	"project_name" varchar(100),
	"department_id" varchar(100),
	"department_name" varchar(100),
	"account_id" varchar(100),
	"gl_account_code" varchar(20),
	"journal_entry_id" varchar(100),
	"created_by" varchar(100) NOT NULL,
	"submitted_by" varchar(100),
	"submitted_at" timestamp,
	"approved_by" varchar(100),
	"approved_at" timestamp,
	"rejected_by" varchar(100),
	"rejected_at" timestamp,
	"rejection_reason" text,
	"is_reimbursement" boolean DEFAULT false,
	"employee_id" varchar(100),
	"reimbursed_at" timestamp,
	"attachments" json,
	"notes" text,
	"internal_notes" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_frequency" varchar(20),
	"recurring_end_date" timestamp,
	"parent_expense_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"type" "finance_transaction_type" NOT NULL,
	"status" "finance_transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"category" varchar(50),
	"reference" varchar(100),
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"account_id" varchar(100) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"created_by" varchar(100) NOT NULL,
	"notes" text,
	"attachments" json,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"title_ar" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"message_ar" text NOT NULL,
	"link" text,
	"link_tab" varchar(50),
	"link_id" varchar(100),
	"unread" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_points" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"referral_code" varchar(20),
	"referred_by" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_points_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "loyalty_points_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "loyalty_tiers" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"name_ar" varchar(50) NOT NULL,
	"min_points" integer NOT NULL,
	"multiplier" numeric(3, 1) DEFAULT '1' NOT NULL,
	"benefits" json NOT NULL,
	"benefits_ar" json NOT NULL,
	"icon" varchar(10) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"type" "loyalty_transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"description" text NOT NULL,
	"order_id" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"message_ar" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"metadata" json,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"product_name_ar" varchar(200),
	"sku" varchar(50) NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"unit_price" numeric(10, 2) NOT NULL,
	"total_price" numeric(10, 2) NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"customer_name" varchar(200) NOT NULL,
	"customer_email" varchar(255) NOT NULL,
	"customer_mobile" varchar(20) NOT NULL,
	"subtotal" numeric(10, 2) NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount_code" varchar(50),
	"delivery_fee" numeric(10, 2) DEFAULT '0' NOT NULL,
	"vat_amount" numeric(10, 2) NOT NULL,
	"vat_rate" numeric(5, 4) DEFAULT '0.05' NOT NULL,
	"total" numeric(10, 2) NOT NULL,
	"status" "order_status" DEFAULT 'pending' NOT NULL,
	"payment_status" "payment_status" DEFAULT 'pending' NOT NULL,
	"payment_method" "payment_method" NOT NULL,
	"address_id" varchar(100) NOT NULL,
	"delivery_address" json NOT NULL,
	"delivery_notes" text,
	"delivery_zone_id" varchar(100),
	"estimated_delivery_at" timestamp,
	"actual_delivery_at" timestamp,
	"status_history" json DEFAULT '[]'::json,
	"source" varchar(20) DEFAULT 'web' NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"order_id" varchar(100) NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"method" "payment_method" NOT NULL,
	"status" "payment_status" DEFAULT 'pending' NOT NULL,
	"card_brand" varchar(50),
	"card_last4" varchar(4),
	"card_expiry_month" integer,
	"card_expiry_year" integer,
	"gateway_transaction_id" text,
	"gateway_response" text,
	"refunded_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"refunds" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_categories" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name_en" varchar(100) NOT NULL,
	"name_ar" varchar(100) NOT NULL,
	"icon" varchar(50),
	"color" varchar(100),
	"sort_order" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"user_name" varchar(200) NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"comment" text NOT NULL,
	"images" json,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"sku" varchar(50) NOT NULL,
	"barcode" varchar(100),
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"discount" numeric(5, 2) DEFAULT '0' NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"description_ar" text,
	"image" text,
	"unit" "unit" DEFAULT 'kg' NOT NULL,
	"min_order_quantity" numeric(10, 2) DEFAULT '0.25' NOT NULL,
	"max_order_quantity" numeric(10, 2) DEFAULT '10' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"is_premium" boolean DEFAULT false NOT NULL,
	"rating" numeric(3, 2) DEFAULT '0' NOT NULL,
	"tags" json DEFAULT '[]'::json,
	"badges" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"purchase_order_id" varchar(100) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"supplier_sku" varchar(100),
	"quantity" numeric(10, 2) NOT NULL,
	"unit_cost" numeric(10, 2) NOT NULL,
	"total_cost" numeric(10, 2) NOT NULL,
	"received_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "purchase_orders" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"supplier_id" varchar(100) NOT NULL,
	"supplier_name" varchar(200) NOT NULL,
	"subtotal" numeric(12, 2) NOT NULL,
	"tax_amount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"tax_rate" numeric(5, 4) DEFAULT '0.05' NOT NULL,
	"shipping_cost" numeric(10, 2) DEFAULT '0' NOT NULL,
	"discount" numeric(10, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"status" "purchase_order_status" DEFAULT 'draft' NOT NULL,
	"payment_status" varchar(20) DEFAULT 'pending' NOT NULL,
	"order_date" timestamp DEFAULT now() NOT NULL,
	"expected_delivery_date" timestamp NOT NULL,
	"actual_delivery_date" timestamp,
	"delivery_address" text NOT NULL,
	"delivery_notes" text,
	"tracking_number" varchar(100),
	"created_by" varchar(100) NOT NULL,
	"approved_by" varchar(100),
	"approved_at" timestamp,
	"internal_notes" text,
	"supplier_notes" text,
	"status_history" json DEFAULT '[]'::json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"brand" varchar(50) NOT NULL,
	"last4" varchar(4) NOT NULL,
	"expiry_month" integer NOT NULL,
	"expiry_year" integer NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"reserved_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"available_quantity" numeric(10, 2) DEFAULT '0' NOT NULL,
	"low_stock_threshold" integer DEFAULT 5 NOT NULL,
	"reorder_point" integer DEFAULT 10 NOT NULL,
	"reorder_quantity" integer DEFAULT 20 NOT NULL,
	"last_restocked_at" timestamp,
	"expiry_date" timestamp,
	"batch_number" varchar(100),
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "stock_product_id_unique" UNIQUE("product_id")
);
--> statement-breakpoint
CREATE TABLE "stock_movements" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"previous_quantity" numeric(10, 2) NOT NULL,
	"new_quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" varchar(100),
	"performed_by" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"supplier_id" varchar(100) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"product_name" varchar(200) NOT NULL,
	"supplier_sku" varchar(100),
	"unit_cost" numeric(10, 2) NOT NULL,
	"minimum_order_quantity" integer DEFAULT 1 NOT NULL,
	"lead_time_days" integer DEFAULT 7 NOT NULL,
	"is_preferred" boolean DEFAULT false NOT NULL,
	"last_purchase_price" numeric(10, 2),
	"last_purchase_date" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "suppliers" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"website" text,
	"tax_number" varchar(50),
	"address" json NOT NULL,
	"contacts" json DEFAULT '[]'::json,
	"payment_terms" "supplier_payment_terms" DEFAULT 'net_30' NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"categories" json DEFAULT '[]'::json,
	"rating" numeric(3, 2) DEFAULT '0',
	"on_time_delivery_rate" numeric(5, 2) DEFAULT '0',
	"quality_score" numeric(5, 2) DEFAULT '0',
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(12, 2) DEFAULT '0' NOT NULL,
	"status" "supplier_status" DEFAULT 'active' NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_order_at" timestamp,
	CONSTRAINT "suppliers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"username" varchar(100) NOT NULL,
	"email" varchar(255) NOT NULL,
	"mobile" varchar(20) NOT NULL,
	"password" text NOT NULL,
	"first_name" varchar(100) NOT NULL,
	"family_name" varchar(100) NOT NULL,
	"role" "user_role" DEFAULT 'customer' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_verified" boolean DEFAULT false NOT NULL,
	"emirate" varchar(100),
	"address" text,
	"preferences" json,
	"permissions" json,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"description_ar" text NOT NULL,
	"reference" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" varchar(100) PRIMARY KEY NOT NULL,
	"user_id" varchar(100) NOT NULL,
	"product_id" varchar(100) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
