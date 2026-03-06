/**
 * Model Generator — text-to-3D model generation pipeline.
 *
 * Supports multiple providers via a pluggable architecture:
 * - Meshy.ai (primary, free tier available)
 * - Stability AI 3D
 * - Generic webhook endpoint
 *
 * Pipeline: text prompt → provider API → poll for result → download GLB
 *           → quality check → upload to storage → return URL
 *
 * If no provider is configured (no API key), generation gracefully
 * returns null and the pipeline falls through to procedural building.
 *
 * Server-only module.
 */

import { v4 as uuidv4 } from "uuid";
import { uploadAsset, type UploadInput } from "@/lib/assets/storage";
import { storeModel } from "@/lib/assets/assetLibrary";
import type { ModelLibraryEntry, ModelProvider } from "@/types/assets";

// ─── Configuration ──────────────────────────────────────────────────────────

interface GeneratorConfig {
  provider: ModelProvider;
  apiKey: string;
  endpoint?: string;
}

function getConfig(): GeneratorConfig | null {
  // Meshy.ai (primary)
  if (process.env.MESHY_API_KEY) {
    return {
      provider: "meshy",
      apiKey: process.env.MESHY_API_KEY,
      endpoint: process.env.MESHY_API_ENDPOINT || "https://api.meshy.ai/v2",
    };
  }

  // Stability AI
  if (process.env.STABILITY_API_KEY) {
    return {
      provider: "stability",
      apiKey: process.env.STABILITY_API_KEY,
      endpoint: process.env.STABILITY_3D_ENDPOINT || "https://api.stability.ai/v2beta/3d/stable-fast-3d",
    };
  }

  // TripoSR / generic
  if (process.env.TRIPOSR_API_KEY) {
    return {
      provider: "triposr",
      apiKey: process.env.TRIPOSR_API_KEY,
      endpoint: process.env.TRIPOSR_API_ENDPOINT || "https://api.tripo3d.ai/v2/openapi",
    };
  }

  return null;
}

/**
 * Check if model generation is available (API key configured).
 */
export function isGenerationAvailable(): boolean {
  return getConfig() !== null;
}

// ─── Quality Check ──────────────────────────────────────────────────────────

const GLB_MAGIC = 0x46546C67; // "glTF" in little-endian
const MAX_MODEL_SIZE = 50 * 1024 * 1024; // 50MB

/**
 * Validate a GLB buffer for quality and correctness.
 * Rejects files that are not GLB, exceed 50MB, or have invalid headers.
 */
export function validateGlbBuffer(buffer: Buffer): {
  valid: boolean;
  reason?: string;
} {
  if (buffer.length === 0) {
    return { valid: false, reason: "Empty buffer" };
  }

  if (buffer.length > MAX_MODEL_SIZE) {
    return { valid: false, reason: `File exceeds ${MAX_MODEL_SIZE / 1024 / 1024}MB limit` };
  }

  // Check GLB magic number (first 4 bytes)
  if (buffer.length < 12) {
    return { valid: false, reason: "File too small to be a valid GLB" };
  }

  const magic = buffer.readUInt32LE(0);
  if (magic !== GLB_MAGIC) {
    return { valid: false, reason: "Invalid GLB magic number — not a valid GLB file" };
  }

  // Check GLB version (bytes 4-7, should be 2)
  const version = buffer.readUInt32LE(4);
  if (version !== 2) {
    return { valid: false, reason: `Unsupported GLB version: ${version}` };
  }

  // Check declared length matches buffer
  const declaredLength = buffer.readUInt32LE(8);
  if (declaredLength > buffer.length) {
    return { valid: false, reason: "GLB declared length exceeds actual buffer size" };
  }

  return { valid: true };
}

// ─── Provider Implementations ───────────────────────────────────────────────

/**
 * Generate a 3D model via Meshy.ai API.
 * Creates a text-to-3D task, polls for completion, downloads the GLB.
 */
async function generateViaMeshy(
  prompt: string,
  config: GeneratorConfig,
): Promise<Buffer | null> {
  const { apiKey, endpoint } = config;

  // Step 1: Create text-to-3D task
  const createRes = await fetch(`${endpoint}/text-to-3d`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      mode: "preview",
      prompt,
      art_style: "realistic",
      negative_prompt: "low quality, blurry, distorted",
    }),
  });

  if (!createRes.ok) {
    console.error(`Meshy task creation failed: ${createRes.status}`);
    return null;
  }

  const { result: taskId } = (await createRes.json()) as { result: string };
  if (!taskId) return null;

  // Step 2: Poll for completion (max 5 minutes, 10s intervals)
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(10_000);

    const statusRes = await fetch(`${endpoint}/text-to-3d/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) continue;

    const task = (await statusRes.json()) as {
      status: string;
      model_urls?: { glb?: string };
    };

    if (task.status === "SUCCEEDED" && task.model_urls?.glb) {
      // Step 3: Download the GLB
      const glbRes = await fetch(task.model_urls.glb);
      if (!glbRes.ok) return null;
      return Buffer.from(await glbRes.arrayBuffer());
    }

    if (task.status === "FAILED" || task.status === "EXPIRED") {
      console.error(`Meshy task ${taskId} failed: ${task.status}`);
      return null;
    }
  }

  console.error(`Meshy task ${taskId} timed out after ${maxAttempts * 10}s`);
  return null;
}

/**
 * Generate a 3D model via Stability AI Stable Fast 3D API.
 */
async function generateViaStability(
  prompt: string,
  config: GeneratorConfig,
): Promise<Buffer | null> {
  const { apiKey, endpoint } = config;

  const res = await fetch(endpoint!, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "model/gltf-binary",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) {
    console.error(`Stability 3D generation failed: ${res.status}`);
    return null;
  }

  return Buffer.from(await res.arrayBuffer());
}

/**
 * Generate a 3D model via TripoSR / Tripo3D API.
 */
async function generateViaTripoSR(
  prompt: string,
  config: GeneratorConfig,
): Promise<Buffer | null> {
  const { apiKey, endpoint } = config;

  // Step 1: Create task
  const createRes = await fetch(`${endpoint}/task`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      type: "text_to_model",
      prompt,
      model_version: "default",
      output_format: "glb",
    }),
  });

  if (!createRes.ok) {
    console.error(`TripoSR task creation failed: ${createRes.status}`);
    return null;
  }

  const createData = (await createRes.json()) as {
    data?: { task_id?: string };
  };
  const taskId = createData.data?.task_id;
  if (!taskId) return null;

  // Step 2: Poll for completion
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    await sleep(10_000);

    const statusRes = await fetch(`${endpoint}/task/${taskId}`, {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (!statusRes.ok) continue;

    const statusData = (await statusRes.json()) as {
      data?: {
        status?: string;
        output?: { model?: string };
      };
    };

    const status = statusData.data?.status;

    if (status === "success" && statusData.data?.output?.model) {
      const glbRes = await fetch(statusData.data.output.model);
      if (!glbRes.ok) return null;
      return Buffer.from(await glbRes.arrayBuffer());
    }

    if (status === "failed") {
      console.error(`TripoSR task ${taskId} failed`);
      return null;
    }
  }

  console.error(`TripoSR task ${taskId} timed out`);
  return null;
}

// ─── Main Generation Pipeline ───────────────────────────────────────────────

/**
 * Generate a 3D model from a text prompt, validate it, upload to storage,
 * and store in the model library.
 *
 * Returns the ModelLibraryEntry if successful, null otherwise.
 * Gracefully returns null if no provider is configured.
 */
export async function generateModel(opts: {
  name: string;
  prompt: string;
  category: string;
  tags: string[];
}): Promise<ModelLibraryEntry | null> {
  const config = getConfig();
  if (!config) return null;

  // Build an effective prompt for the 3D model
  const effectivePrompt = buildModelPrompt(opts.name, opts.prompt, opts.category);

  // Generate via the configured provider
  let buffer: Buffer | null = null;

  try {
    switch (config.provider) {
      case "meshy":
        buffer = await generateViaMeshy(effectivePrompt, config);
        break;
      case "stability":
        buffer = await generateViaStability(effectivePrompt, config);
        break;
      case "triposr":
        buffer = await generateViaTripoSR(effectivePrompt, config);
        break;
    }
  } catch (err) {
    console.error(`Model generation error (${config.provider}):`, err);
    return null;
  }

  if (!buffer) return null;

  // Quality check
  const quality = validateGlbBuffer(buffer);
  if (!quality.valid) {
    console.error(`Generated model failed quality check: ${quality.reason}`);
    return null;
  }

  // Upload to storage
  const filename = `${opts.category}/${opts.name}-${uuidv4().slice(0, 8)}.glb`;
  let uploadResult;
  try {
    uploadResult = await uploadAsset({
      buffer,
      originalName: filename,
      mimeType: "model/gltf-binary",
      sizeBytes: buffer.length,
    });
  } catch (err) {
    console.error("Failed to upload generated model:", err);
    return null;
  }

  // Store in model library
  const entry = await storeModel({
    name: opts.name.toLowerCase(),
    tags: opts.tags,
    category: opts.category,
    modelUrl: uploadResult.url,
    source: "generated",
    provider: config.provider,
    sizeBytes: buffer.length,
  });

  return entry;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildModelPrompt(name: string, context: string, category: string): string {
  const parts = [
    `A 3D model of a ${name}`,
    category !== "prop" ? `(${category})` : "",
    "for a virtual world scene.",
    "Clean geometry, game-ready, low-poly style.",
    context ? `Context: ${context}` : "",
  ];
  return parts.filter(Boolean).join(" ");
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
