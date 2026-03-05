import { neon, NeonQueryFunction } from "@neondatabase/serverless";

let _sql: NeonQueryFunction<false, false> | null = null;

function getSQL() {
  if (_sql) return _sql;
  _sql = neon(process.env.DATABASE_URL!);
  return _sql;
}

// ─── Project CRUD ─────────────────────────────────────────────────────────

export async function createProject(project: {
  id: string;
  name: string;
  description: string | null;
  mode: string;
  created_at: string;
  updated_at: string;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO projects (id, name, description, mode, created_at, updated_at)
    VALUES (${project.id}, ${project.name}, ${project.description}, ${project.mode}, ${project.created_at}, ${project.updated_at})
  `;
  return project;
}

export async function getProject(id: string) {
  const sql = getSQL();
  const projects = await sql`SELECT * FROM projects WHERE id = ${id}`;
  if (projects.length === 0) return null;

  const files = await sql`SELECT * FROM project_files WHERE project_id = ${id} ORDER BY name`;
  const versions = await sql`SELECT * FROM project_versions WHERE project_id = ${id} ORDER BY version DESC`;
  const manifest = await sql`SELECT * FROM asset_manifest WHERE project_id = ${id}`;

  return { ...projects[0], files, versions, manifest };
}

export async function listProjects() {
  const sql = getSQL();
  return sql`SELECT * FROM projects ORDER BY updated_at DESC`;
}

export async function updateProject(
  id: string,
  updates: Record<string, unknown>
) {
  const sql = getSQL();
  const keys = Object.keys(updates);
  if (keys.length === 0) return;

  // Build SET clause with positional params
  const setClauses = keys.map((k, i) => `${k} = $${i + 1}`).join(", ");
  const values = keys.map((k) => updates[k]);
  await sql.query(
    `UPDATE projects SET ${setClauses} WHERE id = $${keys.length + 1}`,
    [...values, id]
  );
}

export async function deleteProject(id: string) {
  const sql = getSQL();
  await sql`DELETE FROM projects WHERE id = ${id}`;
}

// ─── File CRUD ────────────────────────────────────────────────────────────

export async function upsertFile(file: {
  id: string;
  project_id: string;
  name: string;
  type: string;
  content: string;
  updated_at: string;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO project_files (id, project_id, name, type, content, updated_at)
    VALUES (${file.id}, ${file.project_id}, ${file.name}, ${file.type}, ${file.content}, ${file.updated_at})
    ON CONFLICT(id) DO UPDATE SET
      content = EXCLUDED.content,
      updated_at = EXCLUDED.updated_at
  `;
}

// ─── Version CRUD ─────────────────────────────────────────────────────────

export async function saveVersion(version: {
  id: string;
  project_id: string;
  version: number;
  snapshot: string;
  note: string;
  created_at: string;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO project_versions (id, project_id, version, snapshot, note, created_at)
    VALUES (${version.id}, ${version.project_id}, ${version.version}, ${version.snapshot}, ${version.note}, ${version.created_at})
  `;
}

export async function getVersionCount(projectId: string): Promise<number> {
  const sql = getSQL();
  const rows = await sql`SELECT COUNT(*) as count FROM project_versions WHERE project_id = ${projectId}`;
  return Number(rows[0].count);
}

// ─── Asset Manifest ───────────────────────────────────────────────────────

export async function upsertAsset(asset: {
  id: string;
  project_id: string;
  url: string;
  source: string;
  validated: boolean | number;
  validated_at: string;
  size_bytes: number;
  mime_type: string;
  name: string;
  license: string | null;
  preview_url: string | null;
  checksum: string | null;
  created_at: string;
}) {
  const sql = getSQL();
  const validated = Boolean(asset.validated);
  await sql`
    INSERT INTO asset_manifest (
      id, project_id, url, source, validated, validated_at,
      size_bytes, mime_type, name, license, preview_url, checksum, created_at
    )
    VALUES (
      ${asset.id}, ${asset.project_id}, ${asset.url}, ${asset.source}, ${validated}, ${asset.validated_at},
      ${asset.size_bytes}, ${asset.mime_type}, ${asset.name}, ${asset.license}, ${asset.preview_url}, ${asset.checksum}, ${asset.created_at}
    )
    ON CONFLICT(id) DO UPDATE SET
      validated = EXCLUDED.validated,
      validated_at = EXCLUDED.validated_at
  `;
}

export async function getProjectManifest(projectId: string) {
  const sql = getSQL();
  return sql`SELECT * FROM asset_manifest WHERE project_id = ${projectId}`;
}

// ─── Upload record ────────────────────────────────────────────────────────

export async function recordUpload(upload: {
  id: string;
  filename: string;
  original_name: string;
  url: string;
  mime_type: string;
  size_bytes: number;
  preview_url: string | null;
  created_at: string;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO uploads (id, filename, original_name, url, mime_type, size_bytes, preview_url, created_at)
    VALUES (${upload.id}, ${upload.filename}, ${upload.original_name}, ${upload.url}, ${upload.mime_type}, ${upload.size_bytes}, ${upload.preview_url}, ${upload.created_at})
  `;
}

// ─── Asset Registry ─────────────────────────────────────────────────────

export async function upsertRegistryAsset(asset: {
  id: string;
  name: string;
  category: string;
  source: string;
  license: string;
  local_url: string;
  source_url: string | null;
  preview_url: string | null;
  poly_count: number | null;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}) {
  const sql = getSQL();
  await sql`
    INSERT INTO asset_registry (
      id, name, category, source, license, local_url, source_url,
      preview_url, poly_count, mime_type, size_bytes, created_at
    )
    VALUES (
      ${asset.id}, ${asset.name}, ${asset.category}, ${asset.source}, ${asset.license}, ${asset.local_url}, ${asset.source_url},
      ${asset.preview_url}, ${asset.poly_count}, ${asset.mime_type}, ${asset.size_bytes}, ${asset.created_at}
    )
    ON CONFLICT(id) DO UPDATE SET
      name = EXCLUDED.name,
      category = EXCLUDED.category,
      source = EXCLUDED.source,
      license = EXCLUDED.license,
      local_url = EXCLUDED.local_url,
      source_url = EXCLUDED.source_url,
      preview_url = EXCLUDED.preview_url,
      poly_count = EXCLUDED.poly_count,
      mime_type = EXCLUDED.mime_type,
      size_bytes = EXCLUDED.size_bytes
  `;
}

export async function getRegistryAssetById(id: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM asset_registry WHERE id = ${id}`;
  return rows[0] ?? null;
}

export async function getRegistryAssetByUrl(url: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM asset_registry WHERE local_url = ${url}`;
  return rows[0] ?? null;
}

export async function searchRegistryAssets({
  query = "",
  category = "",
  page = 1,
  pageSize = 20,
}: {
  query?: string;
  category?: string;
  page?: number;
  pageSize?: number;
}) {
  const sql = getSQL();
  const q = `%${query}%`;
  const offset = (page - 1) * pageSize;

  let total: number;
  let assets: Record<string, unknown>[];

  if (query && category && category !== "all") {
    const countRows = await sql`
      SELECT COUNT(*) as count FROM asset_registry
      WHERE (name LIKE ${q} OR category LIKE ${q} OR source LIKE ${q})
      AND category = ${category}
    `;
    total = Number(countRows[0].count);
    assets = await sql`
      SELECT * FROM asset_registry
      WHERE (name LIKE ${q} OR category LIKE ${q} OR source LIKE ${q})
      AND category = ${category}
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}
    `;
  } else if (query) {
    const countRows = await sql`
      SELECT COUNT(*) as count FROM asset_registry
      WHERE (name LIKE ${q} OR category LIKE ${q} OR source LIKE ${q})
    `;
    total = Number(countRows[0].count);
    assets = await sql`
      SELECT * FROM asset_registry
      WHERE (name LIKE ${q} OR category LIKE ${q} OR source LIKE ${q})
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}
    `;
  } else if (category && category !== "all") {
    const countRows = await sql`
      SELECT COUNT(*) as count FROM asset_registry
      WHERE category = ${category}
    `;
    total = Number(countRows[0].count);
    assets = await sql`
      SELECT * FROM asset_registry
      WHERE category = ${category}
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}
    `;
  } else {
    const countRows = await sql`SELECT COUNT(*) as count FROM asset_registry`;
    total = Number(countRows[0].count);
    assets = await sql`
      SELECT * FROM asset_registry
      ORDER BY created_at DESC LIMIT ${pageSize} OFFSET ${offset}
    `;
  }

  return { assets, total };
}

// ─── Fetch Cache (used by sandbox runtime) ────────────────────────────────

export async function getCachedFetch(url: string) {
  const sql = getSQL();
  const rows = await sql`SELECT * FROM fetch_cache WHERE url = ${url}`;
  return rows[0] ?? null;
}

export async function setCachedFetch(url: string, body: string, hash: string) {
  const sql = getSQL();
  await sql`
    INSERT INTO fetch_cache (url, body, hash, stored_at)
    VALUES (${url}, ${body}, ${hash}, ${new Date().toISOString()})
    ON CONFLICT(url) DO UPDATE SET
      body = EXCLUDED.body,
      hash = EXCLUDED.hash,
      stored_at = EXCLUDED.stored_at
  `;
}
