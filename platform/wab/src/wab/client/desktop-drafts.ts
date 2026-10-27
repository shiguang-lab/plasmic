import type { DesktopDraftBridge } from "@/wab/shared/desktop-drafts";

export function desktopDraftBridge(): DesktopDraftBridge | undefined {
  return (window as Window & { desktopDrafts?: DesktopDraftBridge }).desktopDrafts;
}
