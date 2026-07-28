import { timestamp, uuid } from "drizzle-orm/pg-core";

export const id = () => uuid("id").defaultRandom().primaryKey();

export const createdAt = () => timestamp("created_at", { withTimezone: true, mode: "string" }).notNull().defaultNow();

export const updatedAt = () =>
	timestamp("updated_at", { withTimezone: true, mode: "string" })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date().toISOString());

export const deletedAt = () => timestamp("deleted_at", { withTimezone: true, mode: "string" });

export const optionalTimestamp = (name: string) => timestamp(name, { withTimezone: true, mode: "string" });
