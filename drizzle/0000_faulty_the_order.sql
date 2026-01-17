CREATE TYPE "public"."account_type" AS ENUM('cash', 'bank', 'card_payments', 'cod_collections', 'petty_cash');--> statement-breakpoint
CREATE TYPE "public"."currency" AS ENUM('AED', 'USD', 'EUR');--> statement-breakpoint
CREATE TYPE "public"."delivery_tracking_status" AS ENUM('assigned', 'picked_up', 'in_transit', 'nearby', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."discount_type" AS ENUM('percentage', 'fixed');--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('inventory', 'utilities', 'salaries', 'rent', 'marketing', 'equipment', 'maintenance', 'delivery', 'taxes', 'other');--> statement-breakpoint
CREATE TYPE "public"."expense_status" AS ENUM('pending', 'paid', 'overdue', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."language" AS ENUM('en', 'ar');--> statement-breakpoint
CREATE TYPE "public"."notification_channel" AS ENUM('sms', 'email', 'push');--> statement-breakpoint
CREATE TYPE "public"."notification_status" AS ENUM('pending', 'sent', 'delivered', 'failed');--> statement-breakpoint
CREATE TYPE "public"."notification_type" AS ENUM('order_placed', 'order_confirmed', 'order_processing', 'order_ready', 'order_shipped', 'order_delivered', 'order_cancelled', 'payment_received', 'payment_failed', 'refund_processed', 'low_stock', 'promotional');--> statement-breakpoint
CREATE TYPE "public"."order_status" AS ENUM('pending', 'confirmed', 'processing', 'ready_for_pickup', 'out_for_delivery', 'delivered', 'cancelled', 'refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('card', 'cod', 'bank_transfer');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('pending', 'authorized', 'captured', 'failed', 'refunded', 'partially_refunded');--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('net_7', 'net_15', 'net_30', 'net_60', 'cod', 'prepaid');--> statement-breakpoint
CREATE TYPE "public"."purchase_order_status" AS ENUM('draft', 'pending', 'approved', 'ordered', 'partially_received', 'received', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."stock_movement_type" AS ENUM('in', 'out', 'adjustment', 'reserved', 'released');--> statement-breakpoint
CREATE TYPE "public"."supplier_status" AS ENUM('active', 'inactive', 'pending', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."transaction_status" AS ENUM('pending', 'completed', 'failed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."transaction_type" AS ENUM('sale', 'refund', 'expense', 'purchase', 'adjustment', 'payout');--> statement-breakpoint
CREATE TYPE "public"."unit" AS ENUM('kg', 'piece', 'gram');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('customer', 'admin', 'staff', 'delivery');--> statement-breakpoint
CREATE TABLE "addresses" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
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
	"latitude" real,
	"longitude" real,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_tracking" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"driver_id" text,
	"driver_name" varchar(200),
	"driver_mobile" varchar(20),
	"status" "delivery_tracking_status" DEFAULT 'assigned' NOT NULL,
	"current_location" jsonb,
	"estimated_arrival" timestamp,
	"actual_arrival" timestamp,
	"delivery_proof" jsonb,
	"timeline" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "delivery_zones" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"emirate" varchar(100) NOT NULL,
	"areas" jsonb NOT NULL,
	"delivery_fee" numeric(10, 2) NOT NULL,
	"minimum_order" numeric(10, 2) NOT NULL,
	"estimated_minutes" integer NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE "discount_codes" (
	"id" text PRIMARY KEY NOT NULL,
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
	"applicable_products" jsonb,
	"applicable_categories" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "discount_codes_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "finance_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"type" "account_type" NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"category" "expense_category" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"vendor" varchar(200),
	"invoice_number" varchar(100),
	"invoice_date" timestamp,
	"due_date" timestamp,
	"paid_at" timestamp,
	"status" "expense_status" DEFAULT 'pending' NOT NULL,
	"account_id" text,
	"created_by" text NOT NULL,
	"approved_by" text,
	"attachments" jsonb,
	"notes" text,
	"is_recurring" boolean DEFAULT false NOT NULL,
	"recurring_frequency" varchar(20),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"type" "transaction_type" NOT NULL,
	"status" "transaction_status" DEFAULT 'pending' NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"category" "expense_category",
	"reference" varchar(100),
	"reference_type" varchar(50),
	"reference_id" text,
	"account_id" text NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"created_by" text NOT NULL,
	"notes" text,
	"attachments" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "notification_type" NOT NULL,
	"channel" "notification_channel" NOT NULL,
	"title" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"message_ar" text,
	"status" "notification_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
	"product_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"user_id" text NOT NULL,
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
	"address_id" text NOT NULL,
	"delivery_address" jsonb NOT NULL,
	"delivery_notes" text,
	"delivery_zone_id" text,
	"estimated_delivery_at" timestamp,
	"actual_delivery_at" timestamp,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"source" varchar(20) DEFAULT 'web' NOT NULL,
	"ip_address" varchar(50),
	"user_agent" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"id" text PRIMARY KEY NOT NULL,
	"order_id" text NOT NULL,
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
	"refunds" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"sku" varchar(50) NOT NULL,
	"barcode" varchar(100),
	"price" numeric(10, 2) NOT NULL,
	"cost_price" numeric(10, 2) NOT NULL,
	"category" varchar(100) NOT NULL,
	"description" text,
	"description_ar" text,
	"image" text,
	"unit" "unit" DEFAULT 'kg' NOT NULL,
	"min_order_quantity" numeric(10, 2) DEFAULT '0.25' NOT NULL,
	"max_order_quantity" numeric(10, 2) DEFAULT '10' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_featured" boolean DEFAULT false NOT NULL,
	"tags" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "products_sku_unique" UNIQUE("sku")
);
--> statement-breakpoint
CREATE TABLE "purchase_order_items" (
	"id" text PRIMARY KEY NOT NULL,
	"purchase_order_id" text NOT NULL,
	"product_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"order_number" varchar(50) NOT NULL,
	"supplier_id" text NOT NULL,
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
	"created_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp,
	"internal_notes" text,
	"supplier_notes" text,
	"status_history" jsonb DEFAULT '[]'::jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "purchase_orders_order_number_unique" UNIQUE("order_number")
);
--> statement-breakpoint
CREATE TABLE "saved_cards" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"token" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "stock" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"type" "stock_movement_type" NOT NULL,
	"quantity" numeric(10, 2) NOT NULL,
	"previous_quantity" numeric(10, 2) NOT NULL,
	"new_quantity" numeric(10, 2) NOT NULL,
	"reason" text NOT NULL,
	"reference_type" varchar(50),
	"reference_id" text,
	"performed_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "supplier_products" (
	"id" text PRIMARY KEY NOT NULL,
	"supplier_id" text NOT NULL,
	"product_id" text NOT NULL,
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
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"email" varchar(255) NOT NULL,
	"phone" varchar(20) NOT NULL,
	"website" text,
	"tax_number" varchar(50),
	"address" jsonb NOT NULL,
	"contacts" jsonb DEFAULT '[]'::jsonb,
	"payment_terms" "payment_terms" DEFAULT 'net_30' NOT NULL,
	"currency" "currency" DEFAULT 'AED' NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"categories" jsonb DEFAULT '[]'::jsonb,
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
	"id" text PRIMARY KEY NOT NULL,
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
	"preferences" jsonb,
	"permissions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"last_login_at" timestamp,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "addresses" ADD CONSTRAINT "addresses_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "delivery_tracking" ADD CONSTRAINT "delivery_tracking_driver_id_users_id_fk" FOREIGN KEY ("driver_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD CONSTRAINT "finance_expenses_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_transactions" ADD CONSTRAINT "finance_transactions_account_id_finance_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."finance_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "order_items" ADD CONSTRAINT "order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payments" ADD CONSTRAINT "payments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_purchase_order_id_purchase_orders_id_fk" FOREIGN KEY ("purchase_order_id") REFERENCES "public"."purchase_orders"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_order_items" ADD CONSTRAINT "purchase_order_items_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "purchase_orders" ADD CONSTRAINT "purchase_orders_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_cards" ADD CONSTRAINT "saved_cards_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock" ADD CONSTRAINT "stock_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_supplier_id_suppliers_id_fk" FOREIGN KEY ("supplier_id") REFERENCES "public"."suppliers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "supplier_products" ADD CONSTRAINT "supplier_products_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;