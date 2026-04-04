DROP INDEX "twoFactor_secret_idx";--> statement-breakpoint
ALTER TABLE "changelog_label_assignments" ADD CONSTRAINT "changelog_label_assignments_changelog_id_changelogs_id_fk" FOREIGN KEY ("changelog_id") REFERENCES "public"."changelogs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_label_assignments" ADD CONSTRAINT "changelog_label_assignments_label_id_changelog_labels_id_fk" FOREIGN KEY ("label_id") REFERENCES "public"."changelog_labels"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "changelog_subscriptions" ADD CONSTRAINT "changelog_subscriptions_customer_id_customers_id_fk" FOREIGN KEY ("customer_id") REFERENCES "public"."customers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "feature_flags_org_key_env_uidx" ON "feature_flags" USING btree ("organization_id","key","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "global_configs_org_slug_env_uidx" ON "global_configs" USING btree ("organization_id","slug","environment");--> statement-breakpoint
CREATE UNIQUE INDEX "member_org_user_uidx" ON "member" USING btree ("organization_id","user_id");