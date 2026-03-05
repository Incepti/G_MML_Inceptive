import { neon } from "@neondatabase/serverless";

export const CREATE_PROJECTS_TABLE = `
CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  mode TEXT NOT NULL DEFAULT 'static',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_url TEXT,
  published_at TEXT,
  published_type TEXT
);
`;

export const CREATE_PROJECT_FILES_TABLE = `
CREATE TABLE IF NOT EXISTS project_files (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  updated_at TEXT NOT NULL
);
`;

export const CREATE_PROJECT_VERSIONS_TABLE = `
CREATE TABLE IF NOT EXISTS project_versions (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  version INTEGER NOT NULL,
  snapshot TEXT NOT NULL,
  note TEXT,
  created_at TEXT NOT NULL
);
`;

export const CREATE_ASSET_MANIFEST_TABLE = `
CREATE TABLE IF NOT EXISTS asset_manifest (
  id TEXT PRIMARY KEY,
  project_id TEXT,
  url TEXT NOT NULL,
  source TEXT NOT NULL,
  validated BOOLEAN NOT NULL DEFAULT false,
  validated_at TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  mime_type TEXT NOT NULL,
  name TEXT NOT NULL,
  license TEXT,
  preview_url TEXT,
  checksum TEXT,
  created_at TEXT NOT NULL
);
`;

export const CREATE_UPLOADS_TABLE = `
CREATE TABLE IF NOT EXISTS uploads (
  id TEXT PRIMARY KEY,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  url TEXT NOT NULL,
  mime_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  preview_url TEXT,
  created_at TEXT NOT NULL
);
`;

export const CREATE_ASSET_REGISTRY_TABLE = `
CREATE TABLE IF NOT EXISTS asset_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT NOT NULL,
  source TEXT NOT NULL,
  license TEXT NOT NULL,
  local_url TEXT NOT NULL,
  source_url TEXT,
  preview_url TEXT,
  poly_count INTEGER,
  mime_type TEXT,
  size_bytes INTEGER,
  created_at TEXT NOT NULL
);
`;

export const CREATE_FETCH_CACHE_TABLE = `
CREATE TABLE IF NOT EXISTS fetch_cache (
  url TEXT PRIMARY KEY,
  body TEXT NOT NULL,
  hash TEXT NOT NULL,
  stored_at TEXT NOT NULL
);
`;

const ALL_TABLES = [
  CREATE_PROJECTS_TABLE,
  CREATE_PROJECT_FILES_TABLE,
  CREATE_PROJECT_VERSIONS_TABLE,
  CREATE_ASSET_MANIFEST_TABLE,
  CREATE_UPLOADS_TABLE,
  CREATE_ASSET_REGISTRY_TABLE,
  CREATE_FETCH_CACHE_TABLE,
];

export async function runMigrations() {
  const sql = neon(process.env.DATABASE_URL!);
  for (const ddl of ALL_TABLES) {
    await sql.query(ddl);
  }
  console.log("Migrations complete.");
}
