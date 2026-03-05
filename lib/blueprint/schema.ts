import { BlueprintSchema, type BlueprintJSON } from "@/types/blueprint";

/**
 * Validate a blueprint object against the strict Zod schema.
 * Returns the parsed blueprint (with defaults applied) or throws.
 */
export function validateBlueprint(input: unknown): {
  ok: true;
  blueprint: BlueprintJSON;
} | {
  ok: false;
  errors: string[];
} {
  const result = BlueprintSchema.safeParse(input);
  if (result.success) {
    return { ok: true, blueprint: result.data };
  }
  const errors = result.error.issues.map(
    (issue) => `${issue.path.join(".")}: ${issue.message}`
  );
  return { ok: false, errors };
}

/**
 * Parse and normalize a blueprint with defaults applied.
 * Throws on invalid input.
 */
export function parseBlueprint(input: unknown): BlueprintJSON {
  return BlueprintSchema.parse(input);
}

/**
 * Create a minimal empty blueprint.
 */
export function createEmptyBlueprint(title?: string, seed?: string): BlueprintJSON {
  return BlueprintSchema.parse({
    meta: { title: title || "Untitled Scene", seed: seed || "default-seed" },
    budgets: {},
    scene: { structures: [] },
  });
}
