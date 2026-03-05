import {
  MML_ALPHA_AUTHORITY_RULES,
  STATIC_MML_ADDENDUM,
  DYNAMIC_MML_ADDENDUM,
} from "./alphaAuthority";
import { OUTPUT_CONTRACT } from "./outputContract";
import { TRUSTED_ASSETS } from "@/lib/assets/trusted-index";
import { KNOWLEDGE_REFERENCE } from "./knowledge-content";

function buildVerifiedCatalog(): string {
  const lines = TRUSTED_ASSETS.map(
    (a) => `- ${a.name} [${a.tags.join(", ")}]: ${a.url}`
  );
  return `VERIFIED_ASSET_CATALOG (all URLs below are tested and working — use ONLY these for m-model src):
${lines.join("\n")}

IMPORTANT: When the scene needs a 3D model, pick the best match from this catalog by tag/name.
If nothing in the catalog matches, use primitives (m-cube, m-sphere, m-cylinder, m-plane) with appropriate colors.
NEVER invent or guess a .glb URL that is not listed above.`;
}

export function buildSystemPrompt(
  mode: "static" | "dynamic",
  context: { verifiedAssets: Record<string, string> }
): string {
  const modeAddendum =
    mode === "dynamic" ? DYNAMIC_MML_ADDENDUM : STATIC_MML_ADDENDUM;

  const assets = Object.entries(context.verifiedAssets || {});
  const assetsListing =
    assets.length > 0
      ? assets.map(([name, url]) => `- ${name}: ${url}`).join("\n")
      : "";

  const knowledgeSection = KNOWLEDGE_REFERENCE
    ? "# MML DOCTRINE (Knowledge Book)\n\n" + KNOWLEDGE_REFERENCE
    : "";

  const catalogSection = buildVerifiedCatalog();

  return [
    MML_ALPHA_AUTHORITY_RULES,
    knowledgeSection,
    modeAddendum,
    catalogSection,
    OUTPUT_CONTRACT,
    assetsListing
      ? "USER-PROVIDED ASSETS (use these in addition to the catalog):\n" + assetsListing
      : "",
  ]
    .filter(Boolean)
    .join("\n\n");
}
