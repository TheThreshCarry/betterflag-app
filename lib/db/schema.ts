import { relations } from "drizzle-orm";
import { pgTable, pgEnum, text, boolean, timestamp, jsonb, uuid, varchar, index, uniqueIndex, integer } from "drizzle-orm/pg-core";

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
    uniqueIndex("feature_flags_org_key_env_uidx").on(table.organizationId, table.key, table.environment),
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
    uniqueIndex("global_configs_org_slug_env_uidx").on(table.organizationId, table.slug, table.environment),
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
    changelogId: uuid("changelog_id").notNull().references(() => changelogs.id, { onDelete: "cascade" }),
    labelId: uuid("label_id").notNull().references(() => changelogLabels.id, { onDelete: "cascade" }),
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
    customerId: uuid("customer_id").notNull().references(() => customers.id, { onDelete: "cascade" }),
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

// ============================================
// Media Assets
// ============================================

export const mediaAssets = pgTable(
  "media_assets",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    key: varchar("key", { length: 512 }).notNull(),
    url: text("url").notNull(),
    folder: varchar("folder", { length: 512 }).default("/").notNull(),
    type: varchar("type", { length: 20 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    organizationId: text("organization_id"),
    uploadedBy: text("uploaded_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_assets_org_idx").on(table.organizationId),
    index("media_assets_type_idx").on(table.type),
    index("media_assets_folder_idx").on(table.organizationId, table.folder),
  ]
);

export type MediaAsset = typeof mediaAssets.$inferSelect;
export type NewMediaAsset = typeof mediaAssets.$inferInsert;

// ============================================
// Media Folders
// ============================================

export const mediaFolders = pgTable(
  "media_folders",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    name: varchar("name", { length: 255 }).notNull(),
    path: varchar("path", { length: 512 }).notNull(),
    parentPath: varchar("parent_path", { length: 512 }).default("/").notNull(),
    organizationId: text("organization_id"),
    createdBy: text("created_by"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("media_folders_org_parent_idx").on(table.organizationId, table.parentPath),
    index("media_folders_org_path_idx").on(table.organizationId, table.path),
  ]
);

export type MediaFolder = typeof mediaFolders.$inferSelect;
export type NewMediaFolder = typeof mediaFolders.$inferInsert;

// ============================================
// CMS Enums
// ============================================

export const contentTypeStatusEnum = pgEnum("content_type_status", ["draft", "active", "deprecated"]);
export const entryStatusEnum = pgEnum("entry_status", ["draft", "published", "archived"]);
export const schemaMigrationStatusEnum = pgEnum("schema_migration_status", ["pending", "done", "error"]);

// ============================================
// Content Types
// ============================================

export const contentTypes = pgTable(
  "content_types",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    name: varchar("name", { length: 255 }).notNull(),
    slug: varchar("slug", { length: 255 }).notNull(),
    version: integer("version").default(1).notNull(),
    status: contentTypeStatusEnum("status").default("draft"),
    schema: jsonb("schema").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("content_types_org_slug_uidx").on(table.organizationId, table.slug),
    index("content_types_org_idx").on(table.organizationId),
    index("content_types_org_name_idx").on(table.organizationId, table.name),
  ]
);

export type ContentType = typeof contentTypes.$inferSelect;
export type NewContentType = typeof contentTypes.$inferInsert;

// ============================================
// Entries
// ============================================

export const entries = pgTable(
  "entries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id, { onDelete: "cascade" }),
    slug: varchar("slug", { length: 255 }).notNull(),
    status: entryStatusEnum("status").default("draft"),
    data: jsonb("data").default({}).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => new Date())
      .notNull(),
  },
  (table) => [
    uniqueIndex("entries_org_ct_slug_uidx").on(table.organizationId, table.contentTypeId, table.slug),
    index("entries_org_idx").on(table.organizationId),
    index("entries_org_ct_idx").on(table.organizationId, table.contentTypeId),
    index("entries_status_idx").on(table.status),
  ]
);

export type Entry = typeof entries.$inferSelect;
export type NewEntry = typeof entries.$inferInsert;

// ============================================
// Entry Relations (taxonomy / links)
// ============================================

export const entryRelations = pgTable(
  "entry_relations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    entryId: uuid("entry_id")
      .notNull()
      .references(() => entries.id, { onDelete: "cascade" }),
    type: varchar("type", { length: 100 }).notNull(),
    value: varchar("value", { length: 512 }).notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("entry_relations_org_idx").on(table.organizationId),
    index("entry_relations_org_entry_idx").on(table.organizationId, table.entryId),
    index("entry_relations_org_type_value_idx").on(table.organizationId, table.type, table.value),
  ]
);

export type EntryRelation = typeof entryRelations.$inferSelect;
export type NewEntryRelation = typeof entryRelations.$inferInsert;

// ============================================
// CMS Media
// ============================================

export const cmsMedia = pgTable(
  "cms_media",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    slug: varchar("slug", { length: 255 }).notNull(),
    mimeType: varchar("mime_type", { length: 100 }).notNull(),
    size: integer("size").notNull(),
    metadata: jsonb("metadata").default({}),
    mediaAssetId: uuid("media_asset_id").references(() => mediaAssets.id),
    url: text("url"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("cms_media_org_slug_uidx").on(table.organizationId, table.slug),
    index("cms_media_org_idx").on(table.organizationId),
    index("cms_media_mime_type_idx").on(table.mimeType),
  ]
);

export type CmsMedia = typeof cmsMedia.$inferSelect;
export type NewCmsMedia = typeof cmsMedia.$inferInsert;

// ============================================
// Schema Migrations (CMS content type versioning)
// ============================================

export const schemaMigrations = pgTable(
  "schema_migrations",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    organizationId: text("organization_id"),
    contentTypeId: uuid("content_type_id")
      .notNull()
      .references(() => contentTypes.id),
    fromVersion: integer("from_version").notNull(),
    toVersion: integer("to_version").notNull(),
    changes: jsonb("changes").notNull(),
    status: schemaMigrationStatusEnum("status").default("pending"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("schema_migrations_org_idx").on(table.organizationId),
    index("schema_migrations_org_ct_idx").on(table.organizationId, table.contentTypeId),
    index("schema_migrations_status_idx").on(table.status),
    index("schema_migrations_org_ct_version_idx").on(table.organizationId, table.contentTypeId, table.toVersion),
  ]
);

export type SchemaMigration = typeof schemaMigrations.$inferSelect;
export type NewSchemaMigration = typeof schemaMigrations.$inferInsert;

// ============================================
// CMS Drizzle Relations
// ============================================

export const contentTypesRelations = relations(contentTypes, ({ many }) => ({
  entries: many(entries),
  schemaMigrations: many(schemaMigrations),
}));

export const entriesRelations = relations(entries, ({ one, many }) => ({
  contentType: one(contentTypes, {
    fields: [entries.contentTypeId],
    references: [contentTypes.id],
  }),
  entryRelations: many(entryRelations),
}));

export const entryRelationsRelations = relations(entryRelations, ({ one }) => ({
  entry: one(entries, {
    fields: [entryRelations.entryId],
    references: [entries.id],
  }),
}));

export const cmsMediaRelations = relations(cmsMedia, ({ one }) => ({
  mediaAsset: one(mediaAssets, {
    fields: [cmsMedia.mediaAssetId],
    references: [mediaAssets.id],
  }),
}));

export const schemaMigrationsRelations = relations(schemaMigrations, ({ one }) => ({
  contentType: one(contentTypes, {
    fields: [schemaMigrations.contentTypeId],
    references: [contentTypes.id],
  }),
}));
