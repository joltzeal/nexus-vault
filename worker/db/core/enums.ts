import { pgEnum } from "drizzle-orm/pg-core";

export type JsonObject = Record<string, unknown>;

export const vaultVisibilityValues = ["public", "private", "password"] as const;
export const resourceTypeValues = [
	"magnet",
	"twitter",
	"telegram",
	"douyin",
	"wechat_mp",
	"gofile",
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
	"ftp",
	"http",
	"youtube",
	"local_media",
	"other",
] as const;
export const metadataStatusValues = ["pending", "processing", "completed", "failed"] as const;
export const submissionStatusValues = ["pending", "approved", "rejected"] as const;
export const collaboratorRoleValues = ["editor"] as const;
export const vaultWatchLevelValues = ["all", "updates", "none"] as const;

export const vaultVisibilityEnum = pgEnum("vault_visibility", vaultVisibilityValues);
export const resourceTypeEnum = pgEnum("resource_type", resourceTypeValues);
export const metadataStatusEnum = pgEnum("metadata_status", metadataStatusValues);
export const submissionStatusEnum = pgEnum("submission_status", submissionStatusValues);
export const collaboratorRoleEnum = pgEnum("collaborator_role", collaboratorRoleValues);
export const vaultWatchLevelEnum = pgEnum("vault_watch_level", vaultWatchLevelValues);
