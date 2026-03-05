// ─── GEEZ MML Studio — MML Alpha Validator ────────────────────────────────
// Authority: ODK MML Docs (Feb 2026), Final Brain V3, Build System V2
import type {
  ValidationReport,
  ValidationError,
  MMLNode,
  ParsedMML,
} from "@/types/mml";
import { MML_ALLOWED_TAGS, MML_FORBIDDEN_TAGS, MML_CAPS } from "@/types/mml";
import { parseMML } from "./parser";
import type { MmlOutput } from "./outputContract";

// ─── Shared attribute sets ─────────────────────────────────────────────────
const TRANSFORM_ATTRS = new Set([
  "id", "class",
  "x", "y", "z",
  "rx", "ry", "rz",
  "sx", "sy", "sz",
  "visible",
  "onclick", "onmouseenter", "onmouseleave",
  "collide", "collision-interval",
  "oncollisionstart", "oncollisionmove", "oncollisionend",
  "debug",
]);

const MATERIAL_ATTRS = new Set([
  "color", "opacity", "metalness", "roughness",
  "emissive", "emissive-intensity",
  "src",
  "cast-shadows", "receive-shadows",
]);

const PRIM_ATTRS = new Set([...TRANSFORM_ATTRS, ...MATERIAL_ATTRS]);

// ─── Per-tag allowed attributes ────────────────────────────────────────────
const ALLOWED_ATTRS: Record<string, Set<string>> = {
  "m-group": new Set([...TRANSFORM_ATTRS]),
  "m-cube": new Set([...PRIM_ATTRS, "width", "height", "depth"]),
  "m-sphere": new Set([...PRIM_ATTRS, "radius"]),
  "m-cylinder": new Set([...PRIM_ATTRS, "radius", "height"]),
  "m-plane": new Set([...PRIM_ATTRS, "width", "height"]),
  "m-model": new Set([
    ...TRANSFORM_ATTRS,
    "src", "anim", "anim-loop", "anim-pause-on-hidden",
    "cast-shadows", "receive-shadows",
  ]),
  "m-character": new Set([...TRANSFORM_ATTRS, "src"]),
  "m-light": new Set([
    "id", "class", "type",
    "x", "y", "z", "rx", "ry", "rz",
    "color", "intensity", "distance", "angle",
    "cast-shadows", "debug",
  ]),
  "m-image": new Set([...TRANSFORM_ATTRS, "src", "width", "height", "opacity"]),
  "m-video": new Set([
    ...TRANSFORM_ATTRS,
    "src", "width", "height", "loop", "autoplay", "volume",
  ]),
  "m-label": new Set([
    ...TRANSFORM_ATTRS,
    "content", "font-size", "color", "alignment",
  ]),
  "m-prompt": new Set([...TRANSFORM_ATTRS, "message", "placeholder"]),
  "m-attr-anim": new Set([
    "attr", "start", "end", "duration",
    "loop", "easing", "ping-pong",
  ]),
};

// ─── Required attributes ───────────────────────────────────────────────────
const REQUIRED_ATTRS: Record<string, string[]> = {
  "m-model": ["src"],
  "m-character": ["src"],
  "m-image": ["src"],
  "m-video": ["src"],
  "m-light": ["type"],
  "m-attr-anim": ["attr"],
};

const VALID_LIGHT_TYPES = new Set(["point", "directional", "spot"]);

// ─── Forbidden JS patterns in dynamic scripts ──────────────────────────────
const FORBIDDEN_JS_PATTERNS: Array<{ pattern: RegExp; message: string }> = [
  { pattern: /\bwindow\b/, message: "window is not available — server-side Node.js virtual DOM only" },
  { pattern: /\brequestAnimationFrame\b/, message: "requestAnimationFrame is browser-only; use setInterval(fn, 33)" },
  { pattern: /\bcanvas\b/i, message: "Canvas API is not available in MML runtime (use node-canvas + express if needed)" },
  { pattern: /\bWebGL\b/, message: "WebGL is not available in server-side MML runtime" },
  { pattern: /\blocalStorage\b/, message: "localStorage is not available" },
  { pattern: /\bMath\.random\(\)/, message: "Math.random() is non-deterministic; use seeded alea() per Final Brain §4" },
  { pattern: /\beval\s*\(/, message: "eval() is forbidden" },
  { pattern: /\bFunction\s*\(/, message: "Function() constructor is forbidden" },
];

// ─── Count helpers ─────────────────────────────────────────────────────────
function countNodes(nodes: MMLNode[]): { modelCount: number; lightCount: number; physicsCount: number; particleCount: number } {
  const stats = { modelCount: 0, lightCount: 0, physicsCount: 0, particleCount: 0 };

  function walk(node: MMLNode) {
    if (node.tag === "m-model" || node.tag === "m-character") stats.modelCount++;
    if (node.tag === "m-light") stats.lightCount++;
    if (node.attributes["collide"]) stats.physicsCount++;
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return stats;
}

function countIntervals(js: string): number {
  return (js.match(/setInterval\s*\(/g) || []).length;
}

// ─── Forbidden/unknown tag detector ───────────────────────────────────────
function detectBadTags(html: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const tagPattern = /<([a-z][a-z0-9-]*)/gi;
  let match: RegExpExecArray | null;

  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if ((MML_FORBIDDEN_TAGS as readonly string[]).includes(tag)) {
      errors.push({
        type: "error", tag,
        message: `<${tag}> is explicitly NOT supported in Unreal Alpha — see ODK MML Docs`,
      });
    } else if (
      tag.startsWith("m-") &&
      !(MML_ALLOWED_TAGS as readonly string[]).includes(tag)
    ) {
      errors.push({
        type: "error", tag,
        message: `<${tag}> is not a recognised MML Alpha tag`,
      });
    }
  }
  return errors;
}

// ─── Node structural validator ─────────────────────────────────────────────
function validateNode(
  node: MMLNode,
  errors: ValidationError[],
  warnings: ValidationError[]
) {
  // Required attrs
  for (const req of REQUIRED_ATTRS[node.tag] || []) {
    if (!node.attributes[req]) {
      errors.push({
        type: "error", tag: node.tag, attribute: req,
        line: node.line, column: node.column,
        message: `<${node.tag}> requires attribute '${req}'`,
      });
    }
  }

  // Light type validation
  if (node.tag === "m-light" && node.attributes["type"]) {
    if (!VALID_LIGHT_TYPES.has(node.attributes["type"])) {
      errors.push({
        type: "error", tag: "m-light", attribute: "type",
        line: node.line,
        message: `m-light type must be 'point', 'directional', or 'spot' — got '${node.attributes["type"]}'`,
        autoFix: 'type="point"',
      });
    }
  }

  // src URL format check
  if (node.attributes["src"]) {
    const src = node.attributes["src"];
    if (!src.startsWith("http://") && !src.startsWith("https://") && !src.startsWith("/")) {
      errors.push({
        type: "error", tag: node.tag, attribute: "src", line: node.line,
        message: `src must be an absolute URL or root-relative path — got: '${src}'`,
      });
    }
    if (/your[-_]?\w*\.glb/i.test(src) || /example\.com/i.test(src) || /placeholder/i.test(src)) {
      warnings.push({
        type: "warning", tag: node.tag, attribute: "src", line: node.line,
        message: `src '${src.slice(0, 60)}' looks like a fabricated placeholder URL`,
      });
    }
  }

  // m-attr-anim must have attr
  if (node.tag === "m-attr-anim" && !node.attributes["attr"]) {
    errors.push({
      type: "error", tag: "m-attr-anim", attribute: "attr", line: node.line,
      message: "<m-attr-anim> requires an 'attr' attribute (e.g. attr=\"ry\")",
    });
  }

  // Undocumented attribute warnings
  const allowed = ALLOWED_ATTRS[node.tag];
  if (allowed) {
    for (const attr of Object.keys(node.attributes)) {
      if (!allowed.has(attr)) {
        warnings.push({
          type: "warning", tag: node.tag, attribute: attr, line: node.line,
          message: `Attribute '${attr}' is not documented for <${node.tag}>`,
        });
      }
    }
  }

  node.children.forEach((child) => validateNode(child, errors, warnings));
}

// ─── Main export ──────────────────────────────────────────────────────────
export function validateMML(html: string, jsCode?: string): ValidationReport {
  const errors: ValidationError[] = [];
  const warnings: ValidationError[] = [];
  const autoFixes: Array<{ description: string; patch: string }> = [];

  // Parse
  let parsed: ParsedMML;
  try {
    parsed = parseMML(html);
  } catch (e) {
    errors.push({ type: "error", message: `HTML parse error: ${e}` });
    return {
      valid: false, errors, warnings, autoFixes,
      stats: { modelCount: 0, lightCount: 0, physicsCount: 0, particleCount: 0, intervalCount: 0 },
    };
  }

  // Tag check
  errors.push(...detectBadTags(html));

  // Structure check
  parsed.nodes.forEach((n) => validateNode(n, errors, warnings));

  // Cap enforcement (Final Brain V3 §5)
  const stats = countNodes(parsed.nodes);
  const intervalCount = jsCode ? countIntervals(jsCode) : 0;

  if (stats.modelCount > MML_CAPS.MAX_MODELS)
    errors.push({ type: "error", message: `Exceeds model cap: ${stats.modelCount}/${MML_CAPS.MAX_MODELS}` });
  if (stats.lightCount > MML_CAPS.MAX_LIGHTS)
    errors.push({ type: "error", message: `Exceeds light hard cap: ${stats.lightCount}/${MML_CAPS.MAX_LIGHTS} (Final Brain §5)` });
  if (stats.physicsCount > MML_CAPS.MAX_PHYSICS_BODIES)
    errors.push({ type: "error", message: `Exceeds physics body cap: ${stats.physicsCount}/${MML_CAPS.MAX_PHYSICS_BODIES}` });
  if (intervalCount > MML_CAPS.MAX_DYNAMIC_INTERVALS)
    errors.push({ type: "error", message: `Exceeds setInterval cap: ${intervalCount}/${MML_CAPS.MAX_DYNAMIC_INTERVALS}` });

  // Near-limit warnings
  if (stats.lightCount > 6 && stats.lightCount <= MML_CAPS.MAX_LIGHTS)
    warnings.push({ type: "warning", message: `Approaching light cap: ${stats.lightCount}/8` });

  // JS validation
  if (jsCode) {
    for (const { pattern, message } of FORBIDDEN_JS_PATTERNS) {
      if (pattern.test(jsCode)) {
        errors.push({ type: "error", message: `[JS] ${message}` });
      }
    }
    if (/\bDate\.now\b/.test(jsCode)) {
      warnings.push({
        type: "warning",
        message: "[JS] Date.now() may break multiplayer determinism (Final Brain §4) — prefer tick counter",
      });
    }
  }

  return {
    valid: errors.length === 0,
    errors, warnings, autoFixes,
    stats: { ...stats, intervalCount },
  };
}

export function validateJSModule(jsCode: string): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const { pattern, message } of FORBIDDEN_JS_PATTERNS) {
    if (pattern.test(jsCode)) {
      errors.push({ type: "error", message: `[JS] ${message}` });
    }
  }
  return errors;
}

// === LLM Output Validation (Strict JSON + Alpha rules) ===
type ValidationContext = {
  verifiedAssets: Set<string>;
  strictUrls: boolean;
  mode: "static" | "dynamic";
  promptText?: string;
  strictMode?: boolean;
  modelFirstRequired?: boolean;
};

let outputValidationContext: ValidationContext = {
  verifiedAssets: new Set<string>(),
  strictUrls: true,
  mode: "static",
};

export function setMmlValidationContext(ctx: {
  verifiedAssets: Record<string, string>;
  strictUrls?: boolean;
  mode: "static" | "dynamic";
  promptText?: string;
  strictMode?: boolean;
  modelFirstRequired?: boolean;
}) {
  outputValidationContext = {
    verifiedAssets: new Set(Object.values(ctx.verifiedAssets || {})),
    strictUrls: ctx.strictUrls ?? true,
    mode: ctx.mode,
    promptText: ctx.promptText,
    strictMode: ctx.strictMode ?? false,
    modelFirstRequired: ctx.modelFirstRequired ?? false,
  };
}

function detectForbiddenTagsRaw(html: string): string[] {
  const forbidden = new Set<string>([...MML_FORBIDDEN_TAGS, "div", "span", "script", "iframe", "canvas", "a-scene", "a-entity"]);
  const tags: string[] = [];
  const tagPattern = /<\s*([a-z][a-z0-9-]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (forbidden.has(tag)) tags.push(tag);
  }
  return tags;
}

function countNodesForCaps(nodes: MMLNode[]): { modelCount: number; lightCount: number; cylinderCount: number } {
  const stats = { modelCount: 0, lightCount: 0, cylinderCount: 0 };
  function walk(node: MMLNode) {
    if (node.tag === "m-model" || node.tag === "m-character") stats.modelCount++;
    if (node.tag === "m-light") stats.lightCount++;
    if (node.tag === "m-cylinder") stats.cylinderCount++;
    node.children.forEach(walk);
  }
  nodes.forEach(walk);
  return stats;
}

function validateNodeForOutput(
  node: MMLNode,
  parent: MMLNode | null,
  errors: string[]
) {
  // Tag whitelist
  if (!(MML_ALLOWED_TAGS as readonly string[]).includes(node.tag)) {
    errors.push(`Unsupported tag: <${node.tag}>`);
  }

  // Required attributes
  if ((node.tag === "m-model" || node.tag === "m-character" || node.tag === "m-image" || node.tag === "m-video") && !node.attributes["src"]) {
    errors.push(`<${node.tag}> requires src=`);
  }
  if (node.tag === "m-light" && !node.attributes["type"]) {
    errors.push("<m-light> requires type=");
  }

  // Light type rule
  if (node.tag === "m-light" && node.attributes["type"]) {
    const t = node.attributes["type"];
    if (t !== "point" && t !== "directional" && t !== "spot") {
      errors.push(`Invalid m-light type: ${t}`);
    }
  }

  // m-attr-anim placement
  if (node.tag === "m-attr-anim") {
    if (outputValidationContext.mode === "dynamic") {
      errors.push("<m-attr-anim> is not allowed in dynamic mode");
    }
    if (!parent) {
      errors.push("<m-attr-anim> must be a child of the element it animates");
    }
  }

  // URL policy (strict)
  const src = node.attributes["src"];
  if (src && outputValidationContext.strictUrls) {
    if (!outputValidationContext.verifiedAssets.has(src)) {
      errors.push(`src URL not in verified asset registry: ${src}`);
    }
  }

  node.children.forEach((child) => validateNodeForOutput(child, node, errors));
}

export type ComplianceScore = {
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

function defaultCompliance(): ComplianceScore {
  return {
    Alpha: "Fail",
    Determinism: "Fail",
    Stability: "Fail",
    Performance: "Fail",
    "Model Validation": "Fail",
    Architecture: "Fail",
    "Cinematic Law": "Fail",
    "Injection Surface": "Fail",
    "Identity Consistency": "Fail",
  };
}

function markPass(value: boolean): "Pass" | "Fail" {
  return value ? "Pass" : "Fail";
}

function hasBudgetBlock(js: string): boolean {
  const budgetObject = /const\s+BUDGETS\s*=\s*\{[^}]*\}/i.test(js);
  const budgetLine = /BUDGETS\s*:\s*/i.test(js);
  return budgetObject || budgetLine;
}

function hasCinematicPhases(js: string): { ok: boolean; apexCount: number } {
  const phases = ["CALM", "BUILD", "APEX", "RESOLUTION", "LOOP"];
  const upper = js.toUpperCase();
  const hasAll = phases.every((p) => upper.includes(p));
  const apexCount = (upper.match(/\bAPEX\b/g) || []).length;
  return { ok: hasAll && apexCount === 1, apexCount };
}

function hasDeterministicSeed(js: string): boolean {
  return /\bfnv1a\s*\(/i.test(js) && /GEEZ-OTHERSIDE-MML-ALPHA-V1/.test(js);
}

function hasFixedTimestep(js: string): boolean {
  return /setInterval\s*\([^,]+,\s*(16|33)\s*\)/.test(js) && /world\.step\s*\(\s*1\s*\/\s*30\s*\)/.test(js);
}

function hasTickCounter(js: string): boolean {
  return /\btick\b/.test(js);
}

function hasBrowserApis(js: string): boolean {
  const patterns = [
    /\bwindow\b/,
    /\brequestAnimationFrame\b/,
    /\bcanvas\b/i,
    /\bWebGL\b/,
    /\blocalStorage\b/,
    /\bsessionStorage\b/,
    /\bfetch\s*\(/,
    /\bperformance\.now\b/,
    /\bnew Date\s*\(/,
    /\bDate\.now\s*\(/,
  ];
  return patterns.some((p) => p.test(js));
}

function hasRootCreation(js: string): boolean {
  return /document\.createElement\(\s*["']m-group["']\s*\)/.test(js) &&
    /document\.body\.appendChild\(\s*root\s*\)/.test(js);
}

function hasModuleSeparation(js: string): boolean {
  const required = ["RNG", "Timeline", "Physics", "Particles", "Chain", "Utility"];
  return required.every((name) => new RegExp(`\\b${name}\\b`, "i").test(js));
}

function hasReductionOrder(js: string): boolean {
  const required = ["Background particles", "UI overlays", "Shockwave", "Beam opacity"];
  const block = /REDUCTION_ORDER\s*=\s*\[[^\]]*\]/i.test(js);
  const includesAll = required.every((r) => new RegExp(r, "i").test(js));
  return block && includesAll;
}

function hasFailureHandling(js: string): boolean {
  const required = ["retry", "fallback", "primitive", "signal lost", "simulation"];
  return required.every((r) => new RegExp(r, "i").test(js));
}

function hasCinematicIntensity(js: string): boolean {
  const apex = /APEX_INTENSITY\s*[:=]\s*100/i.test(js);
  const subPeaks = /SUB_PEAK_MAX\s*[:=]\s*60/i.test(js);
  const resolution = /RESOLUTION_INTENSITY\s*[:=]\s*20/i.test(js);
  const reset = /RESET_WORLD_STATE|RESET_PHYSICS/i.test(js);
  return apex && subPeaks && resolution && reset;
}

function hasUnsupportedTags(html: string): boolean {
  const tagPattern = /<\s*([a-z][a-z0-9-]*)/gi;
  let match: RegExpExecArray | null;
  while ((match = tagPattern.exec(html)) !== null) {
    const tag = match[1].toLowerCase();
    if (tag.startsWith("m-") && !(MML_ALLOWED_TAGS as readonly string[]).includes(tag)) {
      return true;
    }
  }
  return false;
}

function hasPrimitives(html: string): boolean {
  return /<(m-cube|m-sphere|m-cylinder|m-plane)\b/i.test(html);
}

function promptAllowsPrimitives(promptText?: string): boolean {
  if (!promptText) return false;
  return /\b(primitive|cube|sphere|cylinder|plane)\b/i.test(promptText);
}

function hasInjectionSurfaceAttrs(node: MMLNode): boolean {
  for (const attr of Object.keys(node.attributes)) {
    if (/^on/i.test(attr)) return true;
  }
  return node.children.some(hasInjectionSurfaceAttrs);
}

export function validateMmlOutput(jsonText: string): { ok: boolean; errors: string[]; compliance: ComplianceScore } {
  const errors: string[] = [];
  const compliance = defaultCompliance();
  let parsed: MmlOutput;

  try {
    parsed = JSON.parse(jsonText) as MmlOutput;
  } catch {
    return { ok: false, errors: ["Output was not valid JSON"], compliance };
  }

  if (parsed && typeof parsed === "object" && "error" in parsed) {
    const err = (parsed as { error?: string }).error;
    const msg = (parsed as { message?: string }).message;
    if (!err || !msg) {
      return { ok: false, errors: ["Failure JSON must include error and message"], compliance };
    }
    return { ok: true, errors: [], compliance };
  }

  if (!parsed || typeof parsed !== "object" || !("mmlHtml" in parsed)) {
    return { ok: false, errors: ["Missing required field: mmlHtml"], compliance };
  }

  const mmlHtml = (parsed as { mmlHtml?: string }).mmlHtml;
  if (typeof mmlHtml !== "string" || mmlHtml.trim().length === 0) {
    return { ok: false, errors: ["mmlHtml must be a non-empty string"], compliance };
  }

  if (outputValidationContext.mode === "static" && (parsed as { jsModule?: string }).jsModule) {
    errors.push("jsModule is not allowed in static mode");
  }

  const architectureSummary = (parsed as { architectureSummary?: unknown }).architectureSummary;
  if (!architectureSummary || typeof architectureSummary !== "object") {
    errors.push("Missing architectureSummary");
  }

  // Raw forbidden tag scan
  const badTags = detectForbiddenTagsRaw(mmlHtml);
  if (badTags.length > 0) {
    errors.push(`Forbidden tags detected: ${[...new Set(badTags)].join(", ")}`);
  }

  if (hasUnsupportedTags(mmlHtml)) {
    errors.push("Unsupported MML tag detected");
  }

  if (outputValidationContext.modelFirstRequired) {
    // Relaxed constraint: Allow the LLM to use primitives (like m-plane for floors) alongside models even if not explicitly requested in the prompt.
    /*
    if (hasPrimitives(mmlHtml) && !promptAllowsPrimitives(outputValidationContext.promptText)) {
      errors.push("Primitives are not allowed unless explicitly requested");
    }
    */
    const hasModel = /<(m-model|m-character)\b/i.test(mmlHtml);
    if (!hasModel) {
      errors.push("Model-first required but no models present");
    }
  }

  // Parse MML
  let parsedMml: ParsedMML;
  try {
    parsedMml = parseMML(mmlHtml);
  } catch (e) {
    errors.push(`MML parse error: ${e}`);
    return { ok: false, errors, compliance };
  }

  // Structural rules
  for (const node of parsedMml.nodes) {
    validateNodeForOutput(node, null, errors);
  }

  // Caps
  const caps = countNodesForCaps(parsedMml.nodes);
  if (caps.lightCount > MML_CAPS.MAX_LIGHTS) {
    errors.push(`Exceeds light cap: ${caps.lightCount}/${MML_CAPS.MAX_LIGHTS}`);
  }
  if (caps.modelCount > MML_CAPS.MAX_MODELS) {
    errors.push(`Exceeds model cap: ${caps.modelCount}/${MML_CAPS.MAX_MODELS}`);
  }

  // AssetManifest URL policy (if present)
  const assetManifest = (parsed as { assetManifest?: Array<{ url?: string }> }).assetManifest;
  if (assetManifest && Array.isArray(assetManifest) && outputValidationContext.strictUrls) {
    for (const item of assetManifest) {
      if (item?.url && !outputValidationContext.verifiedAssets.has(item.url)) {
        errors.push(`assetManifest URL not in verified registry: ${item.url}`);
      }
    }
  }

  const jsModule = (parsed as { jsModule?: string }).jsModule || "";
  if (jsModule) {
    const forbiddenTokens = [
      "m-audio",
      "m-position-probe",
      "m-link",
      "m-interaction",
      "m-chat-probe",
      "m-attr-lerp",
    ];
    if (forbiddenTokens.some((t) => jsModule.includes(t))) {
      errors.push("Forbidden MML tags referenced in jsModule");
    }
    if (hasBrowserApis(jsModule)) {
      errors.push("Browser APIs detected in jsModule");
    }
  }
  const deterministic =
    (!jsModule ||
      (!/Math\.random\(\)/.test(jsModule) &&
        !/Date\.now\(\)/.test(jsModule) &&
        !hasBrowserApis(jsModule) &&
        hasTickCounter(jsModule) &&
        hasFixedTimestep(jsModule) &&
        hasDeterministicSeed(jsModule) &&
        hasRootCreation(jsModule)));

  const apexInfo = jsModule ? hasCinematicPhases(jsModule) : { ok: true, apexCount: 0 };
  if (apexInfo.apexCount > 1) {
    errors.push("Multiple apex peaks detected");
  }
  const cinematic = !jsModule ? true : (apexInfo.ok && hasCinematicIntensity(jsModule));
  const budgets = !jsModule ? true : hasBudgetBlock(jsModule);
  const injectionSurface = !parsedMml.nodes.some(hasInjectionSurfaceAttrs);
  const architecture = !jsModule ? true : hasModuleSeparation(jsModule);
  const reductionOrder = !jsModule ? true : hasReductionOrder(jsModule);
  const failureHandling = !jsModule ? true : hasFailureHandling(jsModule);

  const identityRequired = /\b(geez|otherside)\b/i.test(outputValidationContext.promptText || "");
  const identityOk = !identityRequired
    || (parsedMml.nodes.some((n) => n.tag === "m-model" && /geez-public/i.test(n.attributes["src"] || ""))
      && caps.cylinderCount >= 2
      && caps.lightCount >= 1);
  const modelValidation = errors.every((e) => !e.includes("src URL not in verified asset registry"));

  compliance.Alpha = markPass(
    badTags.length === 0 && !hasUnsupportedTags(mmlHtml) && errors.filter((e) => e.includes("requires")).length === 0
  );
  compliance.Determinism = markPass(deterministic);
  compliance.Stability = markPass(errors.length === 0 && failureHandling);
  compliance.Performance = markPass(
    caps.lightCount <= MML_CAPS.MAX_LIGHTS &&
    caps.modelCount <= MML_CAPS.MAX_MODELS &&
    reductionOrder
  );
  compliance["Model Validation"] = markPass(modelValidation);
  compliance["Identity Consistency"] = markPass(identityOk);
  compliance.Architecture = markPass(architecture);
  compliance["Cinematic Law"] = markPass(cinematic);
  compliance["Injection Surface"] = markPass(injectionSurface);

  const ordered: (keyof ComplianceScore)[] = [
    "Alpha",
    "Determinism",
    "Stability",
    "Performance",
    "Model Validation",
    "Identity Consistency",
    "Architecture",
    "Cinematic Law",
    "Injection Surface",
  ];
  let higherFailed = false;
  for (const key of ordered) {
    if (higherFailed) {
      compliance[key] = "Fail";
      continue;
    }
    if (compliance[key] === "Fail") higherFailed = true;
  }

  if (outputValidationContext.strictMode) {
    if (!budgets) errors.push("Missing explicit budgets in strict mode");
    if (!apexInfo.ok) errors.push("Missing cinematic structure in strict mode");
  }

  const requiredPass = Object.values(compliance).every((v) => v === "Pass");
  if (!requiredPass) {
    errors.push("Compliance score failed one or more required categories");
  }

  return { ok: errors.length === 0, errors, compliance };
}
