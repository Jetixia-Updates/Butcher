CREATE TYPE "public"."customer_segment" AS ENUM('regular', 'premium', 'vip', 'wholesale', 'inactive');--> statement-breakpoint
CREATE TYPE "public"."report_format" AS ENUM('pdf', 'excel', 'csv', 'json');--> statement-breakpoint
CREATE TYPE "public"."report_status" AS ENUM('pending', 'generating', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."report_type" AS ENUM('sales', 'revenue', 'orders', 'products', 'customers', 'inventory', 'expenses', 'profit_loss', 'vat', 'delivery', 'staff_performance', 'custom');--> statement-breakpoint
CREATE TABLE "customers" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"customer_number" varchar(20) NOT NULL,
	"segment" "customer_segment" DEFAULT 'regular' NOT NULL,
	"credit_limit" numeric(12, 2) DEFAULT '0' NOT NULL,
	"current_balance" numeric(12, 2) DEFAULT '0' NOT NULL,
	"lifetime_value" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_orders" integer DEFAULT 0 NOT NULL,
	"total_spent" numeric(14, 2) DEFAULT '0' NOT NULL,
	"average_order_value" numeric(10, 2) DEFAULT '0' NOT NULL,
	"last_order_date" timestamp,
	"last_order_amount" numeric(10, 2),
	"preferred_payment_method" "payment_method",
	"preferred_delivery_time" varchar(50),
	"dietary_preferences" jsonb,
	"allergies" jsonb,
	"preferred_language" "language" DEFAULT 'en',
	"marketing_opt_in" boolean DEFAULT true NOT NULL,
	"sms_opt_in" boolean DEFAULT true NOT NULL,
	"email_opt_in" boolean DEFAULT true NOT NULL,
	"internal_notes" text,
	"tags" jsonb,
	"referred_by" text,
	"referral_count" integer DEFAULT 0 NOT NULL,
	"first_purchase_date" timestamp,
	"birth_date" timestamp,
	"anniversary" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "customers_user_id_unique" UNIQUE("user_id"),
	CONSTRAINT "customers_customer_number_unique" UNIQUE("customer_number")
);
--> statement-breakpoint
CREATE TABLE "reports" (
	"id" text PRIMARY KEY NOT NULL,
	"report_number" varchar(20) NOT NULL,
	"name" varchar(200) NOT NULL,
	"name_ar" varchar(200),
	"type" "report_type" NOT NULL,
	"description" text,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"filters" jsonb,
	"format" "report_format" DEFAULT 'pdf' NOT NULL,
	"status" "report_status" DEFAULT 'pending' NOT NULL,
	"file_url" text,
	"file_size" integer,
	"summary" jsonb,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_frequency" varchar(20),
	"next_run_at" timestamp,
	"last_run_at" timestamp,
	"recipients" jsonb,
	"generated_at" timestamp,
	"generated_by" text NOT NULL,
	"generated_by_name" varchar(100),
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "reports_report_number_unique" UNIQUE("report_number")
);
--> statement-breakpoint
ALTER TABLE "customers" ADD CONSTRAINT "customers_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;