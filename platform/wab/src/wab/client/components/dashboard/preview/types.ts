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

/**
 * Cached previews stay valid across app builds while the project revision and
 * this format match. Bump it when a change alters rendered previews (engine,
 * code generation, runtime or bundled component libraries) to regenerate them.
 */
export const previewFormat = "canvas-overview-v1";
export const previewChannel = "plasmic-canvas-preview";

export const previewCanvasBackground = "#e8e9ef";
