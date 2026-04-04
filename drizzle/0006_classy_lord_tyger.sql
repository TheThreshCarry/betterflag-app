ALTER TABLE "apikey" ADD COLUMN "organization_id" text;--> statement-breakpoint
ALTER TABLE "apikey" ADD CONSTRAINT "apikey_organization_id_organization_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organization"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "apikey_organizationId_idx" ON "apikey" USING btree ("organization_id");--> statement-breakpoint
-- Backfill: one deterministic org per user (lexicographically smallest member.organization_id). Multi-org users may need to rotate API keys.
UPDATE "apikey" SET "organization_id" = (
  SELECT "member"."organization_id" FROM "member"
  WHERE "member"."user_id" = "apikey"."user_id"
  ORDER BY "member"."organization_id" ASC
  LIMIT 1
) WHERE "organization_id" IS NULL;