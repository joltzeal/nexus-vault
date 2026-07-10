import { spawn } from "node:child_process"
import { tmpdir } from "node:os"
import { writeFile } from "node:fs/promises"
import { join } from "node:path"

const sql = `
INSERT OR IGNORE INTO users (id, email, name)
VALUES ('seed_user', 'seed@nexusvault.local', 'Seed User');

INSERT OR IGNORE INTO vaults (
  id, title, description, visibility, owner_id, star_count, fork_count
) VALUES (
  'seed_vault',
  'NexusVault Seed Vault',
  'Local seed vault for development and UI verification.',
  'private',
  'seed_user',
  1,
  0
);

INSERT OR IGNORE INTO collaborators (id, vault_id, user_id, role)
VALUES ('seed_collaborator_owner', 'seed_vault', 'seed_user', 'owner');

INSERT OR IGNORE INTO spaces (id, vault_id, name, description, position)
VALUES
  ('seed_space_movies', 'seed_vault', '电影', 'Movie resources', 0),
  ('seed_space_courses', 'seed_vault', '教程', 'Course resources', 1);

INSERT OR IGNORE INTO resources (
  id, vault_id, space_id, type, title, description, url, metadata_status, position, created_by
) VALUES
  (
    'seed_resource_magnet',
    'seed_vault',
    'seed_space_movies',
    'magnet',
    '名称未知',
    'Seed magnet resource.',
    'magnet:?xt=urn:btih:0123456789abcdef0123456789abcdef01234567&dn=NexusVault%20Seed',
    'completed',
    0,
    'seed_user'
  ),
  (
    'seed_resource_http',
    'seed_vault',
    'seed_space_courses',
    'http',
    'Cloudflare Workers Docs',
    'Seed HTTP resource.',
    'https://developers.cloudflare.com/workers/',
    'completed',
    0,
    'seed_user'
  );

INSERT OR IGNORE INTO resource_metadata (
  resource_id, provider, status, data_json
) VALUES
  (
    'seed_resource_magnet',
    'seed',
    'completed',
    '{"schemaVersion":1,"type":"magnet","title":"NexusVault Seed","size":1073741824,"fileCount":3,"fileType":"video","screenshots":[],"tree":[],"identifiers":{"infoHash":"0123456789abcdef0123456789abcdef01234567"},"source":{"name":"seed"},"fetchedAt":"2026-06-08T00:00:00.000Z"}'
  ),
  (
    'seed_resource_http',
    'seed',
    'completed',
    '{"schemaVersion":1,"type":"http","title":"Cloudflare Workers Docs","tree":[],"source":{"name":"seed"},"fetchedAt":"2026-06-08T00:00:00.000Z"}'
  );

INSERT OR IGNORE INTO comments (
  id, vault_id, resource_id, parent_id, author_id, author_name, body
) VALUES
  (
    'seed_comment_root',
    'seed_vault',
    'seed_resource_magnet',
    NULL,
    'seed_user',
    'Seed User',
    '这是一条本地 seed 评论。'
  );

INSERT OR IGNORE INTO stars (id, vault_id, user_id)
VALUES ('seed_star', 'seed_vault', 'seed_user');
`

async function main() {
  const sqlFile = join(tmpdir(), "nexus-vault-seed-local.sql")
  await writeFile(sqlFile, sql)

  await run("wrangler", [
    "d1",
    "execute",
    "nexus-vault-local",
    "--local",
    "--file",
    sqlFile,
  ])
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: new URL("../apps/frontend", import.meta.url),
      stdio: "inherit",
      shell: false,
    })

    child.on("error", reject)
    child.on("exit", (code) => {
      if (code === 0) resolve()
      else reject(new Error(`${command} exited with code ${code}`))
    })
  })
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
