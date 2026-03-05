import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { generateMML } from "@/lib/llm/service";
import type { AssetManifestEntry } from "@/types/assets";
import { searchRegistryAssets } from "@/database/client";

// Rate limiting (simple in-memory)
const requestLog = new Map<string, number[]>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60_000;

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const timestamps = (requestLog.get(ip) || []).filter(
    (t) => now - t < RATE_WINDOW_MS
  );
  if (timestamps.length >= RATE_LIMIT) return false;
  timestamps.push(now);
  requestLog.set(ip, timestamps);
  return true;
}

const AssetUrlSchema = z.string().refine((value) => {
  if (value.startsWith("/")) return true; // allow local uploads like /uploads/...
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
}, "Invalid asset URL");

const AssetSourceSchema = z
  .enum([
    "trusted-index",
    "upload",
    "external-validated",
    "geez-public",
    "GEEZ COLLECTION",
    "geez",
    "registry",
  ])
  .transform((v) => (v === "GEEZ COLLECTION" || v === "geez" ? "geez-public" : v));

const GenerateSchema = z.object({
  prompt: z.string().min(1).max(2000),
  mode: z.enum(["static", "dynamic"]).default("static"),
  projectContext: z.string().optional(),
  strictMode: z.boolean().optional().default(false),
  assetManifest: z
    .array(
      z.object({
        id: z.string(),
        url: AssetUrlSchema,
        source: AssetSourceSchema,
        validated: z.boolean(),
        sizeBytes: z.number().nonnegative().optional().default(0),
        mimeType: z.string(),
        name: z.string(),
        license: z.string().optional(),
        previewUrl: z.string().optional(),
      })
    )
    .default([]),
  existingMML: z.string().optional(),
  model: z.string().optional(),
  conversationHistory: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(4000),
      })
    )
    .optional()
    .default([]),
});

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  if (!checkRateLimit(ip)) {
    return NextResponse.json(
      { error: "Rate limit exceeded. Max 10 requests per minute." },
      { status: 429 }
    );
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      {
        error:
          "LLM not configured. Set ANTHROPIC_API_KEY in .env.local to enable generation.",
      },
      { status: 503 }
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = GenerateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid request", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  try {
    const feasibilityErrors: string[] = [];
    const normalizeInput = (input: string): string =>
      input
        .toLowerCase()
        .replace(/\u2264/g, "<=")
        .replace(/\u2265/g, ">=")
        .replace(/[^\x00-\x7F]/g, " ")
        .replace(/\s+/g, " ")
        .trim();

    let effectivePrompt = parsed.data.prompt;
    const combinedInput = `${parsed.data.prompt} ${parsed.data.projectContext || ""}`;
    const promptText = normalizeInput(combinedInput);
    const STRICT_MODE =
      parsed.data.strictMode ||
      process.env.STRICT_MODE === "true" ||
      promptText.includes("enable strict mode");
    const primitiveKeywords = [
      "cube",
      "sphere",
      "cylinder",
      "plane",
      "simple geometry",
      "test object",
      "primitive",
      "abstract",
      "structural",
      "test",
      "demo",
      "example",
      "wireframe",
      "blockout",
      "graybox",
      "greybox",
      "whitebox",
    ];
    const modelKeywords = [
      "environment",
      "scene",
      "prop",
      "props",
      "character",
      "vehicle",
      "realistic",
      "production",
      "asset",
      "model",
      "furniture",
      "chair",
      "table",
      "building",
      "terrain",
      "landscape",
      "tree",
      "rock",
      "house",
      "city",
      "duck",
      "animal",
      "creature"
    ];
    const wantsPrimitives =
      primitiveKeywords.some((k) => promptText.includes(k)) ||
      /\bm-(cube|sphere|cylinder|plane)\b/.test(promptText);
    const indicatesModelFirst =
      modelKeywords.some((k) => promptText.includes(k)) ||
      promptText.includes("glb") ||
      promptText.includes("gltf") ||
      parsed.data.assetManifest.length > 0;

    // Only enforce model-first when assets are actually provided
    const requiresModel = !wantsPrimitives && indicatesModelFirst && parsed.data.assetManifest.length > 0;
    const assetAudit: Array<{
      name: string;
      source: string;
      url: string;
      verified: boolean;
      role: string;
    }> = [];

    // Layer 1 - Alpha tag gate (prompt-level)
    const allowedTags = new Set([
      "m-group",
      "m-cube",
      "m-sphere",
      "m-cylinder",
      "m-plane",
      "m-model",
      "m-character",
      "m-light",
      "m-image",
      "m-video",
      "m-label",
      "m-prompt",
      "m-attr-anim",
    ]);
    const tagPattern = /<\s*(m-[a-z0-9-]+)/gi;
    let match: RegExpExecArray | null;
    while ((match = tagPattern.exec(promptText)) !== null) {
      if (!allowedTags.has(match[1])) {
        feasibilityErrors.push(`Unsupported tag requested: <${match[1]}>`);
      }
    }

    // Undocumented attributes in prompt (hard fail)
    if (/\bonclick\b|\bonload\b|\bonerror\b|\bonmouse/i.test(promptText)) {
      feasibilityErrors.push("Undocumented or unsafe attribute requested in prompt");
    }

    // Layer 1 - Browser API rejection (prompt-level)
    const browserApiTerms = [
      "window",
      "requestanimationframe",
      "document.queryselector",
      "webgl",
      "canvas",
      "addEventListener on window".toLowerCase(),
    ];
    if (browserApiTerms.some((t) => promptText.includes(t))) {
      feasibilityErrors.push("Prompt requests forbidden browser APIs");
    }

    // Layer 1 - Injection surface validation (prompt-level)
    const unsupportedTech = [
      "shader",
      "glsl",
      "postprocess",
      "post-processing",
      "raytrace",
      "ray tracing",
      "custom material",
      "screen space",
      "ssao",
      "bloom",
      "hdr pipeline",
    ];
    if (unsupportedTech.some((t) => promptText.includes(t))) {
      feasibilityErrors.push("Prompt requests unsupported rendering techniques");
    }

    // Determinism requirements are enforced internally (no user declaration required)

    // Layer 1 - Budget declaration enforcement
    const budgetDefaults = [
      "lights <= 8",
      "models <= 100",
      "physics bodies <= 150",
      "particles <= 800",
      "tick rate = 33ms",
      "max loop duration <= 60",
      "single apex only",
    ];
    let budgetSource: "user-provided" | "auto-injected" = "user-provided";
    const hasAnyBudget = budgetDefaults.some((t) => promptText.includes(t));
    if (!hasAnyBudget) {
      if (STRICT_MODE) {
        feasibilityErrors.push("Missing explicit budget declarations");
      } else {
        budgetSource = "auto-injected";
        effectivePrompt += `\n\nBUDGETS:\n${budgetDefaults.map((b) => b).join("\n")}\n`;
      }
    }

    // Layer 1 - Cinematic structure pre-check
    const cinematicTokens = ["calm", "build", "escalation", "apex", "resolution", "loop"];
    const hasAnyCinematic = cinematicTokens.some((t) => promptText.includes(t));
    let cinematicSource: "user-provided" | "auto-generated" = "user-provided";
    if (!hasAnyCinematic) {
      if (STRICT_MODE) {
        feasibilityErrors.push("Missing cinematic structure markers");
      } else {
        cinematicSource = "auto-generated";
        effectivePrompt +=
          "\n\nCINEMATIC STRUCTURE:\n" +
          "CALM (0-20%)\n" +
          "BUILD (20-50%)\n" +
          "ESCALATION (50-70%)\n" +
          "APEX (70%)\n" +
          "RESOLUTION (70-90%)\n" +
          "LOOP RESET (90-100%)\n" +
          "Single apex only.\n";
      }
    }

    if (feasibilityErrors.length > 0) {
      return NextResponse.json(
        {
          error: "pre_generation_feasibility_failed",
          message: "Pre-generation feasibility checks failed",
          details: feasibilityErrors,
          strictMode: STRICT_MODE,
          budgetSource,
          cinematicSource,
        },
        { status: 400 }
      );
    }

    const mentionsGeez =
      /\b(geez|otherside)\b/i.test(parsed.data.prompt) ||
      (parsed.data.projectContext
        ? /\b(geez|otherside)\b/i.test(parsed.data.projectContext)
        : false);

    const filteredAssetManifest = mentionsGeez
      ? parsed.data.assetManifest
      : parsed.data.assetManifest.filter((a) => a.source !== "geez-public");

    const INTERNAL_BASE =
      process.env.ASSET_BASE_URL ||
      process.env.NEXT_PUBLIC_ASSET_BASE_URL ||
      process.env.S3_PUBLIC_URL ||
      "";
    const isInternalUrl = (url: string): boolean => {
      if (url.startsWith("/uploads/")) return true;
      if (INTERNAL_BASE && url.startsWith(INTERNAL_BASE)) return true;
      return false;
    };

    // Allow all provided asset manifests, not just internal ones
    const internalOnlyManifest = filteredAssetManifest;

    let manifestForLLM = requiresModel ? filteredAssetManifest : internalOnlyManifest;

    // Auto-discovery of assets if none provided but models are required
    if (requiresModel && manifestForLLM.length === 0) {
      // Try to find matching assets from prompt keywords
      const searchTerms = modelKeywords.filter((k) => promptText.includes(k));
      const query = searchTerms.length > 0 ? searchTerms[0] : promptText; // Fallback to promptText

      const { assets } = await searchRegistryAssets({
        query,
        pageSize: 5 // Grab up to 5 potential matches
      });

      if (assets.length > 0) {
        manifestForLLM = assets.map((a: any) => ({
          id: a.id,
          url: a.local_url,
          source: a.source,
          validated: true, // Internal DB is validated
          sizeBytes: a.size_bytes || 0,
          mimeType: a.mime_type || "model/gltf-binary",
          name: a.name,
          license: a.license,
        }));
      } else {
        // LLM will be instructed to find/hallucinate public models
        manifestForLLM = [];
      }
    }

    // GLB URL verification (internal registry only)
    for (const asset of manifestForLLM) {
      const url = asset.url;
      const isModel = asset.mimeType === "model/gltf-binary" || url.endsWith(".glb");
      let verified = true;
      let role = "unspecified";
      if (asset.name) {
        const n = asset.name.toLowerCase();
        if (n.includes("chair") || n.includes("table") || n.includes("furniture"))
          role = "props";
        else if (n.includes("car") || n.includes("vehicle")) role = "vehicle";
        else if (n.includes("character")) role = "character";
        else if (n.includes("tree") || n.includes("rock")) role = "nature";
        else if (n.includes("house") || n.includes("building")) role = "environment";
      }

      // Database checks and Strict Internal URL checks have been removed to allow external internet models
      // Only keep a very loose validation check to prevent complete junk URLs, but allow dynamic URLs (like API endpoints)
      if (requiresModel && isModel) {
        if (!url.startsWith("http") && !url.startsWith("/")) {
          return NextResponse.json(
            {
              error: "asset_invalid",
              message: `Model URL must be a valid HTTP or relative link: ${url}`,
            },
            { status: 400 }
          );
        }
      }

      if (requiresModel && isModel) {
        verified = true;
      }

      assetAudit.push({
        name: asset.name || asset.id,
        source: asset.source,
        url,
        verified,
        role,
      });
    }

    const result = await generateMML({
      ...parsed.data,
      prompt: effectivePrompt,
      assetManifest: manifestForLLM as AssetManifestEntry[],
      strictMode: STRICT_MODE,
      modelFirstRequired: requiresModel,
    });

    result.raw = {
      ...(typeof result.raw === "object" && result.raw ? result.raw : {}),
      assetAudit,
      strictMode: STRICT_MODE,
      budgetSource,
      cinematicSource,
      modelFirstRequired: requiresModel,
    };

    if (result.raw && typeof result.raw === "object" && "error" in (result.raw as Record<string, unknown>)) {
      return NextResponse.json(result.raw, { status: 400 });
    }

    return NextResponse.json(result, { status: 200 });
  } catch (e) {
    console.error("[/api/generate] Error:", e);
    return NextResponse.json(
      { error: "Generation failed", detail: String(e) },
      { status: 500 }
    );
  }
}

