/**
 * Model Generation — re-exports from the canonical implementation.
 *
 * The actual implementation lives at lib/assets/modelGenerator.ts.
 * This module provides the spec-compliant import path:
 *   import { generateModel, ... } from "@/lib/mml/assets/modelGeneration"
 */

export {
  isGenerationAvailable,
  validateGlbBuffer,
  generateModel,
} from "@/lib/assets/modelGenerator";
