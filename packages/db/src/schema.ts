import { relations } from "drizzle-orm"
import {
  boolean,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core"

import { userTable as users } from "./better-auth-schema"

export { users }

const createdTimestamp = (name: string) =>
  timestamp(name, { mode: "string" }).notNull().defaultNow()
const optionalTimestamp = (name: string) => timestamp(name, { mode: "string" })

export const vaults = pgTable(
  "vaults",
  {
    id: uuid("id").primaryKey(),
    title: text("title").notNull(),
    description: text("description").notNull().default(""),
    cover: text("cover").notNull().default(""),
    visibility: text("visibility", {
      enum: ["public", "private", "password"],
    })
      .notNull()
      .default("private"),
    passwordHash: text("password_hash"),
    collectionEnabled: boolean("collection_enabled").notNull().default(false),
    nsfwEnabled: boolean("nsfw_enabled").notNull().default(true),
    ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
    starCount: integer("star_count").notNull().default(0),
    forkCount: integer("fork_count").notNull().default(0),
    forkedFromVaultId: uuid("forked_from_vault_id"),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    ownerDeletedCreatedIdx: index("vaults_owner_deleted_created_idx").on(
      table.ownerId,
      table.deletedAt,
      table.createdAt
    ),
    deletedCreatedIdx: index("vaults_deleted_created_idx").on(
      table.deletedAt,
      table.createdAt
    ),
  })
)

export const spaces = pgTable(
  "spaces",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    description: text("description").notNull().default(""),
    icon: text("icon").notNull().default("tv"),
    position: integer("position").notNull().default(0),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    vaultDeletedPositionIdx: index("spaces_vault_deleted_position_idx").on(
      table.vaultId,
      table.deletedAt,
      table.position
    ),
  })
)

export const resources = pgTable(
  "resources",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
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
    dedupeKey: text("dedupe_key").notNull(),
    metadataStatus: text("metadata_status", {
      enum: ["pending", "processing", "completed", "failed"],
    })
      .notNull()
      .default("pending"),
    position: integer("position").notNull().default(0),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    vaultDeletedSpacePositionIdx: index("resources_vault_deleted_space_position_idx").on(
      table.vaultId,
      table.deletedAt,
      table.spaceId,
      table.position
    ),
    vaultDedupeUnique: uniqueIndex("resources_vault_dedupe_unique").on(
      table.vaultId,
      table.dedupeKey
    ),
  })
)

export const resourceSubmissions = pgTable(
  "resource_submissions",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
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
    reviewedAt: optionalTimestamp("reviewed_at"),
    approvedResourceId: uuid("approved_resource_id").references(() => resources.id, {
      onDelete: "set null",
    }),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    vaultStatusCreatedIdx: index("resource_submissions_vault_status_created_idx").on(
      table.vaultId,
      table.status,
      table.createdAt
    ),
  })
)

export const resourceMetadata = pgTable("resource_metadata", {
  resourceId: uuid("resource_id")
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
  createdAt: createdTimestamp("created_at"),
  updatedAt: createdTimestamp("updated_at"),
})

export const collaborators = pgTable(
  "collaborators",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    role: text("role", { enum: ["editor"] }).notNull().default("editor"),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
  },
  (table) => ({
    vaultUserUnique: uniqueIndex("collaborators_vault_user_unique").on(
      table.vaultId,
      table.userId
    ),
    userVaultIdx: index("collaborators_user_vault_idx").on(
      table.userId,
      table.vaultId
    ),
  })
)

export const shares = pgTable(
  "shares",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
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
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    vaultDeletedIdx: index("shares_vault_deleted_idx").on(table.vaultId, table.deletedAt),
    slugDeletedIdx: index("shares_slug_deleted_idx").on(table.slug, table.deletedAt),
  })
)

export const comments = pgTable(
  "comments",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    resourceId: uuid("resource_id")
      .notNull()
      .references(() => resources.id, { onDelete: "cascade" }),
    parentId: uuid("parent_id"),
    authorId: text("author_id").references(() => users.id, { onDelete: "set null" }),
    authorName: text("author_name").notNull().default("Anonymous"),
    body: text("body").notNull(),
    createdAt: createdTimestamp("created_at"),
    updatedAt: createdTimestamp("updated_at"),
    deletedAt: optionalTimestamp("deleted_at"),
  },
  (table) => ({
    vaultDeletedCreatedIdx: index("comments_vault_deleted_created_idx").on(
      table.vaultId,
      table.deletedAt,
      table.createdAt
    ),
    resourceDeletedCreatedIdx: index("comments_resource_deleted_created_idx").on(
      table.resourceId,
      table.deletedAt,
      table.createdAt
    ),
  })
)

export const stars = pgTable(
  "stars",
  {
    id: uuid("id").primaryKey(),
    vaultId: uuid("vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    vaultUserUnique: uniqueIndex("stars_vault_user_unique").on(
      table.vaultId,
      table.userId
    ),
    userCreatedIdx: index("stars_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
)

export const starredResources = pgTable(
  "starred_resources",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").notNull(),
    sourceResourceId: uuid("source_resource_id").notNull(),
    sourceVaultId: uuid("source_vault_id").notNull(),
    sourceSpaceId: uuid("source_space_id"),
    sourceVaultTitle: text("source_vault_title").notNull().default(""),
    sourceSpaceName: text("source_space_name").notNull().default(""),
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
    sourceCreatedAt: optionalTimestamp("source_created_at"),
    createdAt: createdTimestamp("created_at"),
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

export const forks = pgTable(
  "forks",
  {
    id: uuid("id").primaryKey(),
    sourceVaultId: uuid("source_vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    targetVaultId: uuid("target_vault_id")
      .notNull()
      .references(() => vaults.id, { onDelete: "cascade" }),
    createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    sourceTargetIdx: index("forks_source_target_idx").on(
      table.sourceVaultId,
      table.targetVaultId
    ),
    createdByCreatedIdx: index("forks_created_by_created_idx").on(
      table.createdBy,
      table.createdAt
    ),
  })
)

export const notifications = pgTable(
  "notifications",
  {
    id: uuid("id").primaryKey(),
    userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
    vaultId: uuid("vault_id").references(() => vaults.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    title: text("title").notNull(),
    body: text("body").notNull().default(""),
    readAt: optionalTimestamp("read_at"),
    createdAt: createdTimestamp("created_at"),
  },
  (table) => ({
    userReadCreatedIdx: index("notifications_user_read_created_idx").on(
      table.userId,
      table.readAt,
      table.createdAt
    ),
    userCreatedIdx: index("notifications_user_created_idx").on(
      table.userId,
      table.createdAt
    ),
  })
)

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
  metadata: one(resourceMetadata, {
    fields: [resources.id],
    references: [resourceMetadata.resourceId],
  }),
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
