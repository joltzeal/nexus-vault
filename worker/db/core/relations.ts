import { relations } from "drizzle-orm";
import { user as users } from "../../auth/schema";
import { notifications } from "./notifications";
import {
	resourceAnnotations,
	resourceMetadata,
	resourceReadLater,
	resourceSubmissions,
	starredResources,
	resources,
} from "./resources";
import { userIntegrationSettings } from "./user-integrations";
import { collaborators, forks, shares, spaces, vaults, vaultStars, vaultWatches } from "./vaults";

export const userIntegrationSettingsRelations = relations(userIntegrationSettings, ({ one }) => ({
	user: one(users, {
		fields: [userIntegrationSettings.userId],
		references: [users.id],
	}),
}));

export const vaultRelations = relations(vaults, ({ one, many }) => ({
	owner: one(users, {
		fields: [vaults.ownerId],
		references: [users.id],
	}),
	forkedFrom: one(vaults, {
		fields: [vaults.forkedFromVaultId],
		references: [vaults.id],
		relationName: "vaultForkTree",
	}),
	forks: many(vaults, {
		relationName: "vaultForkTree",
	}),
	spaces: many(spaces),
	resources: many(resources),
	resourceSubmissions: many(resourceSubmissions),
	collaborators: many(collaborators),
	shares: many(shares),
	stars: many(vaultStars),
	watches: many(vaultWatches),
	sourceForks: many(forks, {
		relationName: "sourceVaultForks",
	}),
	targetForks: many(forks, {
		relationName: "targetVaultForks",
	}),
	notifications: many(notifications),
}));

export const spaceRelations = relations(spaces, ({ one, many }) => ({
	vault: one(vaults, {
		fields: [spaces.vaultId],
		references: [vaults.id],
	}),
	resources: many(resources),
	resourceSubmissions: many(resourceSubmissions),
}));

export const collaboratorRelations = relations(collaborators, ({ one }) => ({
	vault: one(vaults, {
		fields: [collaborators.vaultId],
		references: [vaults.id],
	}),
	user: one(users, {
		fields: [collaborators.userId],
		references: [users.id],
	}),
}));

export const shareRelations = relations(shares, ({ one }) => ({
	vault: one(vaults, {
		fields: [shares.vaultId],
		references: [vaults.id],
	}),
}));

export const vaultStarRelations = relations(vaultStars, ({ one }) => ({
	vault: one(vaults, {
		fields: [vaultStars.vaultId],
		references: [vaults.id],
	}),
	user: one(users, {
		fields: [vaultStars.userId],
		references: [users.id],
	}),
}));

export const vaultWatchRelations = relations(vaultWatches, ({ one }) => ({
	vault: one(vaults, {
		fields: [vaultWatches.vaultId],
		references: [vaults.id],
	}),
	user: one(users, {
		fields: [vaultWatches.userId],
		references: [users.id],
	}),
}));

export const forkRelations = relations(forks, ({ one }) => ({
	sourceVault: one(vaults, {
		fields: [forks.sourceVaultId],
		references: [vaults.id],
		relationName: "sourceVaultForks",
	}),
	targetVault: one(vaults, {
		fields: [forks.targetVaultId],
		references: [vaults.id],
		relationName: "targetVaultForks",
	}),
	createdByUser: one(users, {
		fields: [forks.createdBy],
		references: [users.id],
	}),
}));

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
	starredBy: many(starredResources),
	readLater: many(resourceReadLater),
	annotations: many(resourceAnnotations),
}));

export const resourceMetadataRelations = relations(resourceMetadata, ({ one }) => ({
	resource: one(resources, {
		fields: [resourceMetadata.resourceId],
		references: [resources.id],
	}),
}));

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
	submitter: one(users, {
		fields: [resourceSubmissions.submitterId],
		references: [users.id],
		relationName: "resourceSubmissionSubmitter",
	}),
	reviewer: one(users, {
		fields: [resourceSubmissions.reviewedBy],
		references: [users.id],
		relationName: "resourceSubmissionReviewer",
	}),
}));

export const starredResourceRelations = relations(starredResources, ({ one }) => ({
	user: one(users, {
		fields: [starredResources.userId],
		references: [users.id],
	}),
	resource: one(resources, {
		fields: [starredResources.sourceResourceId],
		references: [resources.id],
	}),
}));

export const resourceReadLaterRelations = relations(resourceReadLater, ({ one }) => ({
	user: one(users, {
		fields: [resourceReadLater.userId],
		references: [users.id],
	}),
	resource: one(resources, {
		fields: [resourceReadLater.resourceId],
		references: [resources.id],
	}),
}));

export const resourceAnnotationRelations = relations(resourceAnnotations, ({ one }) => ({
	user: one(users, {
		fields: [resourceAnnotations.userId],
		references: [users.id],
	}),
	resource: one(resources, {
		fields: [resourceAnnotations.resourceId],
		references: [resources.id],
	}),
}));

export const notificationRelations = relations(notifications, ({ one }) => ({
	user: one(users, {
		fields: [notifications.userId],
		references: [users.id],
	}),
	vault: one(vaults, {
		fields: [notifications.vaultId],
		references: [vaults.id],
	}),
}));
