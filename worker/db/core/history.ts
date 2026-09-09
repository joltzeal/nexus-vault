import { index, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { user as users } from "../../auth/schema";
import { createdAt, id } from "./columns";
import type { JsonObject } from "./enums";

export const history = pgTable(
  "history",
  {
    id: id(),
    actorId: text("actor_id").references(() => users.id, { onDelete: "set null" }),
    entityType: text("entity_type").notNull(),
    action: text("action").notNull(),
    status: text("status").notNull().default("success"),
    entityId: text("entity_id").notNull(),
    entityLabel: text("entity_label").notNull().default(""),
    vaultId: uuid("vault_id"),
    spaceId: uuid("space_id"),
    sourceJson: jsonb("source_json").$type<JsonObject>().notNull().default({}),
    targetJson: jsonb("target_json").$type<JsonObject>().notNull().default({}),
    detailsJson: jsonb("details_json").$type<JsonObject>().notNull().default({}),
    createdAt: createdAt(),
  },
  (table) => [
    index("history_actor_created_idx").on(table.actorId, table.createdAt, table.id),
    index("history_actor_entity_created_idx").on(table.actorId, table.entityType, table.createdAt),
    index("history_actor_action_created_idx").on(table.actorId, table.action, table.createdAt),
    index("history_actor_vault_created_idx").on(table.actorId, table.vaultId, table.createdAt),
  ],
);
