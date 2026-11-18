import type { ProjectId } from "@/wab/shared/ApiSchema";
import type { Bundle } from "@/wab/shared/bundler";

export interface CanvasSnapshot {
  project: {
    id: ProjectId;
    name: string;
    createdAt: string;
    updatedAt: string;
  };
  revision: number;
  bundle: Bundle;
  dependencies: { id: string; model: Bundle }[];
  libraries: {
    name: string;
    projectId: string;
    pkgId: string;
    version: string;
    source: string;
  }[];
}
