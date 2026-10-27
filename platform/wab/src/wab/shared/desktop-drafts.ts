import type { Bundle } from "@/wab/shared/bundles";

export interface DesktopDraftSummary {
  id: string;
  projectId: string;
  projectName: string;
  branchId: string | null;
  baseRevision: number;
  sequence: number;
  savedAt: number;
  needsAttention?: boolean;
}

export interface DesktopDraft extends DesktopDraftSummary {
  format: 1;
  modelVersion: number;
  hostlessDataVersion: number;
  bundle: Bundle;
  dependencies: { id: string; model: Bundle }[];
}

export interface DesktopDraftSession {
  handle: string;
  drafts: DesktopDraftSummary[];
}

export interface DesktopDraftBridge {
  open(userId: string, projectId: string, branchId: string | null): Promise<DesktopDraftSession>;
  list(userId: string): Promise<DesktopDraftSummary[]>;
  read(handle: string, id: string): Promise<DesktopDraft | null>;
  write(handle: string, draft: DesktopDraft): Promise<void>;
  remove(handle: string, id: string, sequence: number): Promise<boolean>;
}

// Remote status retains its existing meaning for publishing and AI save receipts.
export interface DesktopDraftStatus {
  state: "pending" | "saving" | "local" | "synced" | "error" | "conflict";
  savedAt?: number;
  error?: string;
  pendingDrafts: number;
}
