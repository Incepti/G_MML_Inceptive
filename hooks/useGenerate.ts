"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useEditorStore } from "@/lib/store";
import type { ReasoningStep, SceneBlueprint } from "@/types/chat";
import type { BlueprintJSON, PatchOperation } from "@/types/blueprint";
import { generateMml } from "@/lib/blueprint/generateMml";
import { validateAndFixMml } from "@/lib/mml/alphaValidator";
import { applyBlueprintPatch } from "@/lib/blueprint/patch";
// Builder pipeline is now internal to generateMml()

function synthesizeReasoning(data: Record<string, unknown>): ReasoningStep[] {
  const steps: ReasoningStep[] = [];

  if (data.blueprint) {
    const bp = data.blueprint as SceneBlueprint;
    const structureTypes = bp.structures?.map((s) => s.type).join(", ") || "none";
    steps.push({
      title: "Scene Blueprint",
      content: `Environment: ${bp.environment || "unknown"}\nZones: ${bp.zones?.join(", ") || "none"}\nStructures (${bp.structures?.length || 0}): ${structureTypes}\nLighting: ${bp.lighting || "default"}\nMood: ${bp.mood || "neutral"}`,
      status: "complete",
    });
  } else if (data.explanation) {
    steps.push({
      title: "Scene Blueprint",
      content: String(data.explanation),
      status: "complete",
    });
  }

  if (data.architectureSummary) {
    steps.push({
      title: "Architecture",
      content: JSON.stringify(data.architectureSummary, null, 2),
      status: "complete",
    });
  }

  if (data.compliance) {
    const entries = Object.entries(data.compliance as Record<string, string>);
    const allPass = entries.every(([, v]) => v === "Pass");
    steps.push({
      title: "Alpha Compliance",
      content: entries.map(([k, v]) => `${k}: ${v}`).join("\n"),
      status: allPass ? "complete" : "error",
    });
  }

  return steps;
}

function blueprintToLegacySceneBlueprint(bp: BlueprintJSON): SceneBlueprint {
  return {
    environment: bp.meta.title,
    zones: [],
    structures: bp.scene.structures.map((s) => ({
      type: s.type,
      position: `x:${s.transform.x},y:${s.transform.y},z:${s.transform.z}`,
      scale: `${s.transform.sx}`,
      children: s.children?.map((c) => ({
        type: c.type,
        position: `x:${c.transform.x},y:${c.transform.y},z:${c.transform.z}`,
      })),
      attributes: s.material ? { color: s.material.color } : undefined,
    })),
    lighting: undefined,
    mood: undefined,
  };
}

export function useGenerate() {
  const store = useEditorStore();

  /**
   * Blueprint-driven generation pipeline.
   * Uses /api/ai for NEW_SCENE / PATCH responses.
   */
  const generateBlueprint = useCallback(
    async (userMessage: string) => {
      const project = store.getActiveProject();
      if (!project) return;
      const projectId = project.id;

      // 1. Add user message
      store.addChatMessage(projectId, {
        id: uuidv4(),
        role: "user",
        content: userMessage,
        timestamp: new Date().toISOString(),
      });

      // 2. Placeholder AI message
      const aiMessageId = uuidv4();
      store.addChatMessage(projectId, {
        id: aiMessageId,
        role: "assistant",
        content: "",
        reasoning: [{ title: "Analyzing prompt...", content: "", status: "pending" }],
        timestamp: new Date().toISOString(),
      });

      store.setGenerating(true);
      store.setGenerationError(null);
      store.addLog({ type: "ai", message: `[AI] request_received: "${userMessage.slice(0, 80)}..."` });

      try {
        // 3. Determine mode
        const currentBlueprint = store.currentBlueprint;
        const mode = currentBlueprint ? "PATCH" : "NEW_SCENE";

        const mmlFile = project.files.find((f) => f.name === "scene.mml");

        // 4. Call /api/ai
        // NEW_SCENE: stateless — no history, no MML, no previous context
        // PATCH: send only current blueprint + user request
        const res = await fetch("/api/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            mode,
            userMessage,
            currentBlueprint: currentBlueprint || undefined,
            projectMode: project.mode,
            // No currentMml — Claude never sees generated MML
            // No conversationHistory for NEW_SCENE — prevents context pollution
          }),
        });

        const data = await res.json();

        // Log the raw AI response type for debugging
        store.addLog({ type: "ai", message: `[AI] response_type: ${data.type || "UNKNOWN"}` });

        if (data.type === "ERROR" || (!res.ok && data.type !== "ERROR")) {
          const errMsg = data.error || "Generation failed";
          store.setGenerationError(errMsg);
          store.updateChatMessage(projectId, aiMessageId, {
            content: `Error: ${errMsg}`,
            reasoning: [{ title: "Error", content: typeof data.details === "string" ? data.details : JSON.stringify(data.details), status: "error" }],
          });
          store.addLog({ type: "error", message: `[ERR] ${errMsg}` });
          return;
        }

        // 5. Handle NEW_SCENE
        if (data.type === "NEW_SCENE") {
          const blueprint = data.blueprint as BlueprintJSON;
          const generatedMml = (data.generatedMml as string) || generateMml(blueprint);
          const { fixedMml, issues } = validateAndFixMml(generatedMml, store.lastValidMml);

          store.addLog({ type: "ai", message: `[AI] blueprint_generated: ${blueprint.scene.structures.length} structures` });
          store.addLog({ type: "info", message: `[GEN] mml_generated: ${fixedMml.length} chars` });

          if (issues.length > 0) {
            store.addLog({ type: "validation", message: `[VAL] issues_found: ${issues.length}` });
            for (const issue of issues.slice(0, 5)) {
              store.addLog({ type: issue.severity === "error" ? "error" : "warning", message: `[VAL] ${issue.message}` });
            }
          }

          const reasoning: ReasoningStep[] = [];
          if (data.explain?.reasoning) {
            reasoning.push({
              title: "Reasoning",
              content: (data.explain.reasoning as string[]).join("\n"),
              status: "complete",
            });
          }
          if (data.explain?.blueprintSummary) {
            reasoning.push({
              title: "Blueprint Summary",
              content: (data.explain.blueprintSummary as string[]).join("\n"),
              status: "complete",
            });
          }
          if (issues.length > 0) {
            reasoning.push({
              title: "Validation",
              content: issues.map((i) => `[${i.severity}] ${i.message}`).join("\n"),
              status: issues.some((i) => i.severity === "error") ? "error" : "complete",
            });
          }

          const legacyBlueprint = blueprintToLegacySceneBlueprint(blueprint);

          // Diff: show for existing scenes, apply directly for first generation
          const oldMml = mmlFile?.content || "";
          const isDefault = oldMml.includes("<!-- Your MML scene -->");
          if (oldMml && !isDefault) {
            store.setPendingDiff({ oldMml, newMml: fixedMml });
          } else {
            if (mmlFile) store.updateFileContent(projectId, mmlFile.id, fixedMml);
            store.setLastValidMml(fixedMml);
          }

          store.setBlueprint(blueprint);
          store.setValidationIssues(issues);
          store.setBlueprintOutOfSync(false);
          store.setLastAiResponse({ type: "NEW_SCENE", explain: data.explain });

          store.updateChatMessage(projectId, aiMessageId, {
            content: `Scene generated: "${blueprint.meta.title}" — ${blueprint.scene.structures.length} structures`,
            reasoning: reasoning.length > 0 ? reasoning : [{ title: "Complete", content: "Scene generated successfully.", status: "complete" }],
            generatedMml: fixedMml,
            blueprint: legacyBlueprint,
          });

          store.addLog({ type: "render", message: "[VIEW] viewer_updated" });
        }

        // 6. Handle PATCH
        if (data.type === "PATCH") {
          const patch = data.patch as PatchOperation[];

          if (!Array.isArray(patch) || patch.length === 0) {
            store.updateChatMessage(projectId, aiMessageId, {
              content: "The AI returned no changes. Try rephrasing your request or be more specific.",
              reasoning: [{ title: "Empty Patch", content: "The AI returned a PATCH response with no operations.", status: "error" }],
            });
            store.addLog({ type: "error", message: "[ERR] empty_patch: AI returned PATCH with 0 operations" });
            return;
          }

          if (!currentBlueprint) {
            store.updateChatMessage(projectId, aiMessageId, {
              content: "Error: Cannot apply patch — no existing blueprint. Try generating a new scene first.",
              reasoning: [{ title: "Error", content: "No blueprint to patch. The AI tried to modify a scene but none exists yet.", status: "error" }],
            });
            store.addLog({ type: "error", message: "[ERR] patch_no_blueprint: Cannot apply patch without an existing scene" });
            return;
          }

          // Log AI response and patch operations for debugging
          store.addLog({ type: "ai", message: `[AI] response_type: PATCH with ${patch.length} operation(s)` });
          for (const op of patch) {
            store.addLog({ type: "info", message: `[PATCH] ${op.op.toUpperCase()} ${op.path}${op.value !== undefined ? ` = ${JSON.stringify(op.value).slice(0, 120)}` : ""}` });
          }

          // Log blueprint state before patch
          store.addLog({ type: "info", message: `[PATCH] blueprint_before: ${currentBlueprint.scene.structures.length} structures, title="${currentBlueprint.meta.title}"` });

          const patchResult = applyBlueprintPatch(currentBlueprint, patch);
          if (!patchResult.ok) {
            // Readable error — never [object Object]
            const errorDetails = patchResult.errors
              .map((e) => typeof e === "string" ? e : JSON.stringify(e, null, 2))
              .join("\n");

            store.updateChatMessage(projectId, aiMessageId, {
              content: `Patch failed — keeping previous scene. ${patchResult.errors.length} error(s).`,
              reasoning: [
                { title: "Patch Error", content: errorDetails, status: "error" },
                { title: "Patch Operations", content: JSON.stringify(patch, null, 2), status: "error" },
              ],
            });
            store.addLog({ type: "error", message: `[ERR] patch_failed: ${errorDetails.slice(0, 300)}` });
            store.addLog({ type: "error", message: `[ERR] patch_ops: ${JSON.stringify(patch)}` });
            // Do NOT touch the blueprint or MML — keep previous scene intact
            return;
          }

          // Builder pipeline is now internal to generateMml()
          const newBlueprint = patchResult.blueprint;

          // Log blueprint state after patch
          store.addLog({ type: "info", message: `[PATCH] blueprint_after: ${newBlueprint.scene.structures.length} structures, title="${newBlueprint.meta.title}"` });

          const newMml = generateMml(newBlueprint);
          const { fixedMml, issues } = validateAndFixMml(newMml, store.lastValidMml);

          store.addLog({ type: "info", message: `[GEN] mml_generated: ${fixedMml.length} chars` });

          const reasoning: ReasoningStep[] = [];
          if (data.explain?.reasoning) {
            reasoning.push({ title: "Reasoning", content: (data.explain.reasoning as string[]).join("\n"), status: "complete" });
          }
          if (data.explain?.changes) {
            reasoning.push({ title: "Changes Applied", content: (data.explain.changes as string[]).join("\n"), status: "complete" });
          }
          if (issues.length > 0) {
            reasoning.push({ title: "Validation", content: issues.map((i) => `[${i.severity}] ${i.message}`).join("\n"), status: issues.some((i) => i.severity === "error") ? "error" : "complete" });
          }

          const oldMml = mmlFile?.content || "";
          store.setPendingDiff({ oldMml, newMml: fixedMml });

          store.setBlueprint(newBlueprint);
          store.setValidationIssues(issues);
          store.setBlueprintOutOfSync(false);
          store.setLastAiResponse({ type: "PATCH", explain: data.explain, patch });

          const legacyBlueprint = blueprintToLegacySceneBlueprint(newBlueprint);

          store.updateChatMessage(projectId, aiMessageId, {
            content: `Scene updated: ${patch.length} change(s) applied`,
            reasoning: reasoning.length > 0 ? reasoning : [{ title: "Complete", content: "Patch applied.", status: "complete" }],
            generatedMml: fixedMml,
            blueprint: legacyBlueprint,
          });

          store.addLog({ type: "render", message: "[VIEW] viewer_updated" });
        }

        store.addLog({ type: "ai", message: "[AI] Generation complete." });
      } catch (e) {
        const errMsg = String(e);
        store.setGenerationError(errMsg);
        store.updateChatMessage(projectId, aiMessageId, {
          content: `Error: ${errMsg}`,
          reasoning: [{ title: "Error", content: errMsg, status: "error" }],
        });
        store.addLog({ type: "error", message: `[ERR] ${errMsg}` });
      } finally {
        store.setGenerating(false);
      }
    },
    [store]
  );

  /**
   * Legacy generation pipeline (uses /api/generate).
   */
  const generateLegacy = useCallback(
    async (userMessage: string) => {
      const project = store.getActiveProject();
      if (!project) return;
      const projectId = project.id;

      store.addChatMessage(projectId, { id: uuidv4(), role: "user", content: userMessage, timestamp: new Date().toISOString() });

      const aiMessageId = uuidv4();
      store.addChatMessage(projectId, { id: aiMessageId, role: "assistant", content: "", reasoning: [{ title: "Analyzing...", content: "", status: "pending" }], timestamp: new Date().toISOString() });

      store.setGenerating(true);
      store.setGenerationError(null);

      try {
        const chatHistory = store.getChatHistory();
        const conversationHistory = chatHistory.filter((m) => m.role !== "system" && m.id !== aiMessageId).slice(-10).map((m) => ({ role: m.role as "user" | "assistant", content: m.role === "assistant" ? (m.content || "Done.") : m.content }));
        const mmlFile = project.files.find((f) => f.name === "scene.mml");
        const jsFile = project.files.find((f) => f.name === "scene.js");
        const lastBlueprint = [...chatHistory].reverse().find((m) => m.role === "assistant" && m.blueprint)?.blueprint;

        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ prompt: userMessage, mode: project.mode, assetManifest: project.assetManifest, existingMML: mmlFile?.content, existingBlueprint: lastBlueprint ? JSON.stringify(lastBlueprint) : undefined, projectContext: `Project: ${project.name}, Mode: ${project.mode}`, strictMode: store.strictMode, conversationHistory }),
        });
        const data = await res.json();

        if (!res.ok) {
          const errMsg = data.details ? `${data.error}: ${JSON.stringify(data.details)}` : data.error || "Generation failed";
          store.setGenerationError(errMsg);
          store.updateChatMessage(projectId, aiMessageId, { content: `Error: ${errMsg}`, reasoning: [{ title: "Error", content: errMsg, status: "error" }] });
          return;
        }

        const reasoning: ReasoningStep[] = data.reasoning?.steps?.map((s: { title: string; content: string }) => ({ ...s, status: "complete" as const })) || synthesizeReasoning(data);
        store.updateChatMessage(projectId, aiMessageId, { content: data.explanation || "Scene generated.", reasoning, generatedMml: data.mmlHtml, blueprint: data.blueprint || undefined });

        if (mmlFile && data.mmlHtml) store.updateFileContent(projectId, mmlFile.id, data.mmlHtml);
        if (jsFile && data.jsModule && project.mode === "dynamic") store.updateFileContent(projectId, jsFile.id, data.jsModule);
        if (data.validationReport) store.setValidation(data.validationReport);
        if (data.compliance || data.overallStatus) store.setCompliance(data.compliance || null, data.overallStatus || null);
        if (data.assetManifest) for (const asset of data.assetManifest) store.addAssetToProject(projectId, asset);
      } catch (e) {
        const errMsg = String(e);
        store.setGenerationError(errMsg);
        store.updateChatMessage(projectId, aiMessageId, { content: `Error: ${errMsg}`, reasoning: [{ title: "Error", content: errMsg, status: "error" }] });
      } finally {
        store.setGenerating(false);
      }
    },
    [store]
  );

  return { generate: generateBlueprint, generateLegacy };
}
