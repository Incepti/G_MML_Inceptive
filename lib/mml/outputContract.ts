export type MmlSuccessOutput = {
  mmlHtml: string;
  jsModule?: string;
  assetManifest?: Array<{
    url: string;
    source?: string;
    validated?: boolean;
    sizeBytes?: number;
    name?: string;
    mimeType?: string;
    license?: string;
  }>;
  explanation?: string;
  architectureSummary?: {
    systems: string[];
    budgetSource: "user" | "default";
    budgets: {
      lights: number;
      models: number;
      physics_bodies: number;
      particles: number;
      tick_rate_ms: number;
      max_loop_duration_s: number;
      single_apex: boolean;
    };
    determinismModel: string;
    cinematicStructure: string;
  };
  compliance?: {
    Alpha: "Pass" | "Fail";
    Determinism: "Pass" | "Fail";
    Stability: "Pass" | "Fail";
    Performance: "Pass" | "Fail";
    "Model Validation": "Pass" | "Fail";
    Architecture: "Pass" | "Fail";
    "Cinematic Law": "Pass" | "Fail";
    "Injection Surface": "Pass" | "Fail";
    "Identity Consistency": "Pass" | "Fail";
  };
  overallStatus?: "ACCEPTED" | "REJECTED";
  reasoning?: {
    steps: Array<{
      title: string;
      content: string;
    }>;
  };
};

export type MmlErrorOutput = {
  error: string;
  message: string;
  details?: unknown;
};

export type MmlOutput = MmlSuccessOutput | MmlErrorOutput;

export const OUTPUT_CONTRACT = `
OUTPUT FORMAT (STRICT JSON ONLY)

You MUST return ONLY ONE of the following JSON structures.
No extra text. No markdown. No comments.

SUCCESS:
{
  "mmlHtml": "<valid MML string>",
  "jsModule": "<optional deterministic JS>",
  "assetManifest": [
    {
      "url": "https://...",
      "source": "trusted-index|upload|external-validated|geez-public",
      "validated": true,
      "sizeBytes": 0,
      "name": "...",
      "mimeType": "model/gltf-binary"
    }
  ],
  "explanation": "Brief description of what was generated",
  "reasoning": {
    "steps": [
      {"title": "Scene Blueprint", "content": "Layout and structure plan"},
      {"title": "Scale Plan", "content": "Proportions and measurements"},
      {"title": "Alpha Compliance", "content": "Rule validation results"},
      {"title": "Code Audit", "content": "Final code review results"}
    ]
  },
  "architectureSummary": {
    "systems": ["RNG", "Timeline", "Physics", "Particles", "Chain", "Utility"],
    "budgetSource": "user|default",
    "budgets": {
      "lights": 4,
      "models": 10,
      "physics_bodies": 50,
      "particles": 200,
      "tick_rate_ms": 33,
      "max_loop_duration_s": 60,
      "single_apex": true
    },
    "determinismModel": "fnv1a + alea seed",
    "cinematicStructure": "CALM > BUILD > ESCALATION > APEX > RESOLUTION > LOOP RESET"
  },
  "compliance": {
    "Alpha": "Pass|Fail",
    "Determinism": "Pass|Fail",
    "Stability": "Pass|Fail",
    "Performance": "Pass|Fail",
    "Model Validation": "Pass|Fail",
    "Architecture": "Pass|Fail",
    "Cinematic Law": "Pass|Fail",
    "Injection Surface": "Pass|Fail",
    "Identity Consistency": "Pass|Fail"
  },
  "overallStatus": "ACCEPTED|REJECTED"
}

FAILURE:
{
  "error": "<error_code>",
  "message": "<reason>",
  "details": "<optional details>"
}
`;
