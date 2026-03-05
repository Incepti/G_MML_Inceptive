export interface ReasoningStep {
  title: string;
  content: string;
  status: "pending" | "complete" | "error";
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  reasoning?: ReasoningStep[];
  timestamp: string;
  generatedMml?: string;
}

export interface LogEntry {
  id: string;
  type: "info" | "warning" | "error" | "ai" | "validation" | "render";
  message: string;
  timestamp: string;
  details?: string;
}
