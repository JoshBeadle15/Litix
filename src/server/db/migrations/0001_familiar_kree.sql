CREATE TYPE "public"."role" AS ENUM('admin', 'member');--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "role" "role" DEFAULT 'member' NOT NULL;--> statement-breakpoint
ALTER TABLE "employees" ADD COLUMN "password_hash" text;