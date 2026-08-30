import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, index, integer, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user as users } from "../../auth/schema";
import { createdAt, deletedAt, id, updatedAt } from "./columns";
import { collaboratorRoleEnum, vaultVisibilityEnum, vaultWatchLevelEnum } from "./enums";

export const vaults = pgTable(
	"vaults",
	{
		id: id(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		cover: text("cover").notNull().default(""),
		visibility: vaultVisibilityEnum("visibility").notNull().default("private"),
		passwordHash: text("password_hash"),
		collectionEnabled: boolean("collection_enabled").notNull().default(false),
		nsfwEnabled: boolean("nsfw_enabled").notNull().default(true),
		ownerId: text("owner_id").references(() => users.id, { onDelete: "set null" }),
		starCount: integer("star_count").notNull().default(0),
		forkCount: integer("fork_count").notNull().default(0),
		forkedFromVaultId: uuid("forked_from_vault_id").references((): AnyPgColumn => vaults.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("vaults_owner_deleted_created_idx").on(table.ownerId, table.deletedAt, table.createdAt),
		index("vaults_deleted_created_idx").on(table.deletedAt, table.createdAt),
	],
);

export const spaces = pgTable(
	"spaces",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		name: text("name").notNull(),
		description: text("description").notNull().default(""),
		icon: text("icon").notNull().default("tv"),
		position: integer("position").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [index("spaces_vault_deleted_position_idx").on(table.vaultId, table.deletedAt, table.position)],
);

export const collaborators = pgTable(
	"collaborators",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		role: collaboratorRoleEnum("role").notNull().default("editor"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("collaborators_vault_user_unique").on(table.vaultId, table.userId),
		index("collaborators_user_vault_idx").on(table.userId, table.vaultId),
	],
);

export const shares = pgTable(
	"shares",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		visibility: vaultVisibilityEnum("visibility").notNull().default("private"),
		passwordHash: text("password_hash"),
		token: text("token").notNull().unique(),
		slug: text("slug"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [
		index("shares_vault_deleted_idx").on(table.vaultId, table.deletedAt),
		uniqueIndex("shares_slug_active_unique").on(table.slug).where(sql`${table.deletedAt} is null`),
	],
);

export const vaultStars = pgTable(
	"vault_stars",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("vault_stars_vault_user_unique").on(table.vaultId, table.userId),
		index("vault_stars_user_created_idx").on(table.userId, table.createdAt),
	],
);

export const vaultWatches = pgTable(
	"vault_watches",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		level: vaultWatchLevelEnum("level").notNull().default("updates"),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("vault_watches_vault_user_unique").on(table.vaultId, table.userId),
		index("vault_watches_user_updated_idx").on(table.userId, table.updatedAt),
	],
);

export const forks = pgTable(
	"forks",
	{
		id: id(),
		sourceVaultId: uuid("source_vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		targetVaultId: uuid("target_vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("forks_source_target_unique").on(table.sourceVaultId, table.targetVaultId),
		index("forks_created_by_created_idx").on(table.createdBy, table.createdAt),
	],
);
