import { readFileSync } from "node:fs"

import postgres from "postgres"

function readDevVars(): Record<string, string> {
  try {
    return Object.fromEntries(
      readFileSync(".dev.vars", "utf8")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter((line) => line && !line.startsWith("#"))
        .map((line) => {
          const [key, ...value] = line.split("=")
          return [key, value.join("=").replace(/\s+#.*$/, "")]
        }),
    )
  } catch {
    return {}
  }
}

const databaseUrl = process.env.DATABASE_URL ?? readDevVars().DATABASE_URL

if (!databaseUrl) {
  throw new Error("DATABASE_URL is required.")
}

const sql = postgres(databaseUrl, { max: 1 })

const repairSql = `
create or replace function pg_temp.nv_repair_media_without_cover(data jsonb)
returns jsonb
language sql
stable
as $$
  with media_items as (
    select item, ordinality
    from jsonb_array_elements(
      case
        when jsonb_typeof(data->'media') = 'array' then data->'media'
        else '[]'::jsonb
      end
    ) with ordinality as media(item, ordinality)
    where item->>'sourceId' is distinct from 'cover'
  ),
  ranked as (
    select
      item,
      ordinality,
      case
        when item->>'sourceId' ~ '^screenshot:[0-9]+$'
          then substring(item->>'sourceId' from 12)::int
        when item->>'sourceId' ~ '^photo:[0-9]+$'
          then substring(item->>'sourceId' from 7)::int
        when item->>'sourceId' ~ '^video:[0-9]+$'
          then substring(item->>'sourceId' from 7)::int
        else ordinality::int
      end as sort_index
    from media_items
  ),
  rebuilt as (
    select coalesce(jsonb_agg(item order by sort_index, ordinality), '[]'::jsonb) as media
    from ranked
  )
  select case
    when jsonb_array_length(rebuilt.media) > 0
      then (data - 'cover' - 'screenshots') || jsonb_build_object('media', rebuilt.media)
    else data - 'cover' - 'screenshots' - 'media'
  end
  from rebuilt
$$;

update resource_metadata
set data_json = pg_temp.nv_repair_media_without_cover(data_json),
    updated_at = now()
where data_json ? 'media'
   or data_json ? 'cover'
   or data_json ? 'screenshots';

update starred_resources
set metadata_data_json = pg_temp.nv_repair_media_without_cover(metadata_data_json)
where metadata_data_json ? 'media'
   or metadata_data_json ? 'cover'
   or metadata_data_json ? 'screenshots';

update resource_submissions
set metadata_json = pg_temp.nv_repair_media_without_cover(metadata_json),
    updated_at = now()
where metadata_json ? 'media'
   or metadata_json ? 'cover'
   or metadata_json ? 'screenshots';
`

const verificationSql = `
select
  'resource_metadata' as table_name,
  count(*)::int as total,
  count(*) filter (
    where data_json->'media' @> '[{"sourceId":"cover"}]'::jsonb
  )::int as with_cover_media
from resource_metadata
union all
select
  'starred_resources' as table_name,
  count(*)::int as total,
  count(*) filter (
    where metadata_data_json->'media' @> '[{"sourceId":"cover"}]'::jsonb
  )::int as with_cover_media
from starred_resources
union all
select
  'resource_submissions' as table_name,
  count(*)::int as total,
  count(*) filter (
    where metadata_json->'media' @> '[{"sourceId":"cover"}]'::jsonb
  )::int as with_cover_media
from resource_submissions
`

async function main() {
  try {
    await sql.begin(async (tx) => {
      await tx.unsafe(repairSql)
    })
    const verification = await sql.unsafe(verificationSql)
    console.log(JSON.stringify(verification, null, 2))
  } finally {
    await sql.end()
  }
}

void main()
