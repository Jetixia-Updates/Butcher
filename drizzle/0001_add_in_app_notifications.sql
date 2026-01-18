-- Add in_app_notifications table for real-time notification sync across devices
CREATE TABLE IF NOT EXISTS "in_app_notifications" (
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

-- Create index on user_id for faster queries
CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_user_id" ON "in_app_notifications" ("user_id");

-- Create index on created_at for sorting
CREATE INDEX IF NOT EXISTS "idx_in_app_notifications_created_at" ON "in_app_notifications" ("created_at" DESC);
