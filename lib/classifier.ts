/**
 * Lightweight request classifier.
 * Deterministic — no LLM call. Runs before the Claude prompt is built
 * so we can scope the system prompt and context appropriately.
 */

export type GenerationMode = "OBJECT" | "SCENE";

export interface ClassificationResult {
  generationMode: GenerationMode;
  /** The detected object/scene name (e.g. "car", "prison") */
  intentName: string;
  /** Broad archetype category (e.g. "vehicle", "creature", "environment") */
  archetype: string;
  /** @deprecated Alias for archetype — kept for backwards compat */
  intentType: string;
  needsEnvironmentCatalog: boolean;
  /** True when the user explicitly mentions "otherside" models */
  needsOthersideCatalog: boolean;
  /** True when the user mentions "geez" — Geez character collection (IDs 0-5555) */
  needsGeezCollection: boolean;
  /** Extracted Geez IDs from the prompt (e.g. "1952 geez" → [1952]) */
  geezIds: number[];
}

// ── Scene-indicating keywords (places, layouts, explorable environments) ──
const SCENE_PATTERNS = [
  // Place / location nouns
  /\b(prison|jail|dungeon|castle|fortress|village|town|city|street|temple|church|cathedral|forest|clearing|garden|park|plaza|courtyard|market|arena|stadium|harbor|port|dock|farm|ranch|camp|cemetery|graveyard|battlefield|island|cave|mine|warehouse|factory|library|museum|school|hospital|station|airport|spacestation|colony)\b/i,
  // Indoor rooms / spaces
  /\b(bedroom|living\s*room|kitchen|bathroom|office|study|dining\s*room|hallway|lobby|corridor|lounge|studio|nursery|playroom|laundry\s*room|garage|basement|attic|cellar|chapel|throne\s*room|barracks|tavern|inn\s*room|cabin\s*interior)\b/i,
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
// Universal archetypes: vehicle, furniture, structure, tower, tool, weapon,
// creature, machine, container, nature, lighting, prop
const ARCHETYPE_MAP: Array<{ pattern: RegExp; archetype: string }> = [
  // Vehicle
  { pattern: /\b(car|truck|van|bus|sedan|suv|taxi|ambulance|firetruck)\b/i, archetype: "vehicle" },
  { pattern: /\b(motorcycle|bike|bicycle|scooter|skateboard|segway)\b/i, archetype: "vehicle" },
  { pattern: /\b(boat|ship|canoe|kayak|yacht|submarine|raft|gondola)\b/i, archetype: "vehicle" },
  { pattern: /\b(airplane|helicopter|jet|drone|spaceship|rocket|glider|blimp)\b/i, archetype: "vehicle" },
  { pattern: /\b(tank|apc|humvee|cart|wagon|chariot|sled|sleigh)\b/i, archetype: "vehicle" },
  { pattern: /\b(train|locomotive|trolley|tram|monorail)\b/i, archetype: "vehicle" },
  // Furniture
  { pattern: /\b(couch|sofa|chair|bench|throne|stool|recliner|loveseat)\b/i, archetype: "furniture" },
  { pattern: /\b(table|desk|counter|workbench|nightstand|end\s*table)\b/i, archetype: "furniture" },
  { pattern: /\b(bed|crib|hammock|bunk|mattress|futon)\b/i, archetype: "furniture" },
  { pattern: /\b(wardrobe|cabinet|shelf|bookcase|dresser|drawer|cupboard|locker)\b/i, archetype: "furniture" },
  // Tool
  { pattern: /\b(hammer|wrench|screwdriver|pliers|saw|drill|pickaxe|shovel|rake|hoe)\b/i, archetype: "tool" },
  { pattern: /\b(key|compass|telescope|microscope|magnifying\s*glass|hourglass)\b/i, archetype: "tool" },
  { pattern: /\b(fishing\s*rod|paintbrush|pen|pencil|broom|mop|bucket)\b/i, archetype: "tool" },
  // Weapon
  { pattern: /\b(sword|shield|axe|bow|spear|mace|dagger|staff|wand|halberd|trident)\b/i, archetype: "weapon" },
  { pattern: /\b(gun|rifle|pistol|shotgun|cannon|crossbow|slingshot|catapult|ballista)\b/i, archetype: "weapon" },
  // Machine
  { pattern: /\b(robot|android|mech|golem|automaton)\b/i, archetype: "machine" },
  { pattern: /\b(engine|motor|generator|turbine|pump|compressor|crane|forklift)\b/i, archetype: "machine" },
  { pattern: /\b(computer|terminal|console|arcade|vending\s*machine|jukebox|radio|tv|television)\b/i, archetype: "machine" },
  { pattern: /\b(clock|gear|windmill|waterwheel|mill|press|loom|anvil|furnace|oven)\b/i, archetype: "machine" },
  // Container
  { pattern: /\b(barrel|crate|box|chest|urn|pot|vase|jar|basket|sack|bag|trunk|coffin|casket)\b/i, archetype: "container" },
  { pattern: /\b(bottle|flask|goblet|cup|mug|bowl|cauldron|kettle|bucket)\b/i, archetype: "container" },
  // Creature
  { pattern: /\b(character|person|figure|npc|human|man|woman|soldier|guard|knight|wizard|warrior)\b/i, archetype: "creature" },
  { pattern: /\b(creature|monster|dragon|demon|beast|spider|wolf|bear|troll|ogre|goblin)\b/i, archetype: "creature" },
  { pattern: /\b(horse|dog|cat|bird|fish|fox|deer|rabbit|snake|frog|turtle|owl|eagle)\b/i, archetype: "creature" },
  // Lighting
  { pattern: /\b(lamp|chandelier|lantern|torch|candle|sconce|streetlight|spotlight|beacon)\b/i, archetype: "lighting" },
  // Tower
  { pattern: /\b(tower|lighthouse|windmill|silo|chimney|minaret|obelisk|spire|pillar|column)\b/i, archetype: "tower" },
  // Structure (buildings, architecture)
  { pattern: /\b(house|cabin|hut|shed|cottage|shack|barn|gazebo|pavilion)\b/i, archetype: "structure" },
  { pattern: /\b(building|skyscraper|office|apartment|warehouse|factory|store|shop)\b/i, archetype: "structure" },
  { pattern: /\b(bridge|overpass|walkway|ramp|aqueduct|pier|dock)\b/i, archetype: "structure" },
  { pattern: /\b(gate|door|portcullis|drawbridge|archway)\b/i, archetype: "structure" },
  { pattern: /\b(fence|wall|barricade|barrier|railing|palisade)\b/i, archetype: "structure" },
  // Nature
  { pattern: /\b(tree|palm|pine|oak|willow|birch|maple|cedar)\b/i, archetype: "nature" },
  { pattern: /\b(rock|boulder|stone|pebble|crystal|gem|stalagmite)\b/i, archetype: "nature" },
  { pattern: /\b(bush|shrub|hedge|flower|mushroom|cactus|grass|vine|fern)\b/i, archetype: "nature" },
  // Prop (catch-all for decorative/misc items)
  { pattern: /\b(statue|fountain|monument|altar|pedestal|trophy|globe)\b/i, archetype: "prop" },
  { pattern: /\b(sign|banner|flag|billboard|poster|scroll|book|map)\b/i, archetype: "prop" },
  { pattern: /\b(bell|horn|drum|piano|guitar|instrument)\b/i, archetype: "prop" },
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

  // 4. Determine archetype + extract intent name
  let detectedArchetype = "unknown";
  let intentName = "unknown";
  for (const { pattern, archetype } of ARCHETYPE_MAP) {
    const match = normalized.match(pattern);
    if (match) {
      detectedArchetype = archetype;
      intentName = match[1]?.toLowerCase() || archetype;
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

  // 6. Determine catalog needs
  const needsEnvironmentCatalog = generationMode === "SCENE";
  const needsOthersideCatalog = /\botherside\b/i.test(normalized);

  // 7. Detect Geez collection references (IDs 0-5555)
  const needsGeezCollection = /\bgeez\b/i.test(normalized);
  const geezIds: number[] = [];
  if (needsGeezCollection) {
    // Match patterns: "1952 geez", "geez 1952", "geez #1952", "geez#1952"
    const idMatches = normalized.matchAll(/\b(\d{1,4})\s*(?:geez|#)\b|\bgeez\s*#?\s*(\d{1,4})\b/gi);
    for (const m of idMatches) {
      const num = parseInt(m[1] || m[2], 10);
      if (num >= 0 && num <= 5555 && !geezIds.includes(num)) geezIds.push(num);
    }
  }

  // If we couldn't detect an archetype but it's a scene, set it
  if (detectedArchetype === "unknown" && generationMode === "SCENE") {
    detectedArchetype = "environment";
    intentName = "environment";
  }
  if (detectedArchetype === "unknown" && generationMode === "OBJECT") {
    detectedArchetype = "prop";
    intentName = "object";
  }

  return {
    generationMode,
    intentName,
    archetype: detectedArchetype,
    intentType: detectedArchetype, // backwards compat alias
    needsEnvironmentCatalog,
    needsOthersideCatalog,
    needsGeezCollection,
    geezIds,
  };
}
