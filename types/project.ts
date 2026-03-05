import type { AssetManifestEntry } from "./assets";
import type { ValidationReport } from "./mml";

export interface ProjectFile {
  id: string;
  name: string;
  type: "mml" | "js" | "css";
  content: string;
  updatedAt: string;
}

export interface ProjectVersion {
  id: string;
  projectId: string;
  version: number;
  files: ProjectFile[];
  assetManifest: AssetManifestEntry[];
  createdAt: string;
  note?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  mode: "static" | "dynamic";
  files: ProjectFile[];
  assetManifest: AssetManifestEntry[];
  versions: ProjectVersion[];
  currentVersion: number;
  createdAt: string;
  updatedAt: string;
  published?: {
    url: string;
    publishedAt: string;
    type: "static" | "dynamic";
  };
  lastValidation?: ValidationReport;
}

export interface ProjectStore {
  projects: Project[];
  activeProjectId: string | null;
  activeFileId: string | null;
  setActiveProject: (id: string) => void;
  setActiveFile: (id: string) => void;
  createProject: (name: string, mode: "static" | "dynamic") => Project;
  updateFile: (projectId: string, fileId: string, content: string) => void;
  addVersion: (projectId: string, note?: string) => void;
  rollback: (projectId: string, versionId: string) => void;
}
