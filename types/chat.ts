export interface ReasoningStep {
  title: string;
  content: string;
  status: "pending" | "complete" | "error";
}

export interface BlueprintStructure {
  type: string;
  position: string;
  scale?: string;
  children?: BlueprintStructure[];
  attributes?: Record<string, string>;
}

export interface SceneBlueprint {
  environment: string;
  zones: string[];
  structures: BlueprintStructure[];
  lighting?: string;
  mood?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: ReasoningStep[];
  timestamp: string;
  generatedMml?: string;
  blueprint?: SceneBlueprint;
}

export interface LogEntry {
  id: string;
  type: "info" | "warning" | "error" | "ai" | "validation" | "render";
  message: string;
  timestamp: string;
  details?: string;
}
