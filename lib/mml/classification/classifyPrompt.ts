/**
 * Classification module — re-exports from the canonical classifier.
 *
 * The actual implementation lives at lib/classifier.ts.
 * This module provides the spec-compliant import path:
 *   import { classifyRequest } from "@/lib/mml/classification/classifyPrompt"
 */

export {
  classifyRequest,
  type ClassificationResult,
  type GenerationMode,
} from "@/lib/classifier";
