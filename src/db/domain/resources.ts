import { boolean, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { user as users } from "../auth-schema";
import { createdAt, deletedAt, id, optionalTimestamp, updatedAt } from "./columns";
import { metadataStatusEnum, resourceTypeEnum, submissionStatusEnum, type JsonObject } from "./enums";
import { spaces, vaults } from "./vaults";

export const resources = pgTable(
	"resources",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
		type: resourceTypeEnum("type").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		url: text("url").notNull(),
		dedupeKey: text("dedupe_key").notNull(),
		metadataStatus: metadataStatusEnum("metadata_status").notNull().default("pending"),
		position: integer("position").notNull().default(0),
		starCount: integer("star_count").notNull().default(0),
		createdBy: text("created_by").references(() => users.id, { onDelete: "set null" }),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		index("resources_vault_space_position_idx").on(table.vaultId, table.spaceId, table.position),
		uniqueIndex("resources_vault_dedupe_unique").on(table.vaultId, table.dedupeKey),
	],
);

export const resourceMetadata = pgTable("resource_metadata", {
	resourceId: uuid("resource_id")
		.primaryKey()
		.notNull()
		.references(() => resources.id, { onDelete: "cascade" }),
	provider: text("provider").notNull(),
	status: metadataStatusEnum("status").notNull().default("pending"),
	dataJson: jsonb("data_json").$type<JsonObject>().notNull().default({}),
	errorMessage: text("error_message"),
	createdAt: createdAt(),
	updatedAt: updatedAt(),
});

export const resourceSubmissions = pgTable(
	"resource_submissions",
	{
		id: id(),
		vaultId: uuid("vault_id")
			.notNull()
			.references(() => vaults.id, { onDelete: "cascade" }),
		spaceId: uuid("space_id").references(() => spaces.id, { onDelete: "set null" }),
		status: submissionStatusEnum("status").notNull().default("pending"),
		submitterId: text("submitter_id").references(() => users.id, { onDelete: "set null" }),
		submitterName: text("submitter_name").notNull().default(""),
		submitterEmail: text("submitter_email").notNull().default(""),
		type: resourceTypeEnum("type").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		url: text("url").notNull(),
		metadataJson: jsonb("metadata_json").$type<JsonObject>().notNull().default({}),
		reviewedBy: text("reviewed_by").references(() => users.id, { onDelete: "set null" }),
		reviewNote: text("review_note").notNull().default(""),
		reviewedAt: optionalTimestamp("reviewed_at"),
		approvedResourceId: uuid("approved_resource_id").references(() => resources.id, {
			onDelete: "set null",
		}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
		deletedAt: deletedAt(),
	},
	(table) => [index("resource_submissions_vault_status_created_idx").on(table.vaultId, table.status, table.createdAt)],
);

export const starredResources = pgTable(
	"starred_resources",
	{
		id: id(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		sourceResourceId: uuid("source_resource_id"),
		type: resourceTypeEnum("type").notNull(),
		title: text("title").notNull(),
		description: text("description").notNull().default(""),
		url: text("url").notNull(),
		metadataStatus: metadataStatusEnum("metadata_status").notNull().default("pending"),
		metadataProvider: text("metadata_provider"),
		metadataDataJson: jsonb("metadata_data_json").$type<JsonObject>().notNull().default({}),
		metadataErrorMessage: text("metadata_error_message"),
		sourceCreatedAt: optionalTimestamp("source_created_at"),
		createdAt: createdAt(),
	},
	(table) => [
		uniqueIndex("starred_resources_user_source_unique").on(table.userId, table.sourceResourceId),
		index("starred_resources_user_created_idx").on(table.userId, table.createdAt),
		index("starred_resources_source_resource_idx").on(table.sourceResourceId),
	],
);

export const resourceReadLater = pgTable(
	"resource_read_later",
	{
		id: id(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		resourceId: uuid("resource_id")
			.notNull()
			.references(() => resources.id, { onDelete: "cascade" }),
		position: integer("position").notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("resource_read_later_user_resource_unique").on(table.userId, table.resourceId),
		index("resource_read_later_user_position_idx").on(table.userId, table.position),
	],
);

export const resourceAnnotations = pgTable(
	"resource_annotations",
	{
		id: id(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		resourceId: uuid("resource_id")
			.notNull()
			.references(() => resources.id, { onDelete: "cascade" }),
		rating: integer("rating"),
		comment: text("comment").notNull().default(""),
		checked: boolean("checked").notNull().default(false),
		dataJson: jsonb("data_json").$type<JsonObject>().notNull().default({}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [
		uniqueIndex("resource_annotations_user_resource_unique").on(table.userId, table.resourceId),
		index("resource_annotations_user_updated_idx").on(table.userId, table.updatedAt),
	],
);
