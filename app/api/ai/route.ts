import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/mml/promptBuilder";
import { validateBlueprint } from "@/lib/blueprint/schema";
import { generateMml } from "@/lib/blueprint/generateMml";
import { validateAndFixMml } from "@/lib/mml/alphaValidator";
import { buildEnvironmentCatalogPrompt } from "@/lib/assets/environment-catalog";
import type { BlueprintJSON, AiResponse, AiNewSceneResponse, AiPatchResponse } from "@/types/blueprint";

// Rate limiting
const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter((t) => now - t < RATE_WINDOW_MS);
  if (timestamps.length >= RATE_LIMIT) return false;
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return true;
}

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("ANTHROPIC_API_KEY is not set.");
  return new Anthropic({ apiKey });
}

const RequestSchema = z.object({
  mode: z.enum(["NEW_SCENE", "PATCH"]),
  userMessage: z.string().min(1).max(4000),
  currentBlueprint: z.record(z.unknown()).optional(),
  currentMml: z.string().optional(),
  projectMode: z.enum(["static", "dynamic"]).default("static"),
  conversationHistory: z
    .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(4000) }))
    .optional()
    .default([]),
});

// ─── System prompt addendum for blueprint mode ──────────────────────────────
const BLUEPRINT_AI_INSTRUCTIONS = `
You are an expert MML Alpha scene builder that uses a structured BLUEPRINT system.
You generate DETAILED, MODULAR environments — never single-cube buildings.

You respond in ONE of two JSON modes. ALWAYS return valid JSON — no markdown, no commentary.

═══════════════════════════════════════════════════════════
MODE A — NEW_SCENE (when creating a new scene from scratch)
═══════════════════════════════════════════════════════════
Return:
{
  "type": "NEW_SCENE",
  "blueprint": {
    "meta": { "title": "<scene title>", "units": "meters", "scaleProfile": "human", "seed": "<deterministic seed>" },
    "budgets": { "maxLights": 8, "maxModels": 100, "maxEntities": 500 },
    "scene": {
      "rootId": "root",
      "ground": { "type": "plane", "width": 60, "height": 60, "color": "#3a3a3a", "y": 0 },
      "structures": [ ... ]
    }
  },
  "explain": {
    "reasoning": ["Step 1: ...", "Step 2: ..."],
    "blueprintSummary": ["Main structure: ...", "Lighting: ..."]
  }
}

═══════════════════════════════════════════════════════════
MODE B — PATCH (when modifying an existing scene)
═══════════════════════════════════════════════════════════
Return:
{
  "type": "PATCH",
  "patch": [
    { "op": "add", "path": "/scene/structures/-", "value": { ...full structure with children... } },
    { "op": "replace", "path": "/scene/structures/0/material/color", "value": "#ff0000" },
    { "op": "remove", "path": "/scene/structures/2" }
  ],
  "explain": {
    "reasoning": ["Changed X because..."],
    "changes": ["Added a tower at NW corner", "Changed wall color to red"]
  }
}

Use JSON Patch (RFC6902) paths. path="/scene/structures/-" adds to end of array.

═══════════════════════════════════════════════════════════
STRUCTURE FIELD REFERENCE
═══════════════════════════════════════════════════════════
Every structure object:
{
  "id": "unique-id",         // REQUIRED — e.g. "tower-nw", "cell-block-east-cell-3"
  "type": "wall|tower|building|room|door|window|prop|clockTower|light|fence|gate|roof|floor|pillar|arch|stair|bridge|tree|rock|water|lamp|bench|table|chair|sign|barrel|crate|vehicle|custom",
  "transform": { "x":0,"y":0,"z":0,"rx":0,"ry":0,"rz":0,"sx":1,"sy":1,"sz":1 },
  "geometry": { "kind":"cube|cylinder|sphere|plane", "width":1, "height":1, "depth":1, "radius":0.5 },
  "material": { "color":"#888888", "opacity":1, "metalness":0, "roughness":1, "emissive":"#000000", "emissiveIntensity":0 },
  "lightProps": { "type":"point|directional|spot", "intensity":1, "color":"#ffffff", "distance":20 },
  "children": [ ...nested structures... ]
}

Use "type":"light" with "lightProps" for lights. Use "geometry" for primitives. Use "children" for composed objects.

═══════════════════════════════════════════════════════════
ENVIRONMENT TEMPLATE SYSTEM
═══════════════════════════════════════════════════════════
When generating a scene, identify the environment type and follow its template.
Templates define MINIMUM required subsystems. You MUST include ALL listed components.

prison_complex:
  REQUIRED: perimeter_walls (4 sides), watch_towers (4, at corners), main_gate (1),
            cell_blocks (2+, each with 4+ cells), central_courtyard (1),
            security_lighting (6+ lights spread across compound)

castle:
  REQUIRED: outer_walls (4 sides with battlements), corner_towers (4),
            gatehouse (1, with portcullis/doors), keep (1, multi-story),
            courtyard (1), great_hall (1, with pillars + throne),
            battlements (wall-top detail)

village:
  REQUIRED: houses (5+, each with walls/roof/door/windows), market_square (1),
            well (1), fences (around properties), paths (between buildings),
            trees (3+), lamp_posts (4+)

city_street:
  REQUIRED: buildings (4+, multi-story with windows), sidewalks (2),
            street_lamps (4+), benches (2+), signs (2+),
            road_surface (1), crosswalk (1)

temple:
  REQUIRED: main_hall (1, with interior pillars), pillars (6+ flanking entrance),
            altar (1), entrance_steps (1), roof (1, peaked or domed),
            torches/braziers (4+)

forest_clearing:
  REQUIRED: trees (8+, varied sizes), rocks (4+), path (1),
            fallen_log (1+), bushes/shrubs (4+), campfire or landmark (1),
            ambient_lights (3+)

For environments not listed above: identify 5-8 required subsystems and ensure each is present with appropriate detail.

═══════════════════════════════════════════════════════════
COMPOSITION LAW — NO SINGLE-CUBE BUILDINGS
═══════════════════════════════════════════════════════════
EVERY structure with type building, room, tower, or gate MUST have children.
A building is NEVER a single cube. It is composed of modular parts:

building/house → children: [
  wall-north (cube), wall-south (cube), wall-east (cube), wall-west (cube),
  roof (cube or cylinder, angled), door (cube, recessed), windows (2+, cubes)
]

tower → children: [
  base (cube, wide), shaft (cylinder or cube, tall), platform (cube, wider than shaft),
  roof/cap (cylinder or cube, peaked), railing (thin cubes around platform edge)
]
If type is "light" tower, also add a spotlight child with lightProps.

cell_block → children: [
  corridor (cube, long), cell-1, cell-2, cell-3, cell-4 (each spaced along z-axis)
]
Each cell → children: [
  back-wall (cube), side-walls (2 cubes), door (cube, with bars/opacity),
  window (small cube, high), bed (cube), toilet (small cube)
]

gate → children: [
  left-pillar (cube), right-pillar (cube), arch (cylinder or cube),
  door-left (cube), door-right (cube), frame-top (cube)
]

lamp_post → children: [
  base (cylinder, small), pole (cylinder, tall thin), shade (cylinder, inverted),
  bulb (sphere, emissive)
]

fence → children: [
  post-1, post-2, post-3, post-4 (cylinders, evenly spaced),
  rail-top (cube, long thin), rail-bottom (cube, long thin)
]

tree → children: [
  trunk (cylinder, brown), canopy-1 (sphere, green), canopy-2 (sphere, lighter green),
  canopy-3 (sphere, offset)
]

═══════════════════════════════════════════════════════════
REPETITION PATTERNS
═══════════════════════════════════════════════════════════
Use children arrays with incremental position offsets for repeated modules:

Cell row (4 cells along z-axis):
  cell-1: z=0, cell-2: z=4, cell-3: z=8, cell-4: z=12

Wall segments (perimeter, 5 segments along x-axis):
  wall-seg-1: x=-20, wall-seg-2: x=-10, wall-seg-3: x=0, wall-seg-4: x=10, wall-seg-5: x=20

Fence posts (8 posts along x-axis, 2m spacing):
  post-1: x=0, post-2: x=2, post-3: x=4, ... post-8: x=14

Pillars (6 pillars flanking a hall, 3 per side):
  pillar-l1: x=-3,z=0  pillar-l2: x=-3,z=5  pillar-l3: x=-3,z=10
  pillar-r1: x=3,z=0   pillar-r2: x=3,z=5   pillar-r3: x=3,z=10

═══════════════════════════════════════════════════════════
SCALE REFERENCE (meters, non-negotiable)
═══════════════════════════════════════════════════════════
Interior wall height:    3–4m
Perimeter/fortress wall: 8–10m height, 1–1.5m thick
Door:                    2m high × 1m wide × 0.15m deep
Window:                  1–1.5m high × 0.8m wide × 0.1m deep
Table:                   0.75m high × 1.2m wide × 0.6m deep
Chair:                   0.45m high × 0.4m wide × 0.4m deep
Bed:                     0.5m high × 2m long × 0.9m wide
Watch tower:             12–20m total height (base 3m + shaft 8-14m + platform 1m)
Lamp post:               3–4m height, 0.1m radius pole
Fence:                   1.5m high, posts 0.1m radius
Tree trunk:              0.3m radius, 3–5m height
Tree canopy:             2–4m radius spheres
Roof overhang:           0.3–0.5m beyond walls
Ground plane:            50–80m for compounds, 30–40m for small scenes

═══════════════════════════════════════════════════════════
SPATIAL LAYOUT RULES
═══════════════════════════════════════════════════════════
- Perimeter structures (walls, fences) placed at scene edges (±20 to ±30 on x/z)
- Corner elements (towers) at diagonal intersections of perimeter
- Central features (courtyard, plaza, altar) near origin (0, 0, 0)
- Buildings arranged along perimeter interior or in logical clusters
- Paths/corridors connect major areas
- Lights distributed to illuminate key areas (entrances, corners, center)
- Y=0 is ground level. Structures sit ON the ground (y=height/2 for centered geometry)
- Stack elements: roof.y = wall.height, platform.y = shaft.height, etc.

═══════════════════════════════════════════════════════════
MATERIAL & COLOR PALETTE
═══════════════════════════════════════════════════════════
Use VARIED, REALISTIC colors. Never use the same color for all structures.

Stone/concrete: #6B6B6B, #7A7A7A, #5C5C5C, #8B8682 (vary between structures)
Wood (dark):    #4A3728, #5C3A1E, #6B4226
Wood (medium):  #8B6914, #A0522D, #8B4513
Wood (light):   #DEB887, #D2B48C, #C4A882
Metal:          #708090 metalness:0.8 roughness:0.3
Rust:           #8B4513 metalness:0.4 roughness:0.8
Brick:          #8B4513, #A0522D, #CD853F
Roof tile:      #654321, #8B0000, #4A4A4A
Glass/bars:     #87CEEB opacity:0.4 metalness:0.6
Emissive:       emissive:"#FFA500" emissiveIntensity:0.8 (for lit windows, torches)
Ground:         #3A3A3A, #2D2D2D, #4A4A3A (dirt: #8B7355, grass: #228B22)

═══════════════════════════════════════════════════════════
MINIMUM COMPLEXITY
═══════════════════════════════════════════════════════════
- MINIMUM 20 top-level structures in scene.structures[]
- Each building/tower/gate MUST have 3+ children
- Each cell/room MUST have 4+ children (walls + door + furniture)
- Total entity count (structures + all nested children) should be 80-200+
- Use 4-8 light structures for proper illumination
- HARD CAPS: maxLights=8, maxModels=100, maxEntities=500

═══════════════════════════════════════════════════════════
EXAMPLE: WATCH TOWER STRUCTURE
═══════════════════════════════════════════════════════════
{
  "id": "tower-nw",
  "type": "tower",
  "transform": { "x": -25, "z": -25 },
  "children": [
    {
      "id": "tower-nw-base",
      "type": "prop",
      "transform": { "y": 1.5 },
      "geometry": { "kind": "cube", "width": 4, "height": 3, "depth": 4 },
      "material": { "color": "#6B6B6B", "roughness": 0.9 }
    },
    {
      "id": "tower-nw-shaft",
      "type": "pillar",
      "transform": { "y": 8 },
      "geometry": { "kind": "cylinder", "radius": 1.5, "height": 10 },
      "material": { "color": "#7A7A7A", "roughness": 0.85 }
    },
    {
      "id": "tower-nw-platform",
      "type": "floor",
      "transform": { "y": 13.5 },
      "geometry": { "kind": "cube", "width": 5, "height": 0.3, "depth": 5 },
      "material": { "color": "#5C5C5C", "metalness": 0.2 }
    },
    {
      "id": "tower-nw-railing",
      "type": "fence",
      "transform": { "y": 14.5 },
      "geometry": { "kind": "cube", "width": 5, "height": 1, "depth": 0.1 },
      "material": { "color": "#708090", "metalness": 0.7, "roughness": 0.3 }
    },
    {
      "id": "tower-nw-spotlight",
      "type": "light",
      "transform": { "y": 15 },
      "lightProps": { "type": "spot", "intensity": 2, "color": "#FFFFCC", "distance": 30, "angle": 45 }
    }
  ]
}

═══════════════════════════════════════════════════════════
ASSET PREFERENCE RULE
═══════════════════════════════════════════════════════════
When a matching 3D model asset exists in the VERIFIED_ASSET_CATALOG or
ENVIRONMENT ASSET CATALOG, you MUST prefer using it via modelSrc instead
of building from primitives. Primitives are the fallback ONLY when no
suitable asset exists.

To use an asset in a structure:
{
  "id": "fox-forest-1",
  "type": "prop",
  "modelSrc": "<URL from catalog>",
  "transform": { "x": 5, "y": 0, "z": -3, "sx": 0.02, "sy": 0.02, "sz": 0.02 },
}

Priority:
1. Check VERIFIED_ASSET_CATALOG and ENVIRONMENT ASSET CATALOG for matching models
2. Check Geez Collection (IDs 0-5555) if user mentions "geez" or "otherside"
3. Fall back to primitive composition (m-cube, m-sphere, m-cylinder) with appropriate colors

When using modelSrc, apply the catalog's defaultScale via transform sx/sy/sz.

OUTPUT ONLY THE JSON. No markdown. No commentary. No explanations outside the JSON.
`;

export async function POST(req: NextRequest) {
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ type: "ERROR", error: "Rate limit exceeded" }, { status: 429 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { type: "ERROR", error: "ANTHROPIC_API_KEY not configured" },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ type: "ERROR", error: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { type: "ERROR", error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { mode, userMessage, currentBlueprint, currentMml, projectMode, conversationHistory } = parsed.data;

  try {
    const anthropic = getAnthropicClient();
    const llmModel = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

    // Build system prompt
    const baseSystem = buildSystemPrompt(projectMode, { verifiedAssets: {} });
    const envCatalog = buildEnvironmentCatalogPrompt();
    const systemPrompt = `${baseSystem}\n\n${envCatalog}\n\n${BLUEPRINT_AI_INSTRUCTIONS}`;

    // Build user message
    let userContent = `USER REQUEST: ${userMessage}\n\nMODE: ${mode}`;

    if (mode === "PATCH" && currentBlueprint) {
      userContent += `\n\nCURRENT BLUEPRINT (apply patches to this):\n${JSON.stringify(currentBlueprint, null, 2)}`;
    }

    if (currentMml) {
      userContent += `\n\nCURRENT MML (reference):\n${currentMml.slice(0, 2000)}`;
    }

    userContent += `\n\nReturn ${mode === "PATCH" ? "a PATCH response" : "a NEW_SCENE response"} as valid JSON. No markdown.`;

    // Build messages with conversation history
    const messages: Anthropic.MessageParam[] = [];
    for (const msg of conversationHistory) {
      messages.push({ role: msg.role === "assistant" ? "assistant" : "user", content: msg.content });
    }
    messages.push({ role: "user", content: userContent });

    // Ensure first message is user
    if (messages.length > 0 && messages[0].role !== "user") {
      messages.shift();
    }

    // Merge consecutive same-role messages
    const merged: Anthropic.MessageParam[] = [];
    for (const msg of messages) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        merged[merged.length - 1] = {
          role: msg.role,
          content: merged[merged.length - 1].content + "\n\n" + msg.content,
        };
      } else {
        merged.push({ ...msg });
      }
    }

    const response = await anthropic.messages.create({
      model: llmModel,
      system: systemPrompt,
      messages: merged,
      temperature: 0.3,
      max_tokens: 16384,
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text || "";

    // Extract JSON from response
    const jsonStr = extractJson(rawText);
    if (!jsonStr) {
      return NextResponse.json(
        { type: "ERROR", error: "LLM returned non-JSON response", details: rawText.slice(0, 500) },
        { status: 502 }
      );
    }

    let aiResponse: AiResponse;
    try {
      aiResponse = JSON.parse(jsonStr) as AiResponse;
    } catch {
      return NextResponse.json(
        { type: "ERROR", error: "Failed to parse LLM JSON", details: jsonStr.slice(0, 500) },
        { status: 502 }
      );
    }

    // Validate response type
    if (!aiResponse.type || !["NEW_SCENE", "PATCH", "ERROR"].includes(aiResponse.type)) {
      return NextResponse.json(
        { type: "ERROR", error: "Invalid response type from LLM", details: aiResponse },
        { status: 502 }
      );
    }

    if (aiResponse.type === "ERROR") {
      return NextResponse.json(aiResponse, { status: 200 });
    }

    // For NEW_SCENE: validate blueprint, generate + validate MML
    if (aiResponse.type === "NEW_SCENE") {
      const ns = aiResponse as AiNewSceneResponse;
      const bpResult = validateBlueprint(ns.blueprint);
      if (!bpResult.ok) {
        return NextResponse.json(
          { type: "ERROR", error: "Blueprint validation failed", details: bpResult.errors },
          { status: 200 }
        );
      }

      // Generate MML from validated blueprint
      const mml = generateMml(bpResult.blueprint);
      const { fixedMml, issues } = validateAndFixMml(mml);

      console.log(`[/api/ai] NEW_SCENE: "${bpResult.blueprint.meta.title}" — ${bpResult.blueprint.scene.structures.length} structures, ${fixedMml.length} chars MML, ${issues.length} validation issues`);

      return NextResponse.json({
        ...ns,
        blueprint: bpResult.blueprint,
        generatedMml: fixedMml,
        validationIssues: issues,
      });
    }

    // For PATCH: validate patch structure before returning to client
    if (aiResponse.type === "PATCH") {
      const pr = aiResponse as AiPatchResponse;

      // Ensure patch is an array
      if (!Array.isArray(pr.patch)) {
        console.error("[/api/ai] PATCH response has non-array patch:", JSON.stringify(pr.patch));
        return NextResponse.json(
          { type: "ERROR", error: "LLM returned PATCH with invalid patch field (not an array)", details: JSON.stringify(pr.patch).slice(0, 500) },
          { status: 200 }
        );
      }

      // Validate each patch operation has required fields
      const invalidOps = pr.patch.filter(
        (op) => !op.op || !op.path || !["add", "remove", "replace"].includes(op.op)
      );
      if (invalidOps.length > 0) {
        console.error("[/api/ai] PATCH has invalid operations:", JSON.stringify(invalidOps));
        return NextResponse.json(
          { type: "ERROR", error: `PATCH contains ${invalidOps.length} invalid operation(s)`, details: JSON.stringify(invalidOps, null, 2) },
          { status: 200 }
        );
      }

      console.log(`[/api/ai] PATCH: ${pr.patch.length} operations`);
      for (const op of pr.patch) {
        console.log(`  ${op.op.toUpperCase()} ${op.path}`);
      }

      return NextResponse.json(pr);
    }

    return NextResponse.json(aiResponse);
  } catch (e) {
    console.error("[/api/ai] Error:", e);
    return NextResponse.json(
      { type: "ERROR", error: "Generation failed", details: String(e) },
      { status: 500 }
    );
  }
}

function extractJson(raw: string): string | null {
  raw = raw.trim();
  // Strip markdown fences
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenceMatch) raw = fenceMatch[1].trim();

  const firstBrace = raw.indexOf("{");
  if (firstBrace === -1) return null;

  let depth = 0;
  let inString = false;
  let escape = false;
  for (let i = firstBrace; i < raw.length; i++) {
    const ch = raw[i];
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{") depth++;
    else if (ch === "}") {
      depth--;
      if (depth === 0) return raw.slice(firstBrace, i + 1);
    }
  }
  // Fallback
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  return null;
}
