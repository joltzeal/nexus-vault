import { jsonb, pgTable, text, uniqueIndex } from "drizzle-orm/pg-core";

import { user as users } from "../auth-schema";
import { createdAt, id, updatedAt } from "./columns";

export type UserIntegrationSettingsData = {
	xCom?: {
		cookieString?: string;
		updatedAt?: string;
	};
};

export const userIntegrationSettings = pgTable(
	"user_integration_settings",
	{
		id: id(),
		userId: text("user_id")
			.notNull()
			.references(() => users.id, { onDelete: "cascade" }),
		dataJson: jsonb("data_json").$type<UserIntegrationSettingsData>().notNull().default({}),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(table) => [uniqueIndex("user_integration_settings_user_unique").on(table.userId)],
);
