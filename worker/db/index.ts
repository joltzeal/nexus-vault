import { Client } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";

import * as schema from "./schema";

export async function createDb(env: Env) {
  const client = new Client({
    connectionString: env.HYPERDRIVE.connectionString,
  });

  await client.connect();

  const db = drizzle(client, {
    schema,
  });

  return {
    db,
    client,
  };
}

/** Transitional session shape for services migrated from the previous runtime. */
export async function createDbSession(env: Env) {
  const session = await createDb(env);
  return {
    ...session,
    close: () => session.client.end(),
  };
}
