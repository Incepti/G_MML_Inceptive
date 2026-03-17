/**
 * Prompt builder for Geez Collection models — injected when user mentions "geez".
 *
 * The Geez Collection contains 5,556 character/creature GLB models (IDs 0–5555)
 * hosted at: https://storage.googleapis.com/geez-public/GLB_MML/{ID}.glb
 */

export function buildGeezCollectionPrompt(requestedIds: number[]): string {
  const lines: string[] = [
    "## GEEZ CHARACTER COLLECTION — 5,556 GLB character models (IDs 0–5555)",
    "",
    '██ MANDATORY: When the user says "geez", they mean Geez character models. ██',
    '██ Use the EXACT URL pattern below. Do NOT use GCS or Otherside catalogs. ██',
    "",
    "URL pattern: https://storage.googleapis.com/geez-public/GLB_MML/{ID}.glb",
    "ID range: 0 to 5555 (inclusive)",
    "",
    "When the user specifies an ID (e.g. '1952 geez', 'geez 42', 'add geez #100'):",
    '  - Set modelSrc directly to the URL with that ID',
    '  - Set modelTags to ["geez", "{ID}"]',
    '  - Do NOT use the asset resolver — the URL is known',
    "",
    "Examples:",
    '  "add 1952 geez"     → modelSrc: "https://storage.googleapis.com/geez-public/GLB_MML/1952.glb", modelTags: ["geez", "1952"]',
    '  "add geez #42"      → modelSrc: "https://storage.googleapis.com/geez-public/GLB_MML/42.glb", modelTags: ["geez", "42"]',
    '  "place 3 geez characters" → use IDs like 100, 200, 300 (spread across range)',
    "",
  ];

  if (requestedIds.length > 0) {
    lines.push(`The user specifically requested Geez ID(s): ${requestedIds.join(", ")}`);
    for (const id of requestedIds) {
      lines.push(`  → https://storage.googleapis.com/geez-public/GLB_MML/${id}.glb`);
    }
  }

  return lines.join("\n");
}
