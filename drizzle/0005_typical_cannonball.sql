CREATE TYPE "public"."content_type_status" AS ENUM('draft', 'active', 'deprecated');--> statement-breakpoint
CREATE TYPE "public"."entry_status" AS ENUM('draft', 'published', 'archived');--> statement-breakpoint
CREATE TYPE "public"."schema_migration_status" AS ENUM('pending', 'done', 'error');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('owner', 'admin', 'member');--> statement-breakpoint
CREATE TABLE "cms_media" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"slug" varchar(255) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"media_asset_id" uuid,
	"url" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "content_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"status" "content_type_status" DEFAULT 'draft',
	"schema" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"content_type_id" uuid NOT NULL,
	"slug" varchar(255) NOT NULL,
	"status" "entry_status" DEFAULT 'draft',
	"data" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "entry_relations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"entry_id" uuid NOT NULL,
	"type" varchar(100) NOT NULL,
	"value" varchar(512) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "schema_migrations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" text,
	"content_type_id" uuid NOT NULL,
	"from_version" integer NOT NULL,
	"to_version" integer NOT NULL,
	"changes" jsonb NOT NULL,
	"status" "schema_migration_status" DEFAULT 'pending',
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invitation" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DEFAULT 'member'::"public"."member_role";--> statement-breakpoint
ALTER TABLE "member" ALTER COLUMN "role" SET DATA TYPE "public"."member_role" USING "role"::"public"."member_role";--> statement-breakpoint
ALTER TABLE "cms_media" ADD CONSTRAINT "cms_media_media_asset_id_media_assets_id_fk" FOREIGN KEY ("media_asset_id") REFERENCES "public"."media_assets"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entries" ADD CONSTRAINT "entries_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "entry_relations" ADD CONSTRAINT "entry_relations_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "schema_migrations" ADD CONSTRAINT "schema_migrations_content_type_id_content_types_id_fk" FOREIGN KEY ("content_type_id") REFERENCES "public"."content_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cms_media_org_slug_uidx" ON "cms_media" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "cms_media_org_idx" ON "cms_media" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "cms_media_mime_type_idx" ON "cms_media" USING btree ("mime_type");--> statement-breakpoint
CREATE UNIQUE INDEX "content_types_org_slug_uidx" ON "content_types" USING btree ("organization_id","slug");--> statement-breakpoint
CREATE INDEX "content_types_org_idx" ON "content_types" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "content_types_org_name_idx" ON "content_types" USING btree ("organization_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "entries_org_ct_slug_uidx" ON "entries" USING btree ("organization_id","content_type_id","slug");--> statement-breakpoint
CREATE INDEX "entries_org_idx" ON "entries" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "entries_org_ct_idx" ON "entries" USING btree ("organization_id","content_type_id");--> statement-breakpoint
CREATE INDEX "entries_status_idx" ON "entries" USING btree ("status");--> statement-breakpoint
CREATE INDEX "entry_relations_org_idx" ON "entry_relations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "entry_relations_org_entry_idx" ON "entry_relations" USING btree ("organization_id","entry_id");--> statement-breakpoint
CREATE INDEX "entry_relations_org_type_value_idx" ON "entry_relations" USING btree ("organization_id","type","value");--> statement-breakpoint
CREATE INDEX "schema_migrations_org_idx" ON "schema_migrations" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "schema_migrations_org_ct_idx" ON "schema_migrations" USING btree ("organization_id","content_type_id");--> statement-breakpoint
CREATE INDEX "schema_migrations_status_idx" ON "schema_migrations" USING btree ("status");--> statement-breakpoint
CREATE INDEX "schema_migrations_org_ct_version_idx" ON "schema_migrations" USING btree ("organization_id","content_type_id","to_version");