import { z } from "zod";

// ─── Blueprint Transform ─────────────────────────────────────────────────────
export const TransformSchema = z.object({
  x: z.number().default(0),
  y: z.number().default(0),
  z: z.number().default(0),
  rx: z.number().default(0),
  ry: z.number().default(0),
  rz: z.number().default(0),
  sx: z.number().default(1),
  sy: z.number().default(1),
  sz: z.number().default(1),
});

export type Transform = z.infer<typeof TransformSchema>;

// ─── Blueprint Geometry ──────────────────────────────────────────────────────
export const GeometrySchema = z.object({
  kind: z.enum(["cube", "cylinder", "sphere", "plane"]).default("cube"),
  width: z.number().optional(),
  height: z.number().optional(),
  depth: z.number().optional(),
  radius: z.number().optional(),
});

export type Geometry = z.infer<typeof GeometrySchema>;

// ─── Blueprint Material ─────────────────────────────────────────────────────
export const MaterialSchema = z.object({
  color: z.string().default("#888888"),
  opacity: z.number().min(0).max(1).optional(),
  metalness: z.number().min(0).max(1).optional(),
  roughness: z.number().min(0).max(1).optional(),
  emissive: z.string().optional(),
  emissiveIntensity: z.number().optional(),
});

export type Material = z.infer<typeof MaterialSchema>;

// ─── Zone & Scene Scale ─────────────────────────────────────────────────────
export const ZoneEnum = z.enum(["NW", "N", "NE", "W", "C", "E", "SW", "S", "SE"]);
export type Zone = z.infer<typeof ZoneEnum>;

export const SceneScaleEnum = z.enum(["small", "medium", "large"]);
export type SceneScale = z.infer<typeof SceneScaleEnum>;

// ─── Blueprint Structure (recursive) ────────────────────────────────────────
export const StructureTypeEnum = z.enum([
  "wall", "tower", "building", "room", "door", "window", "prop",
  "clockTower", "light", "fence", "gate", "roof", "floor", "pillar",
  "arch", "stair", "bridge", "tree", "rock", "water", "lamp",
  "bench", "table", "chair", "sign", "barrel", "crate", "vehicle",
  "custom", "furniture", "machine", "container", "weapon", "tool",
  "creature", "nature", "character", "house", "spaceship", "animal",
  "decoration", "food", "electronics", "structure",
  "m-cube", "m-cylinder", "m-sphere", "m-plane",
]);

export type StructureType = z.infer<typeof StructureTypeEnum>;

// Define the base structure without children for recursion
const BaseStructureSchema = z.object({
  id: z.string(),
  type: StructureTypeEnum.default("custom"),
  zone: ZoneEnum.optional(),
  transform: TransformSchema.default({}),
  geometry: GeometrySchema.optional(),
  material: MaterialSchema.optional(),
  lightProps: z.object({
    type: z.enum(["point", "directional", "spot"]).default("point"),
    intensity: z.number().default(1),
    color: z.string().default("#ffffff"),
    distance: z.number().optional(),
    angle: z.number().optional(),
  }).optional(),
  modelSrc: z.string().optional(),
  modelCategory: z.string().optional(),
  modelTags: z.array(z.string()).optional(),
  label: z.string().optional(),
});

export type BlueprintStructure = z.infer<typeof BaseStructureSchema> & {
  children?: BlueprintStructure[];
};

// Use z.ZodType with any for input to avoid recursive default inference issues
export const BlueprintStructureSchema: z.ZodType<BlueprintStructure, z.ZodTypeDef, unknown> = BaseStructureSchema.extend({
  children: z.lazy(() => BlueprintStructureSchema.array()).optional(),
}) as z.ZodType<BlueprintStructure, z.ZodTypeDef, unknown>;

// ─── Blueprint Ground ───────────────────────────────────────────────────────
export const GroundSchema = z.object({
  type: z.literal("plane").default("plane"),
  width: z.number().default(50),
  height: z.number().default(50),
  color: z.string().default("#3a3a3a"),
  y: z.number().default(0),
});

export type Ground = z.infer<typeof GroundSchema>;

// ─── Pathway ────────────────────────────────────────────────────────────────
export const PathwaySchema = z.object({
  from: z.string(),
  to: z.string(),
  width: z.number().default(2),
  material: MaterialSchema.optional(),
});

export type Pathway = z.infer<typeof PathwaySchema>;

// ─── Blueprint Scene ────────────────────────────────────────────────────────
export const SceneSchema = z.object({
  rootId: z.string().default("root"),
  ground: GroundSchema.optional(),
  structures: BlueprintStructureSchema.array().default([]),
  pathways: PathwaySchema.array().optional(),
});

// ─── Blueprint Budgets ──────────────────────────────────────────────────────
export const BudgetsSchema = z.object({
  maxLights: z.number().max(8).default(8),
  maxModels: z.number().max(200).default(100),
  maxEntities: z.number().max(1000).default(500),
});

export type Budgets = z.infer<typeof BudgetsSchema>;

// ─── Blueprint Intent (classifier-driven metadata) ─────────────────────────
export const BlueprintTypeEnum = z.enum(["object", "scene"]);
export type BlueprintType = z.infer<typeof BlueprintTypeEnum>;

export const IntentSchema = z.object({
  name: z.string().default("unknown"),
  archetype: z.string().default("custom"),
});

export type Intent = z.infer<typeof IntentSchema>;

export const StyleSchema = z.object({
  theme: z.string().default("neutral"),
  detailLevel: z.enum(["low", "medium", "high"]).default("medium"),
});

export type Style = z.infer<typeof StyleSchema>;

export const CompositionSchema = z.object({
  focus: z.enum(["single", "layout", "multiple"]).default("single"),
  symmetry: z.boolean().default(false),
});

export type Composition = z.infer<typeof CompositionSchema>;

// ─── Blueprint Part (semantic part description from LLM) ────────────────────
export const PartRoleEnum = z.enum(["primary", "secondary", "support", "detail"]);
export type PartRole = z.infer<typeof PartRoleEnum>;

export const BlueprintPartSchema = z.object({
  name: z.string(),
  role: PartRoleEnum,
  shapeHint: z.string().default("box"),
  symmetry: z.boolean().default(false),
});

export type BlueprintPart = z.infer<typeof BlueprintPartSchema>;

// ─── Blueprint Meta ─────────────────────────────────────────────────────────
export const MetaSchema = z.object({
  title: z.string().default("Untitled Scene"),
  units: z.literal("meters").default("meters"),
  scaleProfile: z.enum(["human", "miniature", "large", "urban", "architectural"]).default("human"),
  sceneScale: SceneScaleEnum.default("medium"),
  seed: z.string().default("default-seed"),
});

export type Meta = z.infer<typeof MetaSchema>;

// ─── Full BlueprintJSON ─────────────────────────────────────────────────────
export const BlueprintSchema = z.object({
  type: BlueprintTypeEnum.default("scene"),
  intent: IntentSchema.default({}),
  style: StyleSchema.default({}),
  composition: CompositionSchema.default({}),
  parts: BlueprintPartSchema.array().optional(),
  meta: MetaSchema.default({}),
  budgets: BudgetsSchema.default({}),
  scene: SceneSchema.default({}),
});

export type BlueprintJSON = z.infer<typeof BlueprintSchema>;

// ─── AI Response Types ──────────────────────────────────────────────────────
export interface PatchOperation {
  op: "add" | "remove" | "replace";
  path: string;
  value?: unknown;
}

export interface AiNewSceneResponse {
  type: "NEW_SCENE";
  blueprint: BlueprintJSON;
  explain: {
    reasoning: string[];
    blueprintSummary: string[];
  };
}

export interface AiPatchResponse {
  type: "PATCH";
  patch: PatchOperation[];
  explain: {
    reasoning: string[];
    changes: string[];
  };
}

export interface AiErrorResponse {
  type: "ERROR";
  error: string;
  details?: unknown;
}

export type AiResponse = AiNewSceneResponse | AiPatchResponse | AiErrorResponse;

// ─── Validation Issue ───────────────────────────────────────────────────────
export interface ValidationIssue {
  severity: "error" | "warn";
  message: string;
  nodeHint?: string;
}

// ─── Scene State ────────────────────────────────────────────────────────────
export interface SceneState {
  blueprint: BlueprintJSON | null;
  mml: string;
  lastValidMml: string;
  errors: ValidationIssue[];
  manualEditMode: boolean;
  blueprintOutOfSync: boolean;
}
