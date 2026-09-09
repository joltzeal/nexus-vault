import { handleApiRequest, ok, requireActor } from "../../../lib/http";
import { listHistory } from "../../../services/history-service";

function listParam(value: string | null) {
  return value?.split(",").map((item) => item.trim()).filter(Boolean);
}

export function GET(request: Request) {
  return handleApiRequest(request, {}, async ({ actor, db, url }) =>
    ok(await listHistory(db, {
      actor: requireActor(actor),
      cursor: url.searchParams.get("cursor") ?? undefined,
      limit: Number(url.searchParams.get("limit") ?? 20),
      entityTypes: listParam(url.searchParams.get("entity")),
      actions: listParam(url.searchParams.get("action")),
      statuses: listParam(url.searchParams.get("status")),
      vaultId: url.searchParams.get("vaultId") ?? undefined,
      query: url.searchParams.get("q")?.trim() || undefined,
      from: url.searchParams.get("from") ?? undefined,
      to: url.searchParams.get("to") ?? undefined,
    })),
  );
}
