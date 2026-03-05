// ─── MML Alpha — Official Supported Tags (Otherside / Unreal) ─────────────
// Source: ODK MML Docs (Feb 2026) + Final Brain V3 + Build System V2
//
// YES  → m-group, m-cube, m-sphere, m-cylinder, m-plane, m-model,
//         m-character, m-light, m-image, m-video, m-label, m-prompt,
//         m-attr-anim
//
// NO   → m-audio, m-position-probe, m-link, m-interaction,
//         m-chat-probe, m-attr-lerp

export const MML_ALLOWED_TAGS = [
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
] as const;

export type MMLTag = (typeof MML_ALLOWED_TAGS)[number];

// ─── Explicitly Forbidden Tags ─────────────────────────────────────────────
export const MML_FORBIDDEN_TAGS = [
  "m-audio",
  "m-position-probe",
  "m-link",
  "m-interaction",
  "m-chat-probe",
  "m-attr-lerp",
] as const;

export type MMLForbiddenTag = (typeof MML_FORBIDDEN_TAGS)[number];

// ─── Shared Transform Attributes (every m-* element) ──────────────────────
// x y z       — position in meters
// rx ry rz    — rotation in degrees
// sx sy sz    — scale multiplier
// visible     — show/hide

// ─── Shared Material Attributes (m-cube, m-sphere, m-cylinder, m-plane) ───
// color="#FF0000"          — hex color
// opacity="1"              — 0.0 to 1.0
// metalness="0"            — 0.0 to 1.0
// roughness="1"            — 0.0 to 1.0
// emissive="#000000"       — emissive / glow color
// emissive-intensity="0"   — glow strength
// src="url"                — texture image URL

// ─── MML Caps (Final Brain V3 — authoritative) ────────────────────────────
export const MML_CAPS = {
  MAX_MODELS: 100,
  MAX_LIGHTS: 8,
  MAX_PHYSICS_BODIES: 150,
  MAX_PARTICLES: 800,
  MAX_DYNAMIC_INTERVALS: 10,
  MAX_TRANSPARENCY_LAYERS: 3,
} as const;

// ─── Validation Types ──────────────────────────────────────────────────────
export interface ValidationError {
  type: "error" | "warning";
  tag?: string;
  attribute?: string;
  line?: number;
  column?: number;
  message: string;
  autoFix?: string;
}

export interface ValidationReport {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationError[];
  autoFixes: Array<{ description: string; patch: string }>;
  stats: {
    modelCount: number;
    lightCount: number;
    physicsCount: number;
    particleCount: number;
    intervalCount: number;
  };
}

// ─── Parsed MML Node ──────────────────────────────────────────────────────
export interface MMLNode {
  tag: MMLTag;
  attributes: Record<string, string>;
  children: MMLNode[];
  line?: number;
  column?: number;
}

export interface ParsedMML {
  nodes: MMLNode[];
  raw: string;
}
