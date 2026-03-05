import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { buildSystemPrompt } from "@/lib/mml/promptBuilder";
import { validateBlueprint } from "@/lib/blueprint/schema";
import { generateMml } from "@/lib/blueprint/generateMml";
import { validateAndFixMml } from "@/lib/mml/alphaValidator";
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

You respond in ONE of two JSON modes. ALWAYS return valid JSON — no markdown, no commentary.

═══════════════════════════════════════════════════════════
MODE A — NEW_SCENE (when creating a new scene from scratch)
═══════════════════════════════════════════════════════════
Return:
{
  "type": "NEW_SCENE",
  "blueprint": {
    "meta": {
      "title": "<scene title>",
      "units": "meters",
      "scaleProfile": "human",
      "seed": "<deterministic seed>"
    },
    "budgets": {
      "maxLights": 8,
      "maxModels": 100,
      "maxEntities": 500
    },
    "scene": {
      "rootId": "root",
      "ground": {
        "type": "plane",
        "width": 50,
        "height": 50,
        "color": "#3a3a3a",
        "y": 0
      },
      "structures": [
        {
          "id": "unique-id",
          "type": "wall|tower|building|room|door|window|prop|clockTower|light|fence|gate|roof|floor|pillar|arch|stair|bridge|tree|rock|water|lamp|bench|table|chair|sign|barrel|crate|vehicle|custom",
          "transform": { "x":0,"y":0,"z":0,"rx":0,"ry":0,"rz":0,"sx":1,"sy":1,"sz":1 },
          "geometry": { "kind":"cube|cylinder|sphere|plane", "width":1, "height":1, "depth":1, "radius":0.5 },
          "material": { "color":"#888888", "opacity":1, "metalness":0, "roughness":1, "emissive":"#000000", "emissiveIntensity":0 },
          "children": [ ... ]
        }
      ]
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
    { "op": "add", "path": "/scene/structures/-", "value": { ... structure ... } },
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
STRUCTURE RULES
═══════════════════════════════════════════════════════════
- Every structure needs a unique "id" (e.g., "tower-nw", "wall-north-1")
- Use "type":"light" with "lightProps" for lights: { "type":"point|directional|spot", "intensity":1, "color":"#ffffff" }
- Use "geometry" for primitives: cube, cylinder, sphere, plane
- Use "material" for colors and PBR: color, opacity, metalness, roughness, emissive
- Use "children" for composed objects (a building with windows, a lamp with a shade)
- Transform defaults: position 0, rotation 0, scale 1 — omit defaults
- Scale realistically in meters: chair ~0.45m, table ~0.75m, door ~2m, wall ~3m
- MINIMUM 15-30 structures per scene for richness
- Use 3-8 light structures for proper illumination
- HARD CAPS: maxLights=8, maxModels=100

═══════════════════════════════════════════════════════════
BLUEPRINT QUALITY
═══════════════════════════════════════════════════════════
- Use varied colors with subtle differences (#8B4513 dark wood, #A0522D medium wood, #DEB887 light wood)
- Material variation: metalness for metal, roughness for stone, emissive for lights
- Compose complex objects from multiple primitives (tower = base cube + shaft cylinder + platform + roof)
- Ground plane is optional — environment may provide one
- Structures should have logical spatial positioning (walls around perimeter, furniture inside rooms)

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
    const systemPrompt = `${baseSystem}\n\n${BLUEPRINT_AI_INSTRUCTIONS}`;

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
