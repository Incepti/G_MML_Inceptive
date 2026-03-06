/**
 * Lightweight request classifier.
 * Deterministic — no LLM call. Runs before the Claude prompt is built
 * so we can scope the system prompt and context appropriately.
 */

export type GenerationMode = "OBJECT" | "SCENE";

export interface ClassificationResult {
  generationMode: GenerationMode;
  intentType: string;
  needsEnvironmentCatalog: boolean;
}

// ── Scene-indicating keywords (places, layouts, explorable environments) ──
const SCENE_PATTERNS = [
  // Place / location nouns
  /\b(prison|jail|dungeon|castle|fortress|village|town|city|street|temple|church|cathedral|forest|clearing|garden|park|plaza|courtyard|market|arena|stadium|harbor|port|dock|farm|ranch|camp|cemetery|graveyard|battlefield|island|cave|mine|warehouse|factory|library|museum|school|hospital|station|airport|spacestation|colony)\b/i,
  // Layout / environment keywords
  /\b(scene|environment|world|landscape|terrain|level|map|layout|compound|complex|district|neighborhood|quarter|block|settlement|outpost|encampment|sanctuary)\b/i,
  // Multi-structure intent
  /\b(build a .+ with|create a .+ featuring|generate a .+ including|make a .+ containing)\b/i,
  // Explicit "scene" / "environment" request
  /\b(create|build|make|generate|design)\s+(a|an|the|my)\s+(entire|full|complete|whole|new)?\s*(scene|environment|world|area|zone|region)\b/i,
];

// ── Object-indicating patterns (single items, not places) ──
const OBJECT_PATTERNS = [
  /\b(car|truck|bike|motorcycle|bicycle|boat|ship|airplane|helicopter|tank|train|bus|van|suv|sedan|spaceship|hovercraft)\b/i,
  /\b(sword|shield|axe|bow|gun|rifle|pistol|weapon|armor|helmet)\b/i,
  /\b(couch|sofa|chair|table|desk|bed|wardrobe|cabinet|shelf|bookcase|dresser|lamp|chandelier|rug|carpet)\b/i,
  /\b(tree|rock|boulder|bush|flower|mushroom|cactus|palm)\b/i,
  /\b(barrel|crate|box|chest|sign|banner|flag|statue|fountain|well|bench|throne|altar|podium|pedestal)\b/i,
  /\b(robot|character|figure|npc|creature|monster|dragon|animal|pet|horse|dog|cat|bird|fish)\b/i,
  /\b(tower|house|building|bridge|gate|door|window|fence|wall|pillar|arch|stair)\b/i,
];

// ── Words that override to scene even if an object keyword is present ──
const SCENE_OVERRIDE_PATTERNS = [
  /\b(with\s+\w+\s+around|surrounded\s+by|in\s+a\s+\w+\s+setting|with\s+(roads?|paths?|streets?|buildings?|houses?|trees?))\b/i,
  /\b(neighborhood|district|rows?\s+of|grid\s+of|array\s+of|field\s+of|lots?\s+of)\b/i,
];

// ── Archetype detection for intent classification ──
const ARCHETYPE_MAP: Array<{ pattern: RegExp; archetype: string }> = [
  { pattern: /\b(car|truck|van|bus|sedan|suv|taxi|ambulance|firetruck)\b/i, archetype: "vehicle" },
  { pattern: /\b(motorcycle|bike|bicycle|scooter)\b/i, archetype: "vehicle" },
  { pattern: /\b(boat|ship|canoe|kayak|yacht|submarine)\b/i, archetype: "vehicle" },
  { pattern: /\b(airplane|helicopter|jet|drone|spaceship|rocket)\b/i, archetype: "vehicle" },
  { pattern: /\b(tank|apc|humvee)\b/i, archetype: "vehicle" },
  { pattern: /\b(train|locomotive|trolley)\b/i, archetype: "vehicle" },
  { pattern: /\b(couch|sofa|chair|bench|throne|stool)\b/i, archetype: "furniture" },
  { pattern: /\b(table|desk|counter|workbench)\b/i, archetype: "furniture" },
  { pattern: /\b(bed|crib|hammock|bunk)\b/i, archetype: "furniture" },
  { pattern: /\b(wardrobe|cabinet|shelf|bookcase|dresser|drawer)\b/i, archetype: "furniture" },
  { pattern: /\b(lamp|chandelier|lantern|torch|candle|sconce)\b/i, archetype: "lighting" },
  { pattern: /\b(tower|lighthouse|windmill|silo|chimney)\b/i, archetype: "tower" },
  { pattern: /\b(house|cabin|hut|shed|cottage|shack|barn)\b/i, archetype: "building" },
  { pattern: /\b(building|skyscraper|office|apartment|warehouse|factory|store|shop)\b/i, archetype: "building" },
  { pattern: /\b(bridge|overpass|walkway|ramp)\b/i, archetype: "building" },
  { pattern: /\b(gate|door|portcullis|drawbridge)\b/i, archetype: "prop" },
  { pattern: /\b(fence|wall|barricade|barrier|railing)\b/i, archetype: "prop" },
  { pattern: /\b(sword|shield|axe|bow|spear|mace|dagger|staff|wand)\b/i, archetype: "prop" },
  { pattern: /\b(barrel|crate|box|chest|urn|pot|vase|jar)\b/i, archetype: "prop" },
  { pattern: /\b(statue|fountain|monument|obelisk|pillar|column|arch)\b/i, archetype: "prop" },
  { pattern: /\b(sign|banner|flag|billboard)\b/i, archetype: "prop" },
  { pattern: /\b(tree|palm|pine|oak|willow|birch)\b/i, archetype: "nature" },
  { pattern: /\b(rock|boulder|stone|pebble)\b/i, archetype: "nature" },
  { pattern: /\b(bush|shrub|hedge|flower|mushroom|cactus|grass)\b/i, archetype: "nature" },
  { pattern: /\b(robot|android|mech|golem)\b/i, archetype: "character" },
  { pattern: /\b(character|person|figure|npc|human|man|woman|soldier|guard|knight)\b/i, archetype: "character" },
  { pattern: /\b(creature|monster|dragon|demon|beast|spider|wolf|bear)\b/i, archetype: "character" },
  { pattern: /\b(horse|dog|cat|bird|fish|fox|deer|rabbit)\b/i, archetype: "character" },
];

/**
 * Classify a user prompt into OBJECT or SCENE mode.
 * Pure function — no side effects, no LLM calls.
 */
export function classifyRequest(prompt: string): ClassificationResult {
  const normalized = prompt.trim();

  // 1. Check for scene override patterns first (strongest signal)
  const hasSceneOverride = SCENE_OVERRIDE_PATTERNS.some((p) => p.test(normalized));

  // 2. Check for scene keywords
  const hasSceneKeyword = SCENE_PATTERNS.some((p) => p.test(normalized));

  // 3. Check for object keywords
  const hasObjectKeyword = OBJECT_PATTERNS.some((p) => p.test(normalized));

  // 4. Determine archetype
  let intentType = "unknown";
  for (const { pattern, archetype } of ARCHETYPE_MAP) {
    if (pattern.test(normalized)) {
      intentType = archetype;
      break;
    }
  }

  // 5. Decision logic
  let generationMode: GenerationMode;

  if (hasSceneOverride) {
    generationMode = "SCENE";
  } else if (hasSceneKeyword && !hasObjectKeyword) {
    generationMode = "SCENE";
  } else if (hasSceneKeyword && hasObjectKeyword) {
    // Ambiguous — check word count. Short prompts with a scene keyword
    // like "create a prison" are scenes. Long prompts with objects in
    // a scene context are also scenes.
    const wordCount = normalized.split(/\s+/).length;
    generationMode = wordCount <= 6 && hasSceneKeyword ? "SCENE" : "SCENE";
  } else if (hasObjectKeyword && !hasSceneKeyword) {
    generationMode = "OBJECT";
  } else {
    // No strong signal — default to OBJECT for short prompts, SCENE for longer
    const wordCount = normalized.split(/\s+/).length;
    generationMode = wordCount > 10 ? "SCENE" : "OBJECT";
  }

  // If scene keyword is present even alongside an object keyword, it's a scene
  if (hasSceneKeyword) {
    generationMode = "SCENE";
  }

  // 6. Determine catalog need
  const needsEnvironmentCatalog = generationMode === "SCENE";

  // If we couldn't detect an archetype but it's a scene, set it
  if (intentType === "unknown" && generationMode === "SCENE") {
    intentType = "environment";
  }
  if (intentType === "unknown" && generationMode === "OBJECT") {
    intentType = "custom";
  }

  return { generationMode, intentType, needsEnvironmentCatalog };
}
