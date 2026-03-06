/**
 * MML Serializer — re-exports from split modules.
 *
 * Backward-compatible entry point. All serialization logic is now in:
 *   serializer/serializeScene.ts — scene-level rendering
 *   serializer/serializeStructure.ts — structure-level rendering + utilities
 */

export { serializeScene } from "./serializer/serializeScene";
export {
  renderStructure,
  renderPrimitive,
  kindToTag,
  transformAttrs,
  posAttrs,
  n,
  esc,
} from "./serializer/serializeStructure";
