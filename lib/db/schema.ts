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
