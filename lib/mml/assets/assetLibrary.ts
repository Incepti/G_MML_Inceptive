/**
 * Asset Library — re-exports from the canonical implementation.
 *
 * The actual implementation lives at lib/assets/assetLibrary.ts.
 * This module provides the spec-compliant import path:
 *   import { findModels, ... } from "@/lib/mml/assets/assetLibrary"
 */

export {
  MAX_MODELS_PER_NAME,
  findModels,
  getModelCount,
  shouldGenerateModel,
  selectModelDeterministic,
  recordModelUsage,
  storeModel,
} from "@/lib/assets/assetLibrary";
