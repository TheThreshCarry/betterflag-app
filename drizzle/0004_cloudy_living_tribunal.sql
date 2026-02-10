CREATE TABLE "media_assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"key" varchar(512) NOT NULL,
	"url" text NOT NULL,
	"folder" varchar(512) DEFAULT '/' NOT NULL,
	"type" varchar(20) NOT NULL,
	"mime_type" varchar(100) NOT NULL,
	"size" integer NOT NULL,
	"organization_id" text,
	"uploaded_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "media_folders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"path" varchar(512) NOT NULL,
	"parent_path" varchar(512) DEFAULT '/' NOT NULL,
	"organization_id" text,
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "media_assets_org_idx" ON "media_assets" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "media_assets_type_idx" ON "media_assets" USING btree ("type");--> statement-breakpoint
CREATE INDEX "media_assets_folder_idx" ON "media_assets" USING btree ("organization_id","folder");--> statement-breakpoint
CREATE INDEX "media_folders_org_parent_idx" ON "media_folders" USING btree ("organization_id","parent_path");--> statement-breakpoint
CREATE INDEX "media_folders_org_path_idx" ON "media_folders" USING btree ("organization_id","path");