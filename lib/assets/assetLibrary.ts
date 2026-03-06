/**
 * Asset Library — persistent model library with deterministic selection.
 *
 * Manages the model_library database table and provides:
 * - Search by name, category, or tags
 * - Deterministic model selection via seeded hash
 * - Usage tracking for least-used selection
 * - Cache rules (max 3 models per object name)
 *
 * Server-only — uses database client for persistence.
 */

import { v4 as uuidv4 } from "uuid";
import type { ModelLibraryEntry, ModelLibrarySource, ModelProvider } from "@/types/assets";
import {
  insertModelLibraryEntry,
  searchModelLibrary,
  getModelCountByName,
  incrementModelUsage,
} from "@/database/client";

// ─── Constants ──────────────────────────────────────────────────────────────

/** Maximum models to store per object name. Beyond this, reuse existing. */
export const MAX_MODELS_PER_NAME = 3;

// ─── FNV-1a hash (deterministic, same as project's seed hash) ───────────────

function fnv1a(str: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

// ─── DB row → ModelLibraryEntry conversion ──────────────────────────────────

function rowToEntry(row: Record<string, unknown>): ModelLibraryEntry {
  return {
    id: row.id as string,
    name: row.name as string,
    tags: typeof row.tags === "string" ? JSON.parse(row.tags) : (row.tags as string[]),
    category: row.category as string,
    modelUrl: row.model_url as string,
    source: row.source as ModelLibrarySource,
    provider: (row.provider as ModelProvider) || null,
    sizeBytes: Number(row.size_bytes) || 0,
    usageCount: Number(row.usage_count) || 0,
    createdAt: row.created_at as string,
    updatedAt: row.updated_at as string,
  };
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Search the model library for entries matching the given criteria.
 * Returns entries sorted by usage_count ASC (least-used first).
 */
export async function findModels(opts: {
  name?: string;
  category?: string;
  tags?: string[];
}): Promise<ModelLibraryEntry[]> {
  const rows = await searchModelLibrary(opts);
  const entries = rows.map(rowToEntry);

  // If tags were provided, filter by tag overlap
  if (opts.tags && opts.tags.length > 0) {
    const searchTags = new Set(opts.tags.map((t) => t.toLowerCase()));
    return entries.filter((e) =>
      e.tags.some((t) => searchTags.has(t.toLowerCase()))
    );
  }

  return entries;
}

/**
 * Check how many models exist in the library for a given object name.
 */
export async function getModelCount(name: string): Promise<number> {
  return getModelCountByName(name);
}

/**
 * Determine whether a new model should be generated for this name.
 * Returns true if fewer than MAX_MODELS_PER_NAME exist.
 */
export async function shouldGenerateModel(name: string): Promise<boolean> {
  const count = await getModelCount(name);
  return count < MAX_MODELS_PER_NAME;
}

/**
 * Select a model deterministically from a list using a seeded hash.
 * Same seed + same models → same selection, always.
 *
 * If preferLeastUsed is true, narrows to least-used models first.
 */
export function selectModelDeterministic(
  models: ModelLibraryEntry[],
  seed: string,
  preferLeastUsed = true,
): ModelLibraryEntry {
  if (models.length === 0) {
    throw new Error("selectModelDeterministic called with empty list");
  }
  if (models.length === 1) return models[0];

  let candidates = models;

  // Prefer least-used models to distribute usage
  if (preferLeastUsed) {
    const minUsage = Math.min(...models.map((m) => m.usageCount));
    const leastUsed = models.filter((m) => m.usageCount === minUsage);
    if (leastUsed.length > 0) {
      candidates = leastUsed;
    }
  }

  const hash = fnv1a(seed);
  const index = hash % candidates.length;
  return candidates[index];
}

/**
 * Record a model's usage (increment counter).
 */
export async function recordModelUsage(id: string): Promise<void> {
  await incrementModelUsage(id);
}

/**
 * Store a new model in the library.
 */
export async function storeModel(opts: {
  name: string;
  tags: string[];
  category: string;
  modelUrl: string;
  source: ModelLibrarySource;
  provider: ModelProvider | null;
  sizeBytes: number;
}): Promise<ModelLibraryEntry> {
  const now = new Date().toISOString();
  const entry: ModelLibraryEntry = {
    id: uuidv4(),
    name: opts.name.toLowerCase(),
    tags: opts.tags.map((t) => t.toLowerCase()),
    category: opts.category.toLowerCase(),
    modelUrl: opts.modelUrl,
    source: opts.source,
    provider: opts.provider,
    sizeBytes: opts.sizeBytes,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  await insertModelLibraryEntry({
    id: entry.id,
    name: entry.name,
    tags: JSON.stringify(entry.tags),
    category: entry.category,
    model_url: entry.modelUrl,
    source: entry.source,
    provider: entry.provider,
    size_bytes: entry.sizeBytes,
    usage_count: 0,
    created_at: now,
    updated_at: now,
  });

  return entry;
}
