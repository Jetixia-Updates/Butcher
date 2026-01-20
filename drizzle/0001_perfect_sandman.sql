CREATE TYPE "public"."account_class" AS ENUM('asset', 'liability', 'equity', 'revenue', 'expense');--> statement-breakpoint
CREATE TYPE "public"."approval_status" AS ENUM('draft', 'pending_approval', 'approved', 'rejected', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."expense_function" AS ENUM('cost_of_sales', 'selling', 'administrative', 'finance', 'other_operating');--> statement-breakpoint
CREATE TYPE "public"."journal_entry_status" AS ENUM('draft', 'posted', 'reversed');--> statement-breakpoint
CREATE TYPE "public"."loyalty_transaction_type" AS ENUM('earn', 'redeem', 'bonus', 'expire');--> statement-breakpoint
CREATE TYPE "public"."supplier_payment_terms" AS ENUM('net_7', 'net_15', 'net_30', 'net_60', 'cod', 'prepaid');--> statement-breakpoint
CREATE TYPE "public"."vat_return_status" AS ENUM('draft', 'submitted', 'accepted', 'rejected', 'amended');--> statement-breakpoint
CREATE TYPE "public"."wallet_transaction_type" AS ENUM('credit', 'debit', 'refund', 'topup', 'cashback');--> statement-breakpoint
ALTER TYPE "public"."expense_status" ADD VALUE 'approved' BEFORE 'paid';--> statement-breakpoint
ALTER TYPE "public"."expense_status" ADD VALUE 'reimbursed';--> statement-breakpoint
CREATE TABLE "app_settings" (
	"id" text PRIMARY KEY DEFAULT 'default' NOT NULL,
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
	"tax_registration_number" varchar(20),
	"trade_license_number" varchar(50),
	"company_name_en" varchar(200) DEFAULT 'Al Jazira Butcher Shop',
	"company_name_ar" varchar(200) DEFAULT 'ملحمة الجزيرة',
	"fiscal_year_start" varchar(5) DEFAULT '01-01',
	"fiscal_year_end" varchar(5) DEFAULT '12-31',
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_log" (
	"id" text PRIMARY KEY NOT NULL,
	"entity_type" varchar(50) NOT NULL,
	"entity_id" text NOT NULL,
	"action" varchar(20) NOT NULL,
	"previous_value" jsonb,
	"new_value" jsonb,
	"changed_fields" jsonb,
	"user_id" text NOT NULL,
	"user_name" varchar(100),
	"ip_address" varchar(45),
	"user_agent" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "banners" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "chart_of_accounts" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(10) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"account_class" "account_class" NOT NULL,
	"parent_id" text,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"is_system_account" boolean DEFAULT false NOT NULL,
	"balance" numeric(14, 2) DEFAULT '0' NOT NULL,
	"normal_balance" varchar(10) DEFAULT 'debit' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "chart_of_accounts_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "chat_messages" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"user_name" varchar(200) NOT NULL,
	"user_email" varchar(255) NOT NULL,
	"text" text NOT NULL,
	"sender" varchar(10) NOT NULL,
	"attachments" jsonb,
	"read_by_admin" boolean DEFAULT false NOT NULL,
	"read_by_user" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cost_centers" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(100) NOT NULL,
	"name_ar" varchar(100),
	"description" text,
	"parent_id" text,
	"manager_id" text,
	"is_active" boolean DEFAULT true,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cost_centers_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "delivery_time_slots" (
	"id" text PRIMARY KEY NOT NULL,
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
CREATE TABLE "expense_approval_rules" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"min_amount" numeric(10, 2) DEFAULT '0',
	"max_amount" numeric(10, 2),
	"category" varchar(50),
	"cost_center_id" text,
	"approver_level" integer DEFAULT 1 NOT NULL,
	"approver_id" text,
	"approver_role" varchar(50),
	"requires_all_approvers" boolean DEFAULT false,
	"auto_approve_below" numeric(10, 2),
	"is_active" boolean DEFAULT true,
	"priority" integer DEFAULT 0,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "expense_budgets" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(100) NOT NULL,
	"period_type" varchar(20) NOT NULL,
	"start_date" timestamp NOT NULL,
	"end_date" timestamp NOT NULL,
	"category" varchar(50),
	"cost_center_id" text,
	"department_id" text,
	"budget_amount" numeric(12, 2) NOT NULL,
	"spent_amount" numeric(12, 2) DEFAULT '0',
	"remaining_amount" numeric(12, 2),
	"alert_threshold" integer DEFAULT 80,
	"is_alert_sent" boolean DEFAULT false,
	"is_active" boolean DEFAULT true,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "in_app_notifications" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" varchar(50) NOT NULL,
	"title" varchar(200) NOT NULL,
	"title_ar" varchar(200) NOT NULL,
	"message" text NOT NULL,
	"message_ar" text NOT NULL,
	"link" text,
	"link_tab" varchar(50),
	"link_id" text,
	"unread" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entries" (
	"id" text PRIMARY KEY NOT NULL,
	"entry_number" varchar(20) NOT NULL,
	"entry_date" timestamp NOT NULL,
	"description" text NOT NULL,
	"description_ar" text,
	"reference" varchar(100),
	"reference_type" varchar(50),
	"reference_id" text,
	"status" "journal_entry_status" DEFAULT 'draft' NOT NULL,
	"total_debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"created_by" text NOT NULL,
	"approved_by" text,
	"posted_at" timestamp,
	"reversed_at" timestamp,
	"reversal_entry_id" text,
	"notes" text,
	"attachments" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "journal_entries_entry_number_unique" UNIQUE("entry_number")
);
--> statement-breakpoint
CREATE TABLE "journal_entry_lines" (
	"id" text PRIMARY KEY NOT NULL,
	"journal_entry_id" text NOT NULL,
	"account_id" text NOT NULL,
	"account_code" varchar(10) NOT NULL,
	"account_name" varchar(100) NOT NULL,
	"debit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"credit" numeric(14, 2) DEFAULT '0' NOT NULL,
	"description" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_points" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"points" integer DEFAULT 0 NOT NULL,
	"total_earned" integer DEFAULT 0 NOT NULL,
	"referral_code" varchar(20),
	"referred_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "loyalty_points_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "loyalty_points_referral_code_unique" UNIQUE("referral_code")
);
--> statement-breakpoint
CREATE TABLE "loyalty_tiers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(50) NOT NULL,
	"name_ar" varchar(50) NOT NULL,
	"min_points" integer NOT NULL,
	"multiplier" numeric(3, 1) DEFAULT '1' NOT NULL,
	"benefits" jsonb NOT NULL,
	"benefits_ar" jsonb NOT NULL,
	"icon" varchar(10) NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "loyalty_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "loyalty_transaction_type" NOT NULL,
	"points" integer NOT NULL,
	"description" text NOT NULL,
	"order_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "product_reviews" (
	"id" text PRIMARY KEY NOT NULL,
	"product_id" text NOT NULL,
	"user_id" text NOT NULL,
	"user_name" varchar(200) NOT NULL,
	"rating" integer NOT NULL,
	"title" varchar(200) NOT NULL,
	"comment" text NOT NULL,
	"images" jsonb,
	"is_verified_purchase" boolean DEFAULT false NOT NULL,
	"helpful_count" integer DEFAULT 0 NOT NULL,
	"is_approved" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vat_returns" (
	"id" text PRIMARY KEY NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"due_date" timestamp NOT NULL,
	"box1_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box1_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box2_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box2_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box3_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box3_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box4_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box4_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box5_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box5_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box6_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box6_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box7_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box7_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box8_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box9_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"box10_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_sales_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_purchases_vat" numeric(14, 2) DEFAULT '0' NOT NULL,
	"net_vat_due" numeric(14, 2) DEFAULT '0' NOT NULL,
	"status" "vat_return_status" DEFAULT 'draft' NOT NULL,
	"submitted_at" timestamp,
	"submitted_by" text,
	"fta_reference_number" varchar(50),
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "vendors" (
	"id" text PRIMARY KEY NOT NULL,
	"code" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"email" varchar(255),
	"phone" varchar(20),
	"mobile" varchar(20),
	"website" varchar(255),
	"address" text,
	"city" varchar(100),
	"emirate" varchar(50),
	"country" varchar(100) DEFAULT 'UAE',
	"trn" varchar(20),
	"trade_license" varchar(50),
	"default_payment_terms" varchar(20) DEFAULT 'net_30',
	"bank_name" varchar(100),
	"bank_account_number" varchar(50),
	"bank_iban" varchar(50),
	"bank_swift" varchar(20),
	"category" varchar(50),
	"expense_categories" jsonb,
	"opening_balance" numeric(12, 2) DEFAULT '0',
	"current_balance" numeric(12, 2) DEFAULT '0',
	"is_active" boolean DEFAULT true,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "vendors_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "wallet_transactions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"type" "wallet_transaction_type" NOT NULL,
	"amount" numeric(10, 2) NOT NULL,
	"description" text NOT NULL,
	"description_ar" text NOT NULL,
	"reference" varchar(100),
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wallets" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wallets_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint
CREATE TABLE "wishlists" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product_id" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "finance_expenses" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
ALTER TABLE "finance_transactions" ALTER COLUMN "category" SET DATA TYPE text;--> statement-breakpoint
DROP TYPE "public"."expense_category";--> statement-breakpoint
CREATE TYPE "public"."expense_category" AS ENUM('inventory', 'direct_labor', 'freight_in', 'marketing', 'delivery', 'sales_commission', 'salaries', 'rent', 'utilities', 'office_supplies', 'insurance', 'professional_fees', 'licenses_permits', 'bank_charges', 'equipment', 'maintenance', 'depreciation', 'amortization', 'interest_expense', 'finance_charges', 'taxes', 'government_fees', 'employee_benefits', 'training', 'travel', 'meals_entertainment', 'other');--> statement-breakpoint
ALTER TABLE "finance_expenses" ALTER COLUMN "category" SET DATA TYPE "public"."expense_category" USING "category"::"public"."expense_category";--> statement-breakpoint
ALTER TABLE "finance_transactions" ALTER COLUMN "category" SET DATA TYPE "public"."expense_category" USING "category"::"public"."expense_category";--> statement-breakpoint
DROP TYPE "public"."payment_terms";--> statement-breakpoint
CREATE TYPE "public"."payment_terms" AS ENUM('immediate', 'net_7', 'net_15', 'net_30', 'net_45', 'net_60', 'net_90', 'eom', 'custom');--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "payment_terms" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "payment_terms" SET DATA TYPE "public"."supplier_payment_terms" USING "payment_terms"::text::"public"."supplier_payment_terms";--> statement-breakpoint
ALTER TABLE "suppliers" ALTER COLUMN "payment_terms" SET DEFAULT 'net_30';--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "express_enabled" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "express_fee" numeric(10, 2) DEFAULT '25' NOT NULL;--> statement-breakpoint
ALTER TABLE "delivery_zones" ADD COLUMN "express_hours" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "expense_number" varchar(50) NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "function" varchar(50) DEFAULT 'administrative';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "gross_amount" numeric(10, 2) NOT NULL;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "vat_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "vat_rate" numeric(5, 2) DEFAULT '5';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "is_vat_recoverable" boolean DEFAULT true;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "withholding_tax" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "exchange_rate" numeric(10, 6) DEFAULT '1';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "base_currency_amount" numeric(10, 2);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "vendor_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "vendor_trn" varchar(20);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "received_date" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "payment_terms" varchar(20) DEFAULT 'net_30';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "early_payment_discount" numeric(5, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "early_payment_days" integer DEFAULT 0;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "paid_amount" numeric(10, 2) DEFAULT '0';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "payment_reference" varchar(100);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "payment_method" varchar(50);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "approval_status" varchar(20) DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "cost_center_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "cost_center_name" varchar(100);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "project_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "project_name" varchar(100);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "department_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "department_name" varchar(100);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "gl_account_code" varchar(20);--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "journal_entry_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "submitted_by" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "submitted_at" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "approved_at" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "rejected_by" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "rejected_at" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "rejection_reason" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "is_reimbursement" boolean DEFAULT false;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "employee_id" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "reimbursed_at" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "internal_notes" text;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "recurring_end_date" timestamp;--> statement-breakpoint
ALTER TABLE "finance_expenses" ADD COLUMN "parent_expense_id" text;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "discount" numeric(5, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "is_premium" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "rating" numeric(3, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "products" ADD COLUMN "badges" jsonb DEFAULT '[]'::jsonb;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journal_entry_id_journal_entries_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entries"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_account_id_chart_of_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."chart_of_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_points" ADD CONSTRAINT "loyalty_points_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "loyalty_transactions" ADD CONSTRAINT "loyalty_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product_reviews" ADD CONSTRAINT "product_reviews_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallet_transactions" ADD CONSTRAINT "wallet_transactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wallets" ADD CONSTRAINT "wallets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlists" ADD CONSTRAINT "wishlists_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;