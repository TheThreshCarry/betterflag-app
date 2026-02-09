import { pgTable, text, boolean, timestamp, jsonb, uuid, varchar, index } from "drizzle-orm/pg-core";

// ============================================
// Feature Flags
// ============================================

export const featureFlags = pgTable(
  "feature_flags",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    key: varchar("key", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    enabled: boolean("enabled").default(false).notNull(),
    environment: varchar("environment", { length: 50 }).default("production").notNull(),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("feature_flags_key_env_idx").on(table.key, table.environment),
    index("feature_flags_org_idx").on(table.organizationId),
  ]
);

export type FeatureFlag = typeof featureFlags.$inferSelect;
export type NewFeatureFlag = typeof featureFlags.$inferInsert;

// ============================================
// Global Configs
// ============================================

export const globalConfigs = pgTable(
  "global_configs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    slug: varchar("slug", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    description: text("description"),
    data: jsonb("data").default({}).notNull(),
    environment: varchar("environment", { length: 50 }).default("production").notNull(),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("global_configs_slug_env_idx").on(table.slug, table.environment),
    index("global_configs_org_idx").on(table.organizationId),
  ]
);

export type GlobalConfig = typeof globalConfigs.$inferSelect;
export type NewGlobalConfig = typeof globalConfigs.$inferInsert;

// ============================================
// Changelogs
// ============================================

export const changelogs = pgTable(
  "changelogs",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    title: varchar("title", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    version: varchar("version", { length: 50 }),
    content: jsonb("content"),
    summary: text("summary"),
    status: varchar("status", { length: 20 }).default("draft").notNull(),
    publishedAt: timestamp("published_at"),
    deployedAt: timestamp("deployed_at"),
    organizationId: text("organization_id"),
    authorId: text("author_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("changelogs_slug_idx").on(table.slug),
    index("changelogs_org_idx").on(table.organizationId),
    index("changelogs_status_idx").on(table.status),
  ]
);

export type Changelog = typeof changelogs.$inferSelect;
export type NewChangelog = typeof changelogs.$inferInsert;

// ============================================
// Changelog Labels
// ============================================

export const changelogLabels = pgTable(
  "changelog_labels",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    color: varchar("color", { length: 7 }).notNull(),
    organizationId: text("organization_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("changelog_labels_org_idx").on(table.organizationId),
  ]
);

export type ChangelogLabel = typeof changelogLabels.$inferSelect;
export type NewChangelogLabel = typeof changelogLabels.$inferInsert;

// ============================================
// Changelog Label Assignments (many-to-many)
// ============================================

export const changelogLabelAssignments = pgTable(
  "changelog_label_assignments",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    changelogId: uuid("changelog_id").notNull(),
    labelId: uuid("label_id").notNull(),
  },
  (table) => [
    index("cla_changelog_idx").on(table.changelogId),
    index("cla_label_idx").on(table.labelId),
  ]
);

export type ChangelogLabelAssignment = typeof changelogLabelAssignments.$inferSelect;
export type NewChangelogLabelAssignment = typeof changelogLabelAssignments.$inferInsert;

// ============================================
// Customers
// ============================================

export const customers = pgTable(
  "customers",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    email: varchar("email", { length: 255 }),
    name: varchar("name", { length: 255 }),
    externalId: varchar("external_id", { length: 255 }),
    metadata: jsonb("metadata").default({}),
    organizationId: text("organization_id"),
    userId: text("user_id"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("customers_email_idx").on(table.email),
    index("customers_org_idx").on(table.organizationId),
    index("customers_external_id_idx").on(table.externalId),
  ]
);

export type Customer = typeof customers.$inferSelect;
export type NewCustomer = typeof customers.$inferInsert;

// ============================================
// Changelog Subscriptions
// ============================================

export const changelogSubscriptions = pgTable(
  "changelog_subscriptions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    customerId: uuid("customer_id").notNull(),
    organizationId: text("organization_id"),
    subscribedAt: timestamp("subscribed_at").defaultNow().notNull(),
    unsubscribedAt: timestamp("unsubscribed_at"),
  },
  (table) => [
    index("changelog_subs_customer_idx").on(table.customerId),
    index("changelog_subs_org_idx").on(table.organizationId),
  ]
);

export type ChangelogSubscription = typeof changelogSubscriptions.$inferSelect;
export type NewChangelogSubscription = typeof changelogSubscriptions.$inferInsert;
