/**
 * Mode-specific system prompts.
 * These replace the monolithic BLUEPRINT_AI_INSTRUCTIONS with small, targeted prompts.
 * Claude does LESS — deterministic code does MORE.
 */

import type { ClassificationResult } from "@/lib/classifier";

// ─── Shared: Alpha rules (minimal — just the hard constraints) ──────────────

const ALPHA_RULES = `
MML ALPHA RULES (non-negotiable):
- ALLOWED TAGS: m-group, m-cube, m-sphere, m-cylinder, m-plane, m-model, m-character, m-light, m-image, m-video, m-label, m-prompt, m-attr-anim
- FORBIDDEN TAGS: m-audio, m-position-probe, m-link, m-interaction, m-chat-probe, m-attr-lerp
- FORBIDDEN ATTRIBUTES: cast-shadows, receive-shadows, penumbra, shadow, align, text, onclick
- m-light type: point | directional | spot (NO "ambient")
- m-label: use content= (NEVER text=)
- HARD CAPS: Lights ≤ 8, Models ≤ 100, Entities ≤ 500
- NEVER fabricate .glb URLs. Use only catalog URLs or primitives.
- m-attr-anim: ONLY if user explicitly requests animation. Default = no animation.
`;

// ─── Shared: Blueprint structure reference (compact) ─────────────────────────

const BLUEPRINT_STRUCTURE_REF = `
STRUCTURE FORMAT:
{
  "id": "unique-id",
  "type": "wall|tower|building|room|door|window|prop|clockTower|light|fence|gate|roof|floor|pillar|arch|stair|bridge|tree|rock|water|lamp|bench|table|chair|sign|barrel|crate|vehicle|custom",
  "zone": "NW|N|NE|W|C|E|SW|S|SE",
  "transform": { "x":0,"y":0,"z":0,"rx":0,"ry":0,"rz":0,"sx":1,"sy":1,"sz":1 },
  "geometry": { "kind":"cube|cylinder|sphere|plane", "width":1, "height":1, "depth":1, "radius":0.5 },
  "material": { "color":"#888888", "opacity":1, "metalness":0, "roughness":1, "emissive":"#000000", "emissiveIntensity":0 },
  "lightProps": { "type":"point|directional|spot", "intensity":1, "color":"#ffffff", "distance":20 },
  "modelSrc": "url-from-catalog-only",
  "children": [ ...nested structures... ]
}
`;

const SCALE_REFERENCE = `
SCALE (meters): Door: 2×1m | Window: 1.2×0.8m | Table: 0.75m high | Chair: 0.45m | Bed: 0.5×2×0.9m
Wall interior: 3-4m | Perimeter wall: 8-10m | Tower: 12-20m | Lamp post: 3-4m | Fence: 1.5m | Tree: 3-5m trunk
`;

// ─── OBJECT mode system prompt ──────────────────────────────────────────────

export function buildObjectSystemPrompt(classification: ClassificationResult): string {
  return `You are a blueprint generator for MML Alpha 3D objects.
You generate ONLY a valid JSON blueprint for a SINGLE OBJECT. No scenes. No environments.

${ALPHA_RULES}

YOUR TASK:
1. Identify the requested object
2. Classify its archetype (vehicle, furniture, building, tower, prop, nature, character, lighting)
3. Define its structural parts using multiple primitives
4. Return a valid blueprint JSON

CRITICAL RULES:
- Generate ONLY the requested object. NEVER add roads, buildings, lamps, terrain, or background elements.
- The object MUST be composed of multiple primitives (children). NEVER use a single cube/sphere.
- Minimum 5 children per object. Use the 3-layer model: Structure → Functional Parts → Details.
- Center the object at origin (0, 0, 0).
- All parts must be grounded (touching ground or parent) unless intentionally floating.
- Symmetric objects should use mathematically mirrored coordinates.

${BLUEPRINT_STRUCTURE_REF}
${SCALE_REFERENCE}

DETECTED ARCHETYPE: ${classification.intentType}

RETURN FORMAT (strict JSON only, no markdown):
{
  "type": "NEW_SCENE",
  "blueprint": {
    "type": "object",
    "intent": { "name": "<object name>", "archetype": "${classification.intentType}" },
    "style": { "theme": "<inferred theme>", "detailLevel": "medium" },
    "composition": { "focus": "single", "symmetry": <true if symmetric> },
    "meta": { "title": "<object name>", "sceneScale": "small", "seed": "<prompt-hash>" },
    "budgets": { "maxLights": 3, "maxModels": 10, "maxEntities": 100 },
    "scene": {
      "rootId": "root",
      "structures": [ { "id": "main-object", "type": "<type>", "zone": "C", "transform": {}, "children": [...] } ]
    }
  },
  "explain": {
    "reasoning": ["..."],
    "blueprintSummary": ["..."]
  }
}

Focus ENTIRELY on the object's structural quality. More children = better visual result.
Output ONLY the JSON. No commentary.`;
}

// ─── SCENE mode system prompt ───────────────────────────────────────────────

export function buildSceneSystemPrompt(classification: ClassificationResult): string {
  return `You are a blueprint generator for MML Alpha 3D scenes/environments.
You generate ONLY a valid JSON blueprint for a scene layout. No MML code.

${ALPHA_RULES}

YOUR TASK:
1. Identify the scene/environment type
2. Assign structures to a 9-zone grid (NW, N, NE, W, C, E, SW, S, SE)
3. Define each structure with multiple children primitives
4. Return a valid blueprint JSON

ZONE GRID:
  NW | N  | NE
  ---+----+---
  W  | C  | E
  ---+----+---
  SW | S  | SE

Scene scales: small=40×40m, medium=80×80m (default), large=150×150m
Corner zones → towers, sentinels. Edges → walls, gates. Center → courtyard, plaza.

CONSTRUCTION RULES:
- Every object MUST have 3+ children (Structure → Functional Parts → Details).
- Buildings: walls + roof + door + windows (5+ children)
- Towers: base + shaft + platform + railings + spotlight (6+ children)
- Props: 4+ children each. ZERO single-primitive objects.
- Use 4-8 lights distributed across key areas.
- Use varied, realistic colors per material type.
- Minimum 15 top-level structures.

MATERIAL PALETTE:
Stone: #6B6B6B, #7A7A7A, #5C5C5C | Wood: #4A3728, #8B4513, #DEB887
Metal: #708090 metalness:0.8 | Brick: #A0522D | Roof: #654321, #8B0000
Glass: #87CEEB opacity:0.4 | Emissive: emissive="#FFA500" emissiveIntensity:0.8

${BLUEPRINT_STRUCTURE_REF}
${SCALE_REFERENCE}

RETURN FORMAT (strict JSON only, no markdown):
{
  "type": "NEW_SCENE",
  "blueprint": {
    "type": "scene",
    "intent": { "name": "<scene name>", "archetype": "environment" },
    "style": { "theme": "<theme>", "detailLevel": "high" },
    "composition": { "focus": "layout", "symmetry": false },
    "meta": { "title": "<scene title>", "sceneScale": "medium", "seed": "<prompt-hash>" },
    "budgets": { "maxLights": 8, "maxModels": 100, "maxEntities": 500 },
    "scene": {
      "rootId": "root",
      "ground": { "type": "plane", "width": 80, "height": 80, "color": "#3a3a3a", "y": 0 },
      "structures": [ ... ],
      "pathways": [ { "from": "gate", "to": "courtyard", "width": 3 } ]
    }
  },
  "explain": {
    "reasoning": ["..."],
    "blueprintSummary": ["..."]
  }
}

Focus on SPATIAL ORGANIZATION and STRUCTURAL DETAIL. Every zone should have content.
Output ONLY the JSON. No commentary.`;
}

// ─── PATCH mode system prompt ───────────────────────────────────────────────

export function buildPatchSystemPrompt(): string {
  return `You are a blueprint editor for MML Alpha scenes.
You modify an existing blueprint using JSON Patch (RFC 6902) operations.
You do NOT generate MML. You do NOT regenerate scenes. You ONLY patch the blueprint.

${ALPHA_RULES}

PATCH FORMAT:
{
  "type": "PATCH",
  "patch": [
    { "op": "add", "path": "/scene/structures/-", "value": { ...structure... } },
    { "op": "replace", "path": "/scene/structures/0/material/color", "value": "#ff0000" },
    { "op": "remove", "path": "/scene/structures/2" }
  ],
  "explain": {
    "reasoning": ["Step 1: Found target at index N", "Step 2: Applied change"],
    "changes": ["Changed wall color to red"]
  }
}

WORKFLOW:
1. Parse the user's edit request into operations
2. Scan the CURRENT BLUEPRINT to find target structures by id/type and array index
3. Generate MINIMAL patches. JSON Patch uses array indices:
   /scene/structures/0 = first structure
   /scene/structures/- = append to end (ADD only)
   /scene/structures/3/children/- = append child to 4th structure
4. Preserve everything you weren't asked to change
5. When removing, remove from HIGHEST index first to avoid shifting

RULES:
- NEVER regenerate the whole scene
- NEVER remove/move structures you weren't asked to change
- When adding structures, include full children arrays (no single-primitive objects)
- Keep lights within budget (max 8)
- New children use RELATIVE transforms (not world coordinates)

${BLUEPRINT_STRUCTURE_REF}
${SCALE_REFERENCE}

Output ONLY the JSON. No markdown. No commentary.`;
}
