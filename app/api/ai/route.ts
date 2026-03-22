import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import Anthropic from "@anthropic-ai/sdk";
import { validateBlueprint } from "@/lib/blueprint/schema";
import { generateMml } from "@/lib/blueprint/generateMml";
import { generateMmlAsync } from "@/lib/blueprint/generateMmlAsync";
import { validateAndFixMml } from "@/lib/mml/alphaValidator";
import { validateLayout } from "@/lib/layout/validator";
import { classifyRequest } from "@/lib/classifier";
import { buildObjectSystemPrompt, buildSceneSystemPrompt, buildPatchSystemPrompt } from "@/lib/llm/prompts";
import { buildEnvironmentCatalogPrompt } from "@/lib/assets/environment-catalog";
import { buildOthersideCatalogPrompt } from "@/lib/assets/otherside-prompt";
import { buildGeezCollectionPrompt } from "@/lib/assets/geez-prompt";
import { buildBiomeSystemPrompt } from "@/lib/biome/prompt";
// Builder + serializer pipeline is now internal to generateMml
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

  const { mode, userMessage, currentBlueprint, currentMml, projectMode } = parsed.data;

  try {
    const anthropic = getAnthropicClient();
    const llmModel = process.env.LLM_MODEL || "claude-sonnet-4-20250514";

    // ═══════════════════════════════════════════════════════════════
    // STEP 1 — CLASSIFY REQUEST (deterministic, no LLM)
    // ═══════════════════════════════════════════════════════════════
    const classification = classifyRequest(userMessage);
    console.log(`[/api/ai] classification: mode=${classification.generationMode}, intent=${classification.intentType}, needsCatalog=${classification.needsEnvironmentCatalog}`);

    // ═══════════════════════════════════════════════════════════════
    // STEP 2 — BUILD SCOPED SYSTEM PROMPT (mode-specific, minimal)
    // ═══════════════════════════════════════════════════════════════
    let systemPrompt: string;
    let userContent: string;
    const messages: Anthropic.MessageParam[] = [];

    if (mode === "PATCH") {
      // ─── PATCH MODE ──────────────────────────────────────────
      // Send: patch prompt + current blueprint + user request
      // Do NOT send: conversation history, MML, environment catalog
      systemPrompt = buildPatchSystemPrompt();

      if (classification.needsEnvironmentCatalog) {
        systemPrompt += "\n\n" + buildEnvironmentCatalogPrompt();
      }
      if (classification.needsOthersideCatalog) {
        systemPrompt += "\n\n" + buildOthersideCatalogPrompt();
      }
      if (classification.needsGeezCollection) {
        systemPrompt += "\n\n" + buildGeezCollectionPrompt(classification.geezIds);
      }

      userContent = `USER REQUEST: ${userMessage}`;
      if (currentBlueprint) {
        userContent += `\n\nCURRENT BLUEPRINT (apply patches to this):\n${JSON.stringify(currentBlueprint, null, 2)}`;
      }
      userContent += `\n\nReturn a PATCH response as valid JSON. No markdown.`;

      messages.push({ role: "user", content: userContent });

    } else {
      // ─── NEW_SCENE MODE ──────────────────────────────────────
      // Send: scoped prompt + user request ONLY
      // Do NOT send: conversation history, MML, previous blueprints

      // Check for biome mode: [BIOME:biome_id] prefix
      const biomeMatch = userMessage.match(/^\[BIOME:(\w+)\]\s*/);
      const biomeId = biomeMatch?.[1];
      const cleanUserMessage = biomeId ? userMessage.replace(biomeMatch![0], "") : userMessage;

      if (biomeId) {
        // ─── BIOME MODE ────────────────────────────────────────
        systemPrompt = buildBiomeSystemPrompt(biomeId, cleanUserMessage || undefined);
        // Biomes use both catalogs
        systemPrompt += "\n\n" + buildEnvironmentCatalogPrompt();
        systemPrompt += "\n\n" + buildOthersideCatalogPrompt();
        console.log(`[/api/ai] BIOME mode: ${biomeId}`);
      } else if (classification.generationMode === "OBJECT") {
        systemPrompt = buildObjectSystemPrompt(classification);
        // OBJECT mode: no environment catalog by default
      } else {
        systemPrompt = buildSceneSystemPrompt(classification);
        // SCENE mode: inject relevant catalog
        systemPrompt += "\n\n" + buildEnvironmentCatalogPrompt();
      }
      // Inject Otherside catalog whenever user mentions "otherside"
      if (!biomeId && classification.needsOthersideCatalog) {
        systemPrompt += "\n\n" + buildOthersideCatalogPrompt();
      }
      // Inject Geez collection info whenever user mentions "geez"
      if (classification.needsGeezCollection) {
        systemPrompt += "\n\n" + buildGeezCollectionPrompt(classification.geezIds);
      }

      // Static vs dynamic mode addendum
      if (projectMode === "dynamic") {
        systemPrompt += `\n\nThis is a DYNAMIC scene — include a jsModule field if dynamic behavior is needed.`;
      }

      // Clean, stateless user message — NO history, NO MML
      // Exception: if the scene has library-inserted models, include current MML as context
      userContent = biomeId
        ? `USER REQUEST: Generate a ${cleanUserMessage || "dense"} biome environment.\n\nReturn a NEW_SCENE response as valid JSON. No markdown.`
        : `USER REQUEST: ${userMessage}`;
      if (!biomeId && currentMml) {
        userContent += `\n\nCURRENT SCENE (models were manually added from library — preserve or modify as requested):\n${currentMml}`;
      }
      if (!biomeId) {
        userContent += `\n\nReturn a NEW_SCENE response as valid JSON. No markdown.`;
      }
      messages.push({ role: "user", content: userContent });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 3 — CALL LLM (lightweight, scoped)
    // ═══════════════════════════════════════════════════════════════
    console.log(`[/api/ai] calling ${llmModel}, mode=${mode}, promptSize=${systemPrompt.length} chars`);

    // Use streaming to avoid Anthropic SDK 10-minute timeout on long generations
    const stream = anthropic.messages.stream({
      model: llmModel,
      system: systemPrompt,
      messages,
      temperature: 0.3,
      max_tokens: 32768,
    });

    const response = await stream.finalMessage();

    const textBlock = response.content.find((b) => b.type === "text");
    const rawText = textBlock?.text || "";

    // ═══════════════════════════════════════════════════════════════
    // STEP 4 — PARSE JSON RESPONSE
    // ═══════════════════════════════════════════════════════════════
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

    if (!aiResponse.type || !["NEW_SCENE", "PATCH", "ERROR"].includes(aiResponse.type)) {
      return NextResponse.json(
        { type: "ERROR", error: "Invalid response type from LLM", details: aiResponse },
        { status: 502 }
      );
    }

    if (aiResponse.type === "ERROR") {
      return NextResponse.json(aiResponse, { status: 200 });
    }

    // ═══════════════════════════════════════════════════════════════
    // STEP 5 — POST-PROCESS (deterministic enhancement)
    // ═══════════════════════════════════════════════════════════════

    if (aiResponse.type === "NEW_SCENE") {
      const ns = aiResponse as AiNewSceneResponse;
      const bpResult = validateBlueprint(ns.blueprint);
      if (!bpResult.ok) {
        console.error("[/api/ai] Blueprint validation errors:", bpResult.errors);
        return NextResponse.json(
          { type: "ERROR", error: `Blueprint validation failed: ${bpResult.errors.slice(0, 3).join("; ")}`, details: bpResult.errors },
          { status: 200 }
        );
      }

      // Builder pipeline is now internal to generateMml()
      const blueprint = bpResult.blueprint;

      // Layout validation (zone/position consistency)
      const layoutResult = validateLayout(blueprint);
      if (layoutResult.issues.length > 0) {
        console.log(`[/api/ai] Layout issues: ${layoutResult.issues.map((i) => i.message).join(", ")}`);
      }

      // Generate MML from enhanced blueprint (model-first async pipeline)
      const mml = await generateMmlAsync(blueprint);
      const { fixedMml, issues } = validateAndFixMml(mml);
      const allIssues = [...issues, ...layoutResult.issues];

      console.log(`[/api/ai] NEW_SCENE: "${blueprint.meta.title}" (${classification.generationMode}) — ${blueprint.scene.structures.length} structures, ${fixedMml.length} chars MML, ${allIssues.length} issues`);

      return NextResponse.json({
        ...ns,
        blueprint,
        generatedMml: fixedMml,
        validationIssues: allIssues,
        classification,
      });
    }

    // ─── PATCH response ──────────────────────────────────────────
    if (aiResponse.type === "PATCH") {
      const pr = aiResponse as AiPatchResponse;

      if (!Array.isArray(pr.patch) || pr.patch.length === 0) {
        console.error("[/api/ai] PATCH response has empty/invalid patch:", JSON.stringify(pr.patch));
        return NextResponse.json(
          {
            type: "ERROR",
            error: pr.patch?.length === 0
              ? "LLM returned PATCH with no operations — try rephrasing your request"
              : "LLM returned PATCH with invalid patch field (not an array)",
            details: JSON.stringify(pr.patch).slice(0, 500),
          },
          { status: 200 }
        );
      }

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
  const lastBrace = raw.lastIndexOf("}");
  if (lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
  return null;
}
