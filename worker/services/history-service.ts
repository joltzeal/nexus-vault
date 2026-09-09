import { and, desc, eq, ilike, inArray, lt, or, sql } from "drizzle-orm";
import { history } from "../db/schema";
import type { JsonObject } from "../db/core/enums";
import type { Actor, Db } from "../types/legacy-api";
import { newId } from "../lib/id";

export type HistoryEntity = "vault" | "space" | "resource" | "stash";
export type HistoryAction = "create" | "add" | "update" | "move" | "copy" | "delete" | "reorder" | "metadata";
export type HistoryStatus = "success" | "failed";

export async function recordHistory(
  db: Pick<Db, "insert">,
  input: {
    actor: Pick<Actor, "id">;
    entityType: HistoryEntity;
    action: HistoryAction;
    status?: HistoryStatus;
    entityId: string;
    entityLabel?: string;
    vaultId?: string | null;
    spaceId?: string | null;
    source?: JsonObject;
    target?: JsonObject;
    details?: JsonObject;
  },
) {
  await db.insert(history).values({
    id: newId(),
    actorId: input.actor.id,
    entityType: input.entityType,
    action: input.action,
    status: input.status ?? "success",
    entityId: input.entityId,
    entityLabel: input.entityLabel ?? "",
    vaultId: input.vaultId ?? null,
    spaceId: input.spaceId ?? null,
    sourceJson: input.source ?? {},
    targetJson: input.target ?? {},
    detailsJson: input.details ?? {},
  });
}

type Cursor = { createdAt: string; id: string };

function encodeCursor(cursor: Cursor) {
  return btoa(JSON.stringify(cursor)).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decodeCursor(value?: string): Cursor | null {
  if (!value) return null;
  try {
    const padded = value.replaceAll("-", "+").replaceAll("_", "/").padEnd(Math.ceil(value.length / 4) * 4, "=");
    const parsed = JSON.parse(atob(padded)) as Partial<Cursor>;
    return typeof parsed.createdAt === "string" && typeof parsed.id === "string"
      ? { createdAt: parsed.createdAt, id: parsed.id }
      : null;
  } catch {
    return null;
  }
}

export async function listHistory(
  db: Db,
  input: {
    actor: Actor;
    cursor?: string;
    limit?: number;
    entityTypes?: string[];
    actions?: string[];
    statuses?: string[];
    vaultId?: string;
    query?: string;
    from?: string;
    to?: string;
  },
) {
  const limit = Math.min(Math.max(input.limit ?? 10, 1), 10);
  const cursor = decodeCursor(input.cursor);
  const filters = [
    eq(history.actorId, input.actor.id),
    input.entityTypes?.length ? inArray(history.entityType, input.entityTypes) : undefined,
    input.actions?.length ? inArray(history.action, input.actions) : undefined,
    input.statuses?.length ? inArray(history.status, input.statuses) : undefined,
    input.vaultId ? eq(history.vaultId, input.vaultId) : undefined,
    input.query ? ilike(history.entityLabel, `%${input.query}%`) : undefined,
    input.from ? sql`${history.createdAt} >= ${input.from}` : undefined,
    input.to ? sql`${history.createdAt} <= ${input.to}` : undefined,
    cursor
      ? or(
          lt(history.createdAt, cursor.createdAt),
          and(eq(history.createdAt, cursor.createdAt), lt(history.id, cursor.id)),
        )
      : undefined,
  ].filter(Boolean);

  const rows = await db
    .select()
    .from(history)
    .where(and(...filters))
    .orderBy(desc(history.createdAt), desc(history.id))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const items = rows.slice(0, limit).map((row) => ({
    id: row.id,
    actorId: row.actorId,
    entityType: row.entityType,
    action: row.action,
    status: row.status,
    entityId: row.entityId,
    entityLabel: row.entityLabel,
    vaultId: row.vaultId,
    spaceId: row.spaceId,
    source: row.sourceJson,
    target: row.targetJson,
    details: row.detailsJson,
    createdAt: row.createdAt,
  }));

  const last = rows[limit - 1];
  return {
    items,
    hasMore,
    nextCursor: hasMore && last ? encodeCursor({ createdAt: last.createdAt, id: last.id }) : null,
  };
}
