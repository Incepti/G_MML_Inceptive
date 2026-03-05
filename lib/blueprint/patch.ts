import { applyPatch, type Operation } from "fast-json-patch";
import type { BlueprintJSON, PatchOperation } from "@/types/blueprint";
import { validateBlueprint } from "./schema";

/**
 * Apply JSON Patch (RFC6902) operations to a blueprint.
 * Validates the result against the schema.
 */
export function applyBlueprintPatch(
  blueprint: BlueprintJSON,
  patch: PatchOperation[]
): {
  ok: true;
  blueprint: BlueprintJSON;
} | {
  ok: false;
  errors: string[];
} {
  try {
    // Deep clone to avoid mutation
    const clone = JSON.parse(JSON.stringify(blueprint)) as BlueprintJSON;

    // Convert our PatchOperation to fast-json-patch Operation format
    const ops: Operation[] = patch.map((p) => {
      if (p.op === "remove") {
        return { op: p.op, path: p.path };
      }
      return { op: p.op, path: p.path, value: p.value };
    });

    const result = applyPatch(clone, ops, true, false);

    // Check for errors in patch application
    const patchErrors = result
      .filter((r) => r !== null && r !== undefined)
      .map((r) => String(r));

    if (patchErrors.length > 0) {
      return { ok: false, errors: patchErrors };
    }

    // Validate the patched blueprint against schema
    return validateBlueprint(clone);
  } catch (e) {
    return { ok: false, errors: [`Patch application failed: ${e}`] };
  }
}

/**
 * Generate a human-readable summary of patch operations.
 */
export function describePatch(patch: PatchOperation[]): string[] {
  return patch.map((op) => {
    const path = op.path;
    switch (op.op) {
      case "add":
        return `Add at ${path}`;
      case "remove":
        return `Remove ${path}`;
      case "replace":
        return `Update ${path}`;
      default:
        return `${op.op} ${path}`;
    }
  });
}
