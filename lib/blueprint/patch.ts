import { applyPatch, type Operation, JsonPatchError, validate as validatePatch } from "fast-json-patch";
import type { BlueprintJSON, PatchOperation } from "@/types/blueprint";
import { validateBlueprint } from "./schema";

/**
 * Apply JSON Patch (RFC6902) operations to a blueprint.
 * Validates the patch first, applies it, then validates the resulting blueprint.
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
  if (!Array.isArray(patch) || patch.length === 0) {
    return { ok: false, errors: ["Patch is empty or not an array"] };
  }

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

    // Pre-validate patch operations before applying
    const validationError = validatePatch(ops, clone);
    if (validationError) {
      const errDetail = validationError instanceof JsonPatchError
        ? `${validationError.message} (op: ${validationError.operation?.op}, path: ${validationError.operation?.path})`
        : JSON.stringify(validationError, null, 2);
      return { ok: false, errors: [`Patch validation failed: ${errDetail}`] };
    }

    // Apply patch — mutateDocument=true since we already cloned
    applyPatch(clone, ops, false, true);

    // Validate the patched blueprint against schema
    return validateBlueprint(clone);
  } catch (e) {
    // Produce a readable error, never [object Object]
    let errMsg: string;
    if (e instanceof JsonPatchError) {
      errMsg = `Patch failed at path "${e.operation?.path}": ${e.message}`;
    } else if (e instanceof Error) {
      errMsg = `Patch application failed: ${e.message}`;
    } else {
      errMsg = `Patch application failed: ${JSON.stringify(e)}`;
    }
    return { ok: false, errors: [errMsg] };
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
