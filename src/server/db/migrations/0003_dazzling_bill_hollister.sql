CREATE TYPE "public"."board_kind" AS ENUM('marketing', 'ticketing');--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "kind" "board_kind" DEFAULT 'ticketing' NOT NULL;--> statement-breakpoint
ALTER TABLE "boards" ADD COLUMN "department_id" uuid;--> statement-breakpoint
ALTER TABLE "boards" ADD CONSTRAINT "boards_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE set null ON UPDATE no action;