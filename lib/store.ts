import { create } from "zustand";
import { persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import type { Project, ProjectFile } from "@/types/project";
import type { AssetManifestEntry } from "@/types/assets";
import type { ValidationReport } from "@/types/mml";
import type { ChatMessage, LogEntry } from "@/types/chat";
import type { RendererOptions } from "@/lib/renderer/engine";
import { DEFAULT_RENDERER_OPTIONS } from "@/lib/renderer/engine";

// ─── Panel Layout ─────────────────────────────────────────────────────────
interface PanelSizes {
  sidebarWidth: number;      // right sidebar width in px
  topRowPercent: number;     // vertical split: top row height %
  viewerPercent: number;     // top row horizontal split: scene editor %
  editorPercent: number;     // bottom row horizontal split: code editor %
}

const DEFAULT_PANEL_SIZES: PanelSizes = {
  sidebarWidth: 320,
  topRowPercent: 55,
  viewerPercent: 50,
  editorPercent: 55,
};

// ─── Editor State ─────────────────────────────────────────────────────────
interface EditorState {
  // Projects
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;

  // Validation
  lastValidation: ValidationReport | null;
  isValidating: boolean;
  complianceScore: {
    Alpha: "Pass" | "Fail";
    Determinism: "Pass" | "Fail";
    Stability: "Pass" | "Fail";
    Performance: "Pass" | "Fail";
    "Model Validation": "Pass" | "Fail";
    Architecture: "Pass" | "Fail";
    "Cinematic Law": "Pass" | "Fail";
    "Injection Surface": "Pass" | "Fail";
    "Identity Consistency": "Pass" | "Fail";
  } | null;
  overallStatus: "ACCEPTED" | "REJECTED" | null;

  // Generation
  isGenerating: boolean;
  generationError: string | null;
  promptText: string;
  selectedModel: string;

  // Renderer
  rendererOptions: RendererOptions;
  strictMode: boolean;

  // Asset Browser
  assetSearchQuery: string;
  selectedAssetId: string | null;

  // Chat (per-project)
  chatHistories: Record<string, ChatMessage[]>;

  // Logs
  logs: LogEntry[];

  // Layout
  panelSizes: PanelSizes;
  assetDrawerOpen: boolean;
  settingsOpen: boolean;

  // UI State
  sidebarTab: "inspector" | "agent";
  inspectorTab: "properties" | "manifest" | "validation";

  // Sandbox
  sandboxReady: boolean;
}

interface EditorActions {
  // Project management
  createProject: (name: string, mode: "static" | "dynamic") => Project;
  setActiveProject: (id: string | null) => void;
  setActiveFile: (id: string | null) => void;
  updateFileContent: (projectId: string, fileId: string, content: string) => void;
  addAssetToProject: (projectId: string, asset: AssetManifestEntry) => void;
  setProjectValidation: (projectId: string, report: ValidationReport) => void;
  loadProjectsFromServer: (projects: Project[]) => void;

  // Validation
  setValidation: (report: ValidationReport | null) => void;
  setCompliance: (
    score: EditorState["complianceScore"],
    status: EditorState["overallStatus"]
  ) => void;
  setValidating: (v: boolean) => void;

  // Generation
  setGenerating: (v: boolean) => void;
  setGenerationError: (err: string | null) => void;
  setPromptText: (text: string) => void;
  setSelectedModel: (model: string) => void;

  // Renderer
  updateRendererOptions: (opts: Partial<RendererOptions>) => void;
  setStrictMode: (v: boolean) => void;

  // Assets
  setAssetSearchQuery: (q: string) => void;
  setSelectedAsset: (id: string | null) => void;

  // Chat
  addChatMessage: (projectId: string, message: ChatMessage) => void;
  updateChatMessage: (projectId: string, messageId: string, updates: Partial<ChatMessage>) => void;
  getChatHistory: () => ChatMessage[];
  clearChatHistory: (projectId: string) => void;

  // Logs
  addLog: (entry: Omit<LogEntry, "id" | "timestamp">) => void;
  clearLogs: () => void;

  // Layout
  setPanelSizes: (sizes: Partial<PanelSizes>) => void;
  setAssetDrawerOpen: (open: boolean) => void;
  setSettingsOpen: (open: boolean) => void;

  // UI
  setSidebarTab: (tab: "inspector" | "agent") => void;
  setInspectorTab: (tab: "properties" | "manifest" | "validation") => void;

  // Sandbox
  setSandboxReady: (ready: boolean) => void;

  // Helpers
  getActiveProject: () => Project | null;
  getActiveFile: () => ProjectFile | null;
}

type StoreState = EditorState & EditorActions;

export const useEditorStore = create<StoreState>()(
  persist(
    (set, get) => ({
      // ── Initial State ─────────────────────────────────────────────────
      projects: [],
      activeProjectId: null,
      activeFileId: null,
      lastValidation: null,
      isValidating: false,
      complianceScore: null,
      overallStatus: null,
      isGenerating: false,
      generationError: null,
      promptText: "",
      selectedModel: "anthropic/claude-3.5-sonnet",
      rendererOptions: DEFAULT_RENDERER_OPTIONS,
      strictMode: false,
      assetSearchQuery: "",
      selectedAssetId: null,
      chatHistories: {},
      logs: [],
      panelSizes: DEFAULT_PANEL_SIZES,
      assetDrawerOpen: false,
      settingsOpen: false,
      sidebarTab: "agent",
      inspectorTab: "validation",
      sandboxReady: true,

      // ── Project Actions ───────────────────────────────────────────────
      createProject: (name, mode) => {
        const now = new Date().toISOString();
        const projectId = uuidv4();
        const mmlFileId = uuidv4();

        const files: ProjectFile[] = [
          {
            id: mmlFileId,
            name: "scene.mml",
            type: "mml",
            content:
              `<m-group>\n  <!-- Your MML scene -->\n  <m-cube color="#7c3aed" y="1"></m-cube>\n</m-group>`,
            updatedAt: now,
          },
        ];

        if (mode === "dynamic") {
          files.push({
            id: uuidv4(),
            name: "scene.js",
            type: "js",
            content:
              `// Dynamic MML script\nlet tick = 0;\nsetInterval(() => {\n  tick++;\n  // Animation logic here\n}, 33);\n`,
            updatedAt: now,
          });
        }

        const project: Project = {
          id: projectId,
          name,
          mode,
          files,
          assetManifest: [],
          versions: [],
          currentVersion: 0,
          createdAt: now,
          updatedAt: now,
        };

        set((s) => ({
          projects: [project, ...s.projects],
          activeProjectId: projectId,
          activeFileId: mmlFileId,
        }));

        return project;
      },

      setActiveProject: (id) =>
        set((s) => {
          const project = s.projects.find((p) => p.id === id);
          return {
            activeProjectId: id,
            activeFileId: project?.files[0]?.id || null,
            lastValidation: null,
          };
        }),

      setActiveFile: (id) => set({ activeFileId: id }),

      updateFileContent: (projectId, fileId, content) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                updatedAt: new Date().toISOString(),
                files: p.files.map((f) =>
                  f.id === fileId
                    ? { ...f, content, updatedAt: new Date().toISOString() }
                    : f
                ),
              }
              : p
          ),
        })),

      addAssetToProject: (projectId, asset) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId
              ? {
                ...p,
                assetManifest: [
                  ...p.assetManifest.filter((a) => a.id !== asset.id),
                  asset,
                ],
              }
              : p
          ),
        })),

      setProjectValidation: (projectId, report) =>
        set((s) => ({
          projects: s.projects.map((p) =>
            p.id === projectId ? { ...p, lastValidation: report } : p
          ),
          lastValidation: report,
        })),

      loadProjectsFromServer: (projects) => set({ projects }),

      // ── Validation ────────────────────────────────────────────────────
      setValidation: (report) => set({ lastValidation: report }),
      setCompliance: (score, status) =>
        set({ complianceScore: score, overallStatus: status }),
      setValidating: (v) => set({ isValidating: v }),

      // ── Generation ────────────────────────────────────────────────────
      setGenerating: (v) => set({ isGenerating: v }),
      setGenerationError: (err) => set({ generationError: err }),
      setPromptText: (text) => set({ promptText: text }),
      setSelectedModel: (model) => set({ selectedModel: model }),

      // ── Renderer ──────────────────────────────────────────────────────
      updateRendererOptions: (opts) =>
        set((s) => ({ rendererOptions: { ...s.rendererOptions, ...opts } })),
      setStrictMode: (v) => set({ strictMode: v }),

      // ── Assets ────────────────────────────────────────────────────────
      setAssetSearchQuery: (q) => set({ assetSearchQuery: q }),
      setSelectedAsset: (id) => set({ selectedAssetId: id }),

      // ── Chat ──────────────────────────────────────────────────────────
      addChatMessage: (projectId, message) =>
        set((s) => ({
          chatHistories: {
            ...s.chatHistories,
            [projectId]: [...(s.chatHistories[projectId] || []), message],
          },
        })),

      updateChatMessage: (projectId, messageId, updates) =>
        set((s) => ({
          chatHistories: {
            ...s.chatHistories,
            [projectId]: (s.chatHistories[projectId] || []).map((m) =>
              m.id === messageId ? { ...m, ...updates } : m
            ),
          },
        })),

      getChatHistory: () => {
        const s = get();
        if (!s.activeProjectId) return [];
        return s.chatHistories[s.activeProjectId] || [];
      },

      clearChatHistory: (projectId) =>
        set((s) => ({
          chatHistories: { ...s.chatHistories, [projectId]: [] },
        })),

      // ── Logs ──────────────────────────────────────────────────────────
      addLog: (entry) =>
        set((s) => ({
          logs: [
            { ...entry, id: uuidv4(), timestamp: new Date().toISOString() },
            ...s.logs,
          ].slice(0, 500),
        })),

      clearLogs: () => set({ logs: [] }),

      // ── Layout ────────────────────────────────────────────────────────
      setPanelSizes: (sizes) =>
        set((s) => ({ panelSizes: { ...s.panelSizes, ...sizes } })),

      setAssetDrawerOpen: (open) => set({ assetDrawerOpen: open }),
      setSettingsOpen: (open) => set({ settingsOpen: open }),

      // ── UI ────────────────────────────────────────────────────────────
      setSidebarTab: (tab) => set({ sidebarTab: tab }),
      setInspectorTab: (tab) => set({ inspectorTab: tab }),

      // ── Sandbox ───────────────────────────────────────────────────────
      setSandboxReady: (ready) => set({ sandboxReady: ready }),

      // ── Helpers ───────────────────────────────────────────────────────
      getActiveProject: () => {
        const s = get();
        return s.projects.find((p) => p.id === s.activeProjectId) || null;
      },

      getActiveFile: () => {
        const s = get();
        const project = s.projects.find((p) => p.id === s.activeProjectId);
        if (!project) return null;
        return project.files.find((f) => f.id === s.activeFileId) || null;
      },
    }),
    {
      name: "geez-mml-studio",
      partialize: (state) => ({
        projects: state.projects,
        activeProjectId: state.activeProjectId,
        activeFileId: state.activeFileId,
        rendererOptions: state.rendererOptions,
        promptText: state.promptText,
        selectedModel: state.selectedModel,
        chatHistories: state.chatHistories,
        panelSizes: state.panelSizes,
      }),
    }
  )
);
