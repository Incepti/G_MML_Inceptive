/**
 * Generate environment-catalog.ts from GCS bucket listing.
 * Run: node scripts/generate-catalog.js
 */
const fs = require("fs");
const path = require("path");

const GCS_BASE = "https://storage.googleapis.com/3dmodels_mml";
const FOLDER_TO_CATEGORY = {
  animals: "character",
  art_decor: "prop",
  buildings: "structure",
  characters: "character",
  city_objects: "prop",
  electronics: "prop",
  environment: "environment",
  food: "prop",
  furniture: "furniture",
  props: "prop",
  vehicles: "vehicle",
};

function nameToTags(filename, folder) {
  const base = filename.replace(".glb", "");
  const clean = base.replace(/_[0-9a-f]{5}$/i, "").replace(/_0[1-9]$/, "");
  const words = clean.split(/[_-]+/).filter((w) => w.length > 1);
  return [...new Set([...words, folder])].map((t) => t.toLowerCase());
}

function nameToDisplayName(filename) {
  const base = filename.replace(".glb", "");
  const clean = base.replace(/_[0-9a-f]{5}$/i, "").replace(/_0[1-9]$/, "");
  return clean
    .split(/[_-]+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

async function listAll() {
  let token = "";
  const all = [];
  do {
    const url =
      "https://storage.googleapis.com/storage/v1/b/3dmodels_mml/o?maxResults=500" +
      (token ? "&pageToken=" + token : "");
    const r = await fetch(url);
    const d = await r.json();
    if (d.items) all.push(...d.items);
    token = d.nextPageToken || "";
  } while (token);
  return all;
}

async function main() {
  console.log("Fetching bucket listing...");
  const items = await listAll();

  const entries = [];
  for (const item of items) {
    const parts = item.name.split("/");
    if (parts.length < 2) continue;
    const folder = parts[0];
    const filename = parts[1];
    if (!filename || !filename.endsWith(".glb")) continue;

    entries.push({
      id: filename.replace(".glb", ""),
      name: nameToDisplayName(filename),
      category: FOLDER_TO_CATEGORY[folder] || "prop",
      url: GCS_BASE + "/" + item.name,
      tags: nameToTags(filename, folder),
      folder,
    });
  }

  console.log("Total models:", entries.length);

  // Build TypeScript file
  const lines = [];
  lines.push('/**');
  lines.push(' * Environment Asset Catalog — GCS Bucket (3dmodels_mml)');
  lines.push(' *');
  lines.push(' * ' + entries.length + ' verified GLB models across 11 categories.');
  lines.push(' * Source: gs://3dmodels_mml — Inceptive Studio GCS bucket.');
  lines.push(' *');
  lines.push(' * STRICT RULE: ALWAYS use 3D models from this catalog.');
  lines.push(' * NEVER fall back to primitives unless user explicitly requests them.');
  lines.push(' * NO other external model sources allowed.');
  lines.push(' *');
  lines.push(' * URL pattern: https://storage.googleapis.com/3dmodels_mml/{category}/{file}.glb');
  lines.push(' * Auto-generated from bucket listing on 2026-03-07.');
  lines.push(' */');
  lines.push('');
  lines.push('export interface EnvironmentAsset {');
  lines.push('  id: string;');
  lines.push('  name: string;');
  lines.push('  category: "structure" | "prop" | "furniture" | "lighting" | "environment" | "vehicle" | "character";');
  lines.push('  modelUrl: string;');
  lines.push('  defaultScale: number;');
  lines.push('  tags: string[];');
  lines.push('  description: string;');
  lines.push('}');
  lines.push('');
  lines.push('export const GCS_BASE = "' + GCS_BASE + '";');
  lines.push('');
  lines.push('const GCS_ASSETS: EnvironmentAsset[] = [');

  for (const e of entries) {
    const desc = e.name + " (" + e.folder + ")";
    lines.push(
      "  { id: " + JSON.stringify(e.id) +
      ", name: " + JSON.stringify(e.name) +
      ", category: " + JSON.stringify(e.category) +
      ", modelUrl: " + JSON.stringify(e.url) +
      ", defaultScale: 1, tags: " + JSON.stringify(e.tags) +
      ", description: " + JSON.stringify(desc) +
      " },"
    );
  }

  lines.push('];');
  lines.push('');
  lines.push('// Full catalog');
  lines.push('export const ENVIRONMENT_CATALOG: EnvironmentAsset[] = [...GCS_ASSETS];');
  lines.push('');
  lines.push('// Lookup helpers');
  lines.push('');
  lines.push('export function getEnvironmentAsset(id: string): EnvironmentAsset | undefined {');
  lines.push('  return ENVIRONMENT_CATALOG.find((a) => a.id === id);');
  lines.push('}');
  lines.push('');
  lines.push('export function getAssetsByCategory(category: EnvironmentAsset["category"]): EnvironmentAsset[] {');
  lines.push('  return ENVIRONMENT_CATALOG.filter((a) => a.category === category);');
  lines.push('}');
  lines.push('');
  lines.push('export function getAssetsByTag(tag: string): EnvironmentAsset[] {');
  lines.push('  return ENVIRONMENT_CATALOG.filter((a) => a.tags.includes(tag.toLowerCase()));');
  lines.push('}');
  lines.push('');
  lines.push('export function searchEnvironmentAssets(query: string): EnvironmentAsset[] {');
  lines.push('  const q = query.toLowerCase();');
  lines.push('  return ENVIRONMENT_CATALOG.filter(');
  lines.push('    (a) =>');
  lines.push('      a.name.toLowerCase().includes(q) ||');
  lines.push('      a.description.toLowerCase().includes(q) ||');
  lines.push('      a.tags.some((t) => t.includes(q)) ||');
  lines.push('      a.category.includes(q)');
  lines.push('  );');
  lines.push('}');
  lines.push('');
  lines.push('export function buildEnvironmentCatalogPrompt(): string {');
  lines.push('  const lines: string[] = [');
  lines.push('    "ENVIRONMENT ASSET CATALOG (' + entries.length + ' verified GLB models from GCS bucket):",');
  lines.push('    "Source: gs://3dmodels_mml. ALWAYS use these. NEVER use primitives unless asked.",');
  lines.push('    "",');
  lines.push('  ];');
  lines.push('');
  lines.push('  const byCategory = new Map<string, EnvironmentAsset[]>();');
  lines.push('  for (const asset of ENVIRONMENT_CATALOG) {');
  lines.push('    const cat = asset.category;');
  lines.push('    if (!byCategory.has(cat)) byCategory.set(cat, []);');
  lines.push('    byCategory.get(cat)!.push(asset);');
  lines.push('  }');
  lines.push('');
  lines.push('  for (const [category, assets] of byCategory) {');
  lines.push('    lines.push(`  ${category.toUpperCase()} (${assets.length} models):`);');
  lines.push('    for (const a of assets) {');
  lines.push('      lines.push(`    - ${a.name} [${a.tags.join(", ")}]`);');
  lines.push('    }');
  lines.push('    lines.push("");');
  lines.push('  }');
  lines.push('');
  lines.push('  return lines.join("\\n");');
  lines.push('}');
  lines.push('');

  const outPath = path.join(__dirname, "..", "lib", "assets", "environment-catalog.ts");
  fs.writeFileSync(outPath, lines.join("\n"));
  console.log("Written to:", outPath);
}

main().catch(console.error);
