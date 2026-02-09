CREATE TABLE "changelog_label_assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"changelog_id" uuid NOT NULL,
	"label_id" uuid NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_labels" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(100) NOT NULL,
	"color" varchar(7) NOT NULL,
	"organization_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "changelog_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"customer_id" uuid NOT NULL,
	"organization_id" text,
	"subscribed_at" timestamp DEFAULT now() NOT NULL,
	"unsubscribed_at" timestamp
);
--> statement-breakpoint
CREATE TABLE "changelogs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"title" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"version" varchar(50),
	"content" jsonb,
	"summary" text,
	"status" varchar(20) DEFAULT 'draft' NOT NULL,
	"published_at" timestamp,
	"organization_id" text,
	"author_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "customers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255),
	"name" varchar(255),
	"external_id" varchar(255),
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"organization_id" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "cla_changelog_idx" ON "changelog_label_assignments" USING btree ("changelog_id");--> statement-breakpoint
CREATE INDEX "cla_label_idx" ON "changelog_label_assignments" USING btree ("label_id");--> statement-breakpoint
CREATE INDEX "changelog_labels_org_idx" ON "changelog_labels" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "changelog_subs_customer_idx" ON "changelog_subscriptions" USING btree ("customer_id");--> statement-breakpoint
CREATE INDEX "changelog_subs_org_idx" ON "changelog_subscriptions" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "changelogs_slug_idx" ON "changelogs" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "changelogs_org_idx" ON "changelogs" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "changelogs_status_idx" ON "changelogs" USING btree ("status");--> statement-breakpoint
CREATE INDEX "customers_email_idx" ON "customers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "customers_org_idx" ON "customers" USING btree ("organization_id");--> statement-breakpoint
CREATE INDEX "customers_external_id_idx" ON "customers" USING btree ("external_id");