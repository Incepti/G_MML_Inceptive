"use client";

import { useCallback } from "react";
import { v4 as uuidv4 } from "uuid";
import { useEditorStore } from "@/lib/store";
import type { ReasoningStep, SceneBlueprint } from "@/types/chat";

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
    const entries = Object.entries(
      data.compliance as Record<string, string>
    );
    const allPass = entries.every(([, v]) => v === "Pass");
    steps.push({
      title: "Alpha Compliance",
      content: entries.map(([k, v]) => `${k}: ${v}`).join("\n"),
      status: allPass ? "complete" : "error",
    });
  }

  if (data.validationReport) {
    const report = data.validationReport as {
      valid: boolean;
      errors: { message: string }[];
      warnings: { message: string }[];
    };
    steps.push({
      title: "Code Audit",
      content: report.valid
        ? `All checks passed. ${report.warnings?.length || 0} warnings.`
        : `${report.errors.length} errors:\n${report.errors
            .map((e) => `  - ${e.message}`)
            .join("\n")}`,
      status: report.valid ? "complete" : "error",
    });
  }

  return steps;
}

export function useGenerate() {
  const store = useEditorStore();

  const generate = useCallback(
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

      // 2. Add placeholder AI message
      const aiMessageId = uuidv4();
      store.addChatMessage(projectId, {
        id: aiMessageId,
        role: "assistant",
        content: "",
        reasoning: [
          { title: "Analyzing prompt...", content: "", status: "pending" },
        ],
        timestamp: new Date().toISOString(),
      });

      store.setGenerating(true);
      store.setGenerationError(null);
      store.addLog({ type: "ai", message: `Generation started: "${userMessage.slice(0, 80)}..."` });

      try {
        // 3. Build conversation history (last 10 messages)
        const chatHistory = store.getChatHistory();
        const conversationHistory = chatHistory
          .filter((m) => m.role !== "system" && m.id !== aiMessageId)
          .slice(-10)
          .map((m) => ({
            role: m.role as "user" | "assistant",
            content: m.role === "assistant" ? (m.content || "Code generated.") : m.content,
          }));

        const mmlFile = project.files.find((f) => f.name === "scene.mml");
        const jsFile = project.files.find((f) => f.name === "scene.js");

        // 3b. Find the most recent blueprint from conversation history
        const lastBlueprint = [...chatHistory]
          .reverse()
          .find((m) => m.role === "assistant" && m.blueprint)?.blueprint;
        const existingBlueprint = lastBlueprint
          ? JSON.stringify(lastBlueprint)
          : undefined;

        // 4. Call API
        const res = await fetch("/api/generate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            prompt: userMessage,
            mode: project.mode,
            assetManifest: project.assetManifest,
            existingMML: mmlFile?.content,
            existingBlueprint,
            projectContext: `Project: ${project.name}, Mode: ${project.mode}`,
            strictMode: store.strictMode,
            conversationHistory,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          const errMsg = data.details
            ? `${data.error}: ${JSON.stringify(data.details)}`
            : data.error || "Generation failed";
          store.setGenerationError(errMsg);
          store.updateChatMessage(projectId, aiMessageId, {
            content: `Error: ${errMsg}`,
            reasoning: [{ title: "Error", content: errMsg, status: "error" }],
          });
          store.addLog({ type: "error", message: errMsg });
          return;
        }

        // 5. Parse reasoning
        const reasoning: ReasoningStep[] =
          data.reasoning?.steps?.map((s: { title: string; content: string }) => ({
            ...s,
            status: "complete" as const,
          })) || synthesizeReasoning(data);

        // 6. Update AI message
        store.updateChatMessage(projectId, aiMessageId, {
          content: data.explanation || "Scene generated successfully.",
          reasoning,
          generatedMml: data.mmlHtml,
          blueprint: data.blueprint || undefined,
        });

        // 7. Update files
        if (mmlFile && data.mmlHtml) {
          store.updateFileContent(projectId, mmlFile.id, data.mmlHtml);
        }
        if (jsFile && data.jsModule && project.mode === "dynamic") {
          store.updateFileContent(projectId, jsFile.id, data.jsModule);
        }

        // 8. Update validation/compliance
        if (data.validationReport) {
          store.setValidation(data.validationReport);
          store.addLog({
            type: "validation",
            message: `Validation: ${data.validationReport.valid ? "PASS" : "FAIL"} (${data.validationReport.errors?.length || 0} errors)`,
          });
        }
        if (data.compliance || data.overallStatus) {
          store.setCompliance(data.compliance || null, data.overallStatus || null);
        }

        // 9. Update assets
        if (data.assetManifest) {
          for (const asset of data.assetManifest) {
            store.addAssetToProject(projectId, asset);
          }
        }

        store.addLog({ type: "ai", message: "Generation complete." });
      } catch (e) {
        const errMsg = String(e);
        store.setGenerationError(errMsg);
        store.updateChatMessage(projectId, aiMessageId, {
          content: `Error: ${errMsg}`,
          reasoning: [{ title: "Error", content: errMsg, status: "error" }],
        });
        store.addLog({ type: "error", message: errMsg });
      } finally {
        store.setGenerating(false);
      }
    },
    [store]
  );

  return { generate };
}
