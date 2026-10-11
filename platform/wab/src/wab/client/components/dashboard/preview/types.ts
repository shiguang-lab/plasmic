import type { DevFlagsType } from "@/wab/shared/devflags";

export interface PreviewRequest {
  projectId: string;
  revision: number;
  flags: DevFlagsType;
  staticBaseUrl: string;
}

export interface ArtboardBounds {
  width: number;
  height: number;
  left: number;
  top: number;
}

export const previewFormat = "canvas-overview-v1";
export const previewChannel = "plasmic-canvas-preview";

export const previewCanvasBackground = "#e8e9ef";
