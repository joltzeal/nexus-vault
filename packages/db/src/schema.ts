import { relations, sql } from "drizzle-orm"
import { index, integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core"

export const users = sqliteTable("users", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  name: text("name"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const vaults = sqliteTable("vaults", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  cover: text("cover").notNull().default(""),
  visibility: text("visibility", {
    enum: ["public", "private", "password"],
  })
    .notNull()
    .default("private"),
  passwordHash: text("password_hash"),
  collectionEnabled: integer("collection_enabled", { mode: "boolean" })
    .notNull()
    .default(false),
  nsfwEnabled: integer("nsfw_enabled", { mode: "boolean" })
    .notNull()
    .default(true),
  ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
  starCount: integer("star_count").notNull().default(0),
  forkCount: integer("fork_count").notNull().default(0),
  forkedFromVaultId: text("forked_from_vault_id"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const spaces = sqliteTable("spaces", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  description: text("description").notNull().default(""),
  icon: text("icon").notNull().default("tv"),
  position: integer("position").notNull().default(0),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const resources = sqliteTable("resources", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
  type: text("type", {
    enum: [
      "magnet",
      "twitter",
      "baidu_pan",
      "pan_115",
      "pan_123",
      "quark_pan",
      "uc_pan",
      "xunlei_pan",
      "pikpak",
      "onedrive",
      "google_drive",
      "dropbox",
      "alist",
      "http",
      "youtube",
      "other",
    ],
  }).notNull(),
  title: text("title").notNull(),
  description: text("description").notNull().default(""),
  url: text("url").notNull(),
  metadataStatus: text("metadata_status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  position: integer("position").notNull().default(0),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const resourceSubmissions = sqliteTable(
  "resource_submissions",
  {
    id: text("id").primaryKey(),
    vaultId: text("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    spaceId: text("space_id").references(() => spaces.id, { onDelete: "set null" }),
    status: text("status", {
      enum: ["pending", "approved", "rejected"],
    })
      .notNull()
      .default("pending"),
    submitterId: text("submitter_id").references(() => users.id, { onDelete: "set null" }),
    submitterName: text("submitter_name").notNull().default(""),
    submitterEmail: text("submitter_email").notNull().default(""),
    type: text("type", {
      enum: [
        "magnet",
        "twitter",
        "baidu_pan",
        "pan_115",
        "pan_123",
        "quark_pan",
        "uc_pan",
        "xunlei_pan",
        "pikpak",
        "onedrive",
        "google_drive",
        "dropbox",
        "alist",
        "http",
        "youtube",
        "other",
      ],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    url: text("url").notNull(),
    metadataJson: text("metadata_json").notNull().default("{}"),
    reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
    reviewNote: text("review_note").notNull().default(""),
    reviewedAt: text("reviewed_at"),
    approvedResourceId: text("approved_resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    deletedAt: text("deleted_at"),
  },
  (table) => ({
    vaultStatusCreatedIdx: index("resource_submissions_vault_status_created_idx").on(
      table.vaultId,
      table.status,
      table.createdAt
    ),
  })
)

export const resourceMetadata = sqliteTable("resource_metadata", {
  resourceId: text("resource_id")
    .primaryKey()
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(),
  status: text("status", {
    enum: ["pending", "processing", "completed", "failed"],
  })
    .notNull()
    .default("pending"),
  dataJson: text("data_json").notNull().default("{}"),
  errorMessage: text("error_message"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const collaborators = sqliteTable(
  "collaborators",
  {
    id: text("id").primaryKey(),
    vaultId: text("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor"] }).notNull().default("editor"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
    updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    vaultUserUnique: uniqueIndex("collaborators_vault_user_unique").on(
      table.vaultId,
      table.userId
    ),
  })
)

export const shares = sqliteTable("shares", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  visibility: text("visibility", {
    enum: ["public", "private", "password"],
  })
    .notNull()
    .default("private"),
  passwordHash: text("password_hash"),
  token: text("token").notNull().unique(),
  slug: text("slug").unique(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const comments = sqliteTable("comments", {
  id: text("id").primaryKey(),
  vaultId: text("vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  resourceId: text("resource_id")
    .notNull()
    .references(() => resources.id, { onDelete: "cascade" }),
  parentId: text("parent_id"),
  authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
  authorName: text("author_name").notNull().default("Anonymous"),
  body: text("body").notNull(),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  deletedAt: text("deleted_at"),
})

export const stars = sqliteTable(
  "stars",
  {
    id: text("id").primaryKey(),
    vaultId: text("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    vaultUserUnique: uniqueIndex("stars_vault_user_unique").on(
      table.vaultId,
      table.userId
    ),
  })
)

export const starredResources = sqliteTable(
  "starred_resources",
  {
    id: text("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceResourceId: text("source_resource_id").notNull(),
    sourceVaultId: text("source_vault_id").notNull(),
    sourceSpaceId: text("source_space_id"),
    type: text("type", {
      enum: [
        "magnet",
        "twitter",
        "baidu_pan",
        "pan_115",
        "pan_123",
        "quark_pan",
        "uc_pan",
        "xunlei_pan",
        "pikpak",
        "onedrive",
        "google_drive",
        "dropbox",
        "alist",
        "http",
        "youtube",
        "other",
      ],
    }).notNull(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    url: text("url").notNull(),
    metadataStatus: text("metadata_status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    metadataProvider: text("metadata_provider"),
    metadataDataJson: text("metadata_data_json").notNull().default("{}"),
    metadataErrorMessage: text("metadata_error_message"),
    sourceCreatedAt: text("source_created_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => ({
    userSourceUnique: uniqueIndex("starred_resources_user_source_unique").on(
      table.userId,
      table.sourceResourceId
    ),
    userCreatedIdx: index("starred_resources_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
)

export const forks = sqliteTable("forks", {
  id: text("id").primaryKey(),
  sourceVaultId: text("source_vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  targetVaultId: text("target_vault_id")
    .notNull()
    .references(() => vaults.id, { onDelete: "cascade" }),
  createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const notifications = sqliteTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
  vaultId: text("vault_id").references(() => vaults.id, { onDelete: "cascade" }),
  type: text("type").notNull(),
  title: text("title").notNull(),
  body: text("body").notNull().default(""),
  readAt: text("read_at"),
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
})

export const vaultRelations = relations(vaults, ({ many }) => ({
  spaces: many(spaces),
  resources: many(resources),
  resourceSubmissions: many(resourceSubmissions),
  collaborators: many(collaborators),
  comments: many(comments),
  shares: many(shares),
  stars: many(stars),
}))

export const spaceRelations = relations(spaces, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [spaces.vaultId],
    references: [vaults.id],
  }),
  resources: many(resources),
}))

export const resourceRelations = relations(resources, ({ one, many }) => ({
  vault: one(vaults, {
    fields: [resources.vaultId],
    references: [vaults.id],
  }),
  space: one(spaces, {
    fields: [resources.spaceId],
    references: [spaces.id],
  }),
  metadata: many(resourceMetadata),
  comments: many(comments),
}))

export const resourceSubmissionRelations = relations(resourceSubmissions, ({ one }) => ({
  vault: one(vaults, {
    fields: [resourceSubmissions.vaultId],
    references: [vaults.id],
  }),
  space: one(spaces, {
    fields: [resourceSubmissions.spaceId],
    references: [spaces.id],
  }),
  approvedResource: one(resources, {
    fields: [resourceSubmissions.approvedResourceId],
    references: [resources.id],
  }),
}))

export const commentRelations = relations(comments, ({ one }) => ({
  vault: one(vaults, {
    fields: [comments.vaultId],
    references: [vaults.id],
  }),
  resource: one(resources, {
    fields: [comments.resourceId],
    references: [resources.id],
  }),
}))
