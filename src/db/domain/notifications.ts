import { index, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user as users } from "../auth-schema";
import { createdAt, id, optionalTimestamp } from "./columns";
import { vaults } from "./vaults";

export const notifications = pgTable(
	"notifications",
	{
		id: id(),
		userId: text("user_id").references(() => users.id, { onDelete: "cascade" }),
		vaultId: uuid("vault_id").references(() => vaults.id, { onDelete: "cascade" }),
		type: text("type").notNull(),
		title: text("title").notNull(),
		body: text("body").notNull().default(""),
		readAt: optionalTimestamp("read_at"),
		createdAt: createdAt(),
	},
	(table) => [
		index("notifications_user_read_created_idx").on(table.userId, table.readAt, table.createdAt),
		index("notifications_user_created_idx").on(table.userId, table.createdAt),
	],
);
