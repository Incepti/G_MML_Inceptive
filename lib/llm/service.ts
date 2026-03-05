import Anthropic from "@anthropic-ai/sdk";
import { validateMML, setMmlValidationContext, validateMmlOutput } from "@/lib/mml/validator";
import { buildSystemPrompt } from "./rules";
import type { AssetManifestEntry } from "@/types/assets";
import type { ValidationReport } from "@/types/mml";
import type { MmlOutput } from "@/lib/mml/outputContract";

const GENERATION_MODE = process.env.GENERATION_MODE || "remote";

function getAnthropicClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set. Check your .env.local file and restart the dev server.");
  }
  return new Anthropic({ apiKey });
}

export interface GenerateRequest {
  prompt: string;
  mode: "static" | "dynamic";
  projectContext?: string;
  assetManifest: AssetManifestEntry[];
  existingMML?: string;
  model?: string;
  strictMode?: boolean;
  modelFirstRequired?: boolean;
}

export interface GenerateResult {
  mmlHtml: string;
  jsModule?: string;
  assetManifest: AssetManifestEntry[];
  validationReport: ValidationReport;
  explanation: string;
  compliance?: {
    Alpha: "Pass" | "Fail";
    Determinism: "Pass" | "Fail";
    Stability: "Pass" | "Fail";
    Performance: "Pass" | "Fail";
    "Model Validation": "Pass" | "Fail";
    Architecture: "Pass" | "Fail";
    "Cinematic Law": "Pass" | "Fail";
    "Injection Surface": "Pass" | "Fail";
    "Identity Consistency": "Pass" | "Fail";
  };
  overallStatus?: "ACCEPTED" | "REJECTED";
  raw?: unknown;
}

type LLMOutput = MmlOutput;

// ─── Deterministic utilities ─────────────────────────────────────────────────

function fnv1a(input: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

function createSeededRng(seed: number): () => number {
  let state = seed >>> 0;
  const a = 1664525;
  const c = 1013904223;
  return () => {
    state = (Math.imul(state, a) + c) >>> 0;
    return state / 0xffffffff;
  };
}

function buildDeterministicAssetId(prompt: string, index: number): string {
  const h = fnv1a(`${prompt}:${index}`);
  return `gen-${h.slice(0, 8)}-${index}`;
}

// ─── Strip m-attr-anim when user didn't ask for animation ────────────────
const ANIMATION_KEYWORDS = /\b(animat|mov|rotat|spin|orbit|bounce|float|pulse|glow|flicker|wave|sway|oscillat|dynamic|motion)\w*/i;

function userWantsAnimation(prompt: string): boolean {
  return ANIMATION_KEYWORDS.test(prompt);
}

function stripAttrAnim(html: string): string {
  // Remove all m-attr-anim tags: with content, empty, or self-closing
  return html
    .replace(/<m-attr-anim[\s\S]*?<\/m-attr-anim>/gi, "")
    .replace(/<m-attr-anim[^>]*\/>/gi, "")
    .replace(/<m-attr-anim[^>]*>/gi, "") // catch any unclosed tags
    .replace(/\n\s*\n/g, "\n"); // clean up blank lines
}

// ─── Strip forbidden attributes from generated MML (server-side audit) ────
const FORBIDDEN_ATTR_NAMES = [
  "cast-shadows", "receive-shadows", "penumbra", "shadow",
  "align", "text", "onclick", "onmouseenter", "onmouseleave",
  "oncollisionstart", "oncollisionmove", "oncollisionend",
];

function stripForbiddenAttrs(html: string): string {
  let result = html;
  for (const attr of FORBIDDEN_ATTR_NAMES) {
    // Match attr="value" or attr='value' or standalone attr
    result = result.replace(new RegExp(`\\s+${attr}(?:="[^"]*"|='[^']*'|=[^\\s>]*)`, "gi"), "");
  }
  return result;
}

// ─── Fix m-label text= → content= ────────────────────────────────────────
function fixLabelAttrs(html: string): string {
  // Replace text="..." with content="..." on m-label tags
  return html.replace(
    /(<m-label\b[^>]*)\btext=/gi,
    "$1content="
  );
}

function normalizeSuccess(
  parsed: Exclude<LLMOutput, { error: string }>,
  req: GenerateRequest,
  compliance?: unknown,
  overallStatus?: "ACCEPTED" | "REJECTED"
): GenerateResult {
  const manifest: AssetManifestEntry[] = (parsed.assetManifest || []).map(
    (a, i) => ({
      id: buildDeterministicAssetId(req.prompt, i),
      url: a.url!,
      source: (a.source as AssetManifestEntry["source"]) || "registry",
      validated: a.validated ?? false,
      sizeBytes: a.sizeBytes || 0,
      mimeType: a.mimeType || "model/gltf-binary",
      name: a.name || `asset-${i}`,
      license: a.license,
    })
  );

  // ── Server-side audit pipeline (Step 5) ──
  let finalHtml = parsed.mmlHtml;

  // 1. Strip animations if user didn't ask for them
  if (!userWantsAnimation(req.prompt)) {
    finalHtml = stripAttrAnim(finalHtml);
  }

  // 2. Strip all forbidden attributes
  finalHtml = stripForbiddenAttrs(finalHtml);

  // 3. Fix m-label text= → content=
  finalHtml = fixLabelAttrs(finalHtml);

  const report = validateMML(finalHtml, parsed.jsModule);

  return {
    mmlHtml: finalHtml,
    jsModule: parsed.jsModule,
    assetManifest: manifest,
    validationReport: report,
    explanation: parsed.explanation || "",
    compliance: compliance as GenerateResult["compliance"],
    overallStatus,
    raw: { ...parsed, compliance, overallStatus },
  };
}

function buildStaticDeterministicScene(
  req: GenerateRequest,
  rng: () => number
): { mmlHtml: string; modelCount: number; lightCount: number } {
  const models = req.assetManifest.filter(
    (a) =>
      !!a.url &&
      (a.mimeType?.includes("gltf") ||
        a.url.endsWith(".glb") ||
        a.url.endsWith(".gltf"))
  );

  let modelMarkup = "";
  let modelCount = 0;

  if (models.length > 0) {
    const idx = models.length === 1 ? 0 : Math.floor(rng() * models.length);
    const chosen = models[idx];
    modelMarkup = `<m-model id="primary-model" src="${chosen.url}" x="0" y="0" z="0" rx="0" ry="0" rz="0"></m-model>`;
    modelCount = 1;
  } else {
    modelMarkup = `<m-cube id="fallback-cube" x="0" y="0.5" z="0" width="1" height="1" depth="1" color="#888888"></m-cube>`;
    modelCount = 0;
  }

  const lightCount = 1 + Math.floor(rng() * 3); // 1–3 lights
  const lights: string[] = [];
  for (let i = 0; i < lightCount; i++) {
    const angle = rng() * Math.PI * 2;
    const radius = 4 + rng() * 2;
    const x = Math.cos(angle) * radius;
    const z = Math.sin(angle) * radius;
    const y = 4 + rng() * 2;
    const type = i === 0 ? "directional" : "point";
    lights.push(
      `<m-light id="light-${i}" type="${type}" x="${x.toFixed(
        2
      )}" y="${y.toFixed(2)}" z="${z.toFixed(
        2
      )}" color="#ffffff" intensity="${(1.2 - i * 0.2).toFixed(2)}"></m-light>`
    );
  }

  const mmlHtml = `<m-group id="root-scene">
  ${modelMarkup}
  ${lights.join("\n  ")}
</m-group>`;

  return { mmlHtml, modelCount, lightCount };
}

function buildDynamicDeterministicJs(seedHex: string): string {
  return `
// CALM > BUILD > APEX > RESOLUTION > LOOP RESET
const SEED_HEX = "${seedHex}";
let tick = 0;

function fnv1a(input) {
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash >>> 0;
}

function createSeededRng(seed) {
  let state = seed >>> 0;
  const a = 1664525;
  const c = 1013904223;
  return function next() {
    state = (Math.imul(state, a) + c) >>> 0;
    return state / 0xffffffff;
  };
}

const seed = fnv1a(SEED_HEX + "GEEZ-OTHERSIDE-MML-ALPHA-V1");
const rng = createSeededRng(seed); // fnv1a + alea seed

const world = {
  step(dt) {
    // Deterministic fixed-step world; dt is 1/30 for 33ms interval
  },
};

const root = document.createElement("m-group");
document.body.appendChild(root);

const PHASES = {
  CALM: "CALM",
  BUILD: "BUILD",
  APEX: "APEX",
  RESOLUTION: "RESOLUTION",
  LOOP: "LOOP",
};

let currentPhase = PHASES.CALM;
let apexReached = false;

const MAX_TICKS = Math.floor((30 * 1000) / 33);

const interval = setInterval(() => {
  tick++;
  world.step(1 / 30);

  const t = tick / MAX_TICKS;

  if (t < 0.3) {
    currentPhase = PHASES.CALM;
  } else if (t < 0.5) {
    currentPhase = PHASES.BUILD;
  } else if (t < 0.7) {
    currentPhase = PHASES.APEX;
    apexReached = true;
  } else if (t < 0.9) {
    currentPhase = PHASES.RESOLUTION;
  } else {
    currentPhase = PHASES.LOOP;
  }

  if (tick >= MAX_TICKS) {
    clearInterval(interval);
  }
}, 33);
`;
}

function buildDeterministicOutputJson(req: GenerateRequest): string {
  const seedHex = fnv1a(req.prompt + "GEEZ-OTHERSIDE-MML-ALPHA-V1");
  const seed = parseInt(seedHex.slice(0, 8), 16) >>> 0;
  const rng = createSeededRng(seed);

  const { mmlHtml, modelCount, lightCount } = buildStaticDeterministicScene(
    req,
    rng
  );

  const hasDynamic = req.mode === "dynamic";
  const jsModule = hasDynamic ? buildDynamicDeterministicJs(seedHex) : undefined;

  const assetManifest = req.assetManifest
    .filter((a) => !!a.url)
    .map((a) => ({
      url: a.url,
      source: a.source || "registry",
      validated: a.validated ?? true,
      sizeBytes: a.sizeBytes ?? 0,
      name: a.name,
      mimeType: a.mimeType || "model/gltf-binary",
      license: a.license,
    }));

  const output: any = {
    mmlHtml:
      req.mode === "dynamic"
        ? `${mmlHtml}
<script type="module">
// Dynamic behavior provided via jsModule in the JSON contract.
</script>`
        : mmlHtml,
    jsModule,
    assetManifest,
    explanation:
      req.mode === "dynamic"
        ? "Deterministic local dynamic scene with calm-build-apex-resolution structure."
        : "Deterministic local static scene with simple ground and primary subject.",
    architectureSummary: {
      systems: ["deterministic-loop"],
      budgetSource: "local-generator",
      budgets: {
        lights: lightCount,
        models: modelCount,
        physics_bodies: 0,
        particles: 0,
        tick_rate_ms: 33,
        max_loop_duration_s: 30,
        single_apex: true,
      },
      determinismModel: "seeded-rng",
      cinematicStructure: "calm-build-apex-resolution",
    },
  };

  return JSON.stringify(output);
}

function generateDeterministicMml(req: GenerateRequest): GenerateResult {
  const jsonText = buildDeterministicOutputJson(req);
  const validation = validateMmlOutput(jsonText);

  if (!validation || !validation.ok) {
    return {
      mmlHtml: "",
      assetManifest: [],
      validationReport: validateMML(""),
      explanation: "",
      compliance: validation.compliance,
      overallStatus: "REJECTED",
      raw: {
        error: "invalid_local_output",
        message: "Deterministic local output failed validation",
        details: validation.errors,
        compliance: validation.compliance,
        overallStatus: "REJECTED",
      },
    };
  }

  const parsed = JSON.parse(jsonText) as LLMOutput;
  if (parsed && typeof parsed === "object" && "error" in parsed) {
    return {
      mmlHtml: "",
      assetManifest: [],
      validationReport: validateMML(""),
      explanation: "",
      compliance: validation.compliance,
      overallStatus: "REJECTED",
      raw: parsed,
    };
  }

  return normalizeSuccess(
    parsed as Exclude<LLMOutput, { error: string }>,
    req,
    validation.compliance,
    "ACCEPTED"
  );
}

export function testDeterminism(prompt: string): void {
  const baseReq: GenerateRequest = {
    prompt,
    mode: "dynamic",
    assetManifest: [],
  };

  const json1 = buildDeterministicOutputJson(baseReq);
  const json2 = buildDeterministicOutputJson(baseReq);

  if (json1 !== json2) {
    throw new Error("Deterministic generator produced different JSON for same prompt.");
  }

  const result1 = generateDeterministicMml(baseReq);
  const result2 = generateDeterministicMml(baseReq);

  if (result1.mmlHtml !== result2.mmlHtml) {
    throw new Error("Deterministic generator produced different mmlHtml for same prompt.");
  }

  if (JSON.stringify(result1.raw) !== JSON.stringify(result2.raw)) {
    throw new Error("Deterministic generator produced different raw payloads for same prompt.");
  }
}

function buildVerifiedAssetRegistry(
  assets: AssetManifestEntry[]
): Record<string, string> {
  const registry: Record<string, string> = {};
  for (const asset of assets) {
    if (asset?.url) registry[asset.name || asset.id] = asset.url;
  }
  return registry;
}

function buildUserMessage(req: GenerateRequest): string {
  const hasGeez =
    req.assetManifest.some((a) => a.source === "geez-public") ||
    /(\bgeez\b|\botherside\b)/i.test(req.prompt) ||
    (req.projectContext ? /(\bgeez\b|\botherside\b)/i.test(req.projectContext) : false);

  const manifestSummary =
    req.assetManifest.length > 0
      ? `\n\nAvailable Assets (use ONLY these URLs):\n${req.assetManifest
        .map((a) => `- ${a.name}: ${a.url} (${a.mimeType}, ${a.sizeBytes} bytes)`)
        .join("\n")}`
      : "";

  const geezNote = hasGeez
    ? "\n\nGeez Collection: User requested Geez/Otherside assets. Use: https://storage.googleapis.com/geez-public/GLB_MML/{ID}.glb (ID 0–5555). Pick IDs deterministically."
    : "";

  const contextSection = req.projectContext
    ? `\n\nExisting Project Context:\n${req.projectContext}`
    : "";

  const existingSection = req.existingMML
    ? `\n\nExisting MML (modify or extend this):\n${req.existingMML}`
    : "";

  const wantsAnim = userWantsAnimation(req.prompt);
  const allowedTagsList = wantsAnim
    ? "m-group, m-cube, m-sphere, m-cylinder, m-plane, m-model, m-character, m-light, m-image, m-video, m-label, m-prompt, m-attr-anim"
    : "m-group, m-cube, m-sphere, m-cylinder, m-plane, m-model, m-character, m-light, m-image, m-video, m-label, m-prompt";

  const animRule = wantsAnim
    ? ""
    : `
- ABSOLUTELY NO m-attr-anim tags. The scene must be 100% static. Any m-attr-anim tag = REJECTED.`;

  return `USER PROMPT: ${req.prompt}
${manifestSummary}${geezNote}${contextSection}${existingSection}

Follow the 5-step pipeline from your system instructions.

ENFORCEMENT RULES:
- ONLY these tags: ${allowedTagsList}
- FORBIDDEN tags: m-audio, m-link, m-interaction, m-chat-probe, m-position-probe, m-attr-lerp
- FORBIDDEN attributes: cast-shadows, receive-shadows, penumbra, shadow, align, text, onclick
- m-light type: point | directional | spot (NO "ambient")
- m-label: use content= (NEVER text=)
- m-attr-anim: use attr, start, end, duration, loop, easing (NEVER values, dur, repeat)${animRule}
- HARD CAPS: Lights ≤8, Models ≤100
- Scene MUST start with a root <m-group>
- No ground plane or floor (environment provides one)
- For m-model src: ONLY use VERIFIED_ASSET_CATALOG URLs or primitives. NEVER fabricate URLs.
- Build EXTREMELY DETAILED scenes: 30-50+ elements, every object composed from multiple primitives
- Use varied colors, metalness, roughness, opacity for realism. Use 3-5 lights minimum.

BEFORE returning your JSON, audit the code: verify no forbidden tags, no forbidden attributes, correct m-label syntax, correct m-attr-anim syntax, light count ≤8, root m-group present.

OUTPUT: mmlHtml must contain ONLY raw MML tags (e.g. <m-group>...). No <!DOCTYPE>, <html>, <head>, <body>. Return ONLY the JSON contract — no markdown, no commentary.`;
}

export async function generateMML(req: GenerateRequest): Promise<GenerateResult> {
  const verifiedAssets = buildVerifiedAssetRegistry(req.assetManifest);
  const systemPrompt = buildSystemPrompt(req.mode, { verifiedAssets });

  const defaultModel = req.model || process.env.LLM_MODEL || "claude-sonnet-4-20250514";
  const anthropic = getAnthropicClient();

  async function callLLM(extraError?: string, overrideModel?: string): Promise<string> {
    const targetModel = overrideModel || defaultModel;
    const messages: Anthropic.MessageParam[] = [
      { role: "user", content: buildUserMessage(req) },
      ...(extraError
        ? [
          {
            role: "assistant" as const,
            content: "I need to fix these issues: " + extraError,
          },
          {
            role: "user" as const,
            content: "Please try again with the fixes applied.",
          },
        ]
        : []),
    ];
    const response = await anthropic.messages.create({
      model: targetModel,
      system: systemPrompt,
      messages,
      temperature: 0.3,
      max_tokens: 16384,
    });
    const textBlock = response.content.find((b) => b.type === "text");
    return textBlock ? textBlock.text : "";
  }

  const promptNorm = (req.prompt || "").toLowerCase();
  const primitiveRequested = /\b(primitive|cube|sphere|cylinder|plane|simple geometry|test object|abstract|structural|test|demo)\b/i.test(promptNorm);
  const modelHints = /\b(environment|scene|prop|props|character|vehicle|realistic|production|asset|model|furniture|chair|table|building|terrain|landscape|tree|rock|house|city)\b/i.test(promptNorm);
  const hasActualAssets = req.assetManifest.length > 0;
  const inferredModelFirst =
    hasActualAssets && !primitiveRequested && (modelHints || /glb|gltf/.test(promptNorm));
  const modelFirstRequired = req.modelFirstRequired ?? inferredModelFirst;

  function applyValidationContext(useModelFirst: boolean) {
    setMmlValidationContext({
      verifiedAssets,
      strictUrls: req.strictMode === true || useModelFirst === true,
      mode: req.mode,
      promptText: req.prompt,
      strictMode: req.strictMode ?? false,
      modelFirstRequired: useModelFirst,
    });
  }

  applyValidationContext(modelFirstRequired);
  console.log(`[generateMML] model=${defaultModel}, mode=${req.mode}, modelFirst=${modelFirstRequired}, assets=${req.assetManifest.length}`);

  if (GENERATION_MODE === "local") {
    return generateDeterministicMml(req);
  }

  function stripAndParse(raw: string): string {
    raw = raw.trim();
    // Strip markdown fences (greedy — handles nested fences too)
    const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) raw = fenceMatch[1].trim();
    // Extract outermost JSON object by brace matching
    const firstBrace = raw.indexOf("{");
    if (firstBrace === -1) {
      console.error("[stripAndParse] No '{' found in LLM response. First 300 chars:", raw.slice(0, 300));
      return raw;
    }
    let depth = 0;
    let inString = false;
    let escape = false;
    let endIdx = -1;
    for (let i = firstBrace; i < raw.length; i++) {
      const ch = raw[i];
      if (escape) { escape = false; continue; }
      if (ch === "\\") { escape = true; continue; }
      if (ch === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (ch === "{") depth++;
      else if (ch === "}") { depth--; if (depth === 0) { endIdx = i; break; } }
    }
    if (endIdx === -1) {
      console.error("[stripAndParse] Unbalanced braces. First 300 chars:", raw.slice(0, 300));
      // Fall back to last } approach
      const lastBrace = raw.lastIndexOf("}");
      if (lastBrace > firstBrace) return raw.slice(firstBrace, lastBrace + 1);
      return raw;
    }
    const extracted = raw.slice(firstBrace, endIdx + 1);
    // Quick validation
    try {
      JSON.parse(extracted);
    } catch (e) {
      console.error("[stripAndParse] Extracted JSON still invalid:", (e as Error).message, "\nFirst 500 chars:", extracted.slice(0, 500));
    }
    return extracted;
  }

  let rawContent: string = "";
  let validation: ReturnType<typeof validateMmlOutput> = {
    ok: false,
    errors: ["Generation failed to start"],
    compliance: { Alpha: "Fail", Determinism: "Fail", Stability: "Fail", Performance: "Fail", "Model Validation": "Fail", Architecture: "Fail", "Cinematic Law": "Fail", "Injection Surface": "Fail", "Identity Consistency": "Fail" }
  };

  const MAX_RETRIES = 2;
  let attempts = 0;
  let lastErrors = "";
  let currentModel = defaultModel;
  let fellBackToPrimitives = false;

  while (attempts <= MAX_RETRIES) {
    try {
      rawContent = await callLLM(lastErrors, currentModel);
      rawContent = stripAndParse(rawContent);
      validation = validateMmlOutput(rawContent);

      if (validation.ok) {
        break;
      }

      // Check if the ONLY model-related failure is "no models present"
      const modelFirstError = validation.errors.some(
        (e) => e === "Model-first required but no models present"
      );
      const otherRealErrors = validation.errors.filter(
        (e) =>
          e !== "Model-first required but no models present" &&
          e !== "Compliance score failed one or more required categories"
      );

      if (modelFirstError && !fellBackToPrimitives) {
        // Fall back: disable model-first, re-generate with primitives
        console.log("[Model-first failed] Retrying with primitives allowed...");
        fellBackToPrimitives = true;
        applyValidationContext(false);
        lastErrors = "Model-first generation failed. Use MML primitives (m-cube, m-sphere, m-cylinder, m-plane) with appropriate colors and shapes instead of m-model. All other MML rules still apply strictly.";
        attempts++;
        continue;
      }

      // For non-JSON / missing mmlHtml: retry
      const criticalErrors = validation.errors.filter(
        (e) => e === "Output was not valid JSON" || e.includes("Missing required field")
      );
      if (criticalErrors.length > 0) {
        lastErrors = validation.errors.join("; ");
        attempts++;
        console.log(`[Re-generating] Attempt ${attempts} failed with ${currentModel}: ${lastErrors}`);
        console.log("[Raw LLM output (first 500 chars)]:", rawContent!.slice(0, 500));
        continue;
      }

      // Other non-critical warnings: accept
      if (otherRealErrors.length === 0 || otherRealErrors.every(
        (e) => e === "Missing architectureSummary" || e.includes("Compliance score")
      )) {
        console.log(`[Validation] Non-critical warnings (accepting): ${validation.errors.join("; ")}`);
        validation = { ...validation, ok: true };
        break;
      }

      // Real rule violations (forbidden tags, caps exceeded, etc.): reject
      lastErrors = validation.errors.join("; ");
      attempts++;
      console.log(`[Re-generating] Attempt ${attempts} failed with ${currentModel}: ${lastErrors}`);
    } catch (e) {
      console.error(`LLM API call failed with ${currentModel}: ${e}`);
      if (currentModel === defaultModel && attempts === 0) {
        currentModel = "claude-haiku-4-5-20251001";
        attempts++;
        console.log("API crash. Falling back to Claude Haiku...");
        continue;
      }
      throw new Error(`LLM API call failed: ${e}`);
    }
  }

  if (!validation || !validation.ok) {
    return {
      mmlHtml: "",
      assetManifest: [],
      validationReport: validateMML(""),
      explanation: "",
      compliance: validation.compliance,
      overallStatus: "REJECTED",
      raw: {
        error: "invalid_llm_output",
        message: "LLM output failed validation",
        details: validation.errors,
        compliance: validation.compliance,
        overallStatus: "REJECTED",
      },
    };
  }

  const parsed = JSON.parse(rawContent) as LLMOutput;
  if ("error" in parsed) {
    return {
      mmlHtml: "",
      assetManifest: [],
      validationReport: validateMML(""),
      explanation: "",
      compliance: validation.compliance,
      overallStatus: "REJECTED",
      raw: parsed,
    };
  }

  return normalizeSuccess(
    parsed as Exclude<LLMOutput, { error: string }>,
    req,
    validation.compliance,
    "ACCEPTED"
  );
}
