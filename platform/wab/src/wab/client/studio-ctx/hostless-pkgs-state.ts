import { createStudioStore, resolveStore } from "@/wab/client/stores/store-kit";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { type ModelKey } from "@/wab/shared/model-revisions";

/**
 * Hostless packages whose code has been evaluated into the hostless window.
 *
 * Replaces `StudioCtx.installedHostLessPkgs` (`observable.set`). The set is read
 * by the codegen schema builder and by the package-list updater; writes bump a
 * revision key so revision-keyed derivations recompute once the packages land.
 */
export const HOSTLESS_PKGS_KEY: ModelKey = "hostlessPkgs";

export interface HostlessPkgsSnapshot {
  readonly installed: ReadonlySet<string>;
}

export function createHostlessPkgsStore() {
  return createStudioStore<HostlessPkgsSnapshot>(
    () => ({ installed: new Set<string>() }),
    { name: "studio-hostless-pkgs" },
  );
}

export type HostlessPkgsStore = ReturnType<typeof createHostlessPkgsStore>;

const fallbackHostlessStore = createHostlessPkgsStore();

function storeOf(studio: StudioCtx) {
  return resolveStore(studio.hostlessPkgsStore, fallbackHostlessStore);
}

function commit(studio: StudioCtx, installed: Set<string>): void {
  storeOf(studio).setState({ installed });
  studio.modelRevisions.markModelKeysDirty([HOSTLESS_PKGS_KEY]);
}

export function hasInstalledHostlessPkg(
  studio: StudioCtx,
  pkg: string,
): boolean {
  return storeOf(studio).getState().installed.has(pkg);
}

export function installedHostlessPkgs(studio: StudioCtx): ReadonlySet<string> {
  return storeOf(studio).getState().installed;
}

export function clearInstalledHostlessPkgs(studio: StudioCtx): void {
  if (storeOf(studio).getState().installed.size) { commit(studio, new Set()); }
}

export function addInstalledHostlessPkg(studio: StudioCtx, pkg: string): void {
  const current = storeOf(studio).getState().installed;
  if (current.has(pkg)) {
    return;
  }
  const next = new Set(current);
  next.add(pkg);
  commit(studio, next);
}

export function removeInstalledHostlessPkg(
  studio: StudioCtx,
  pkg: string,
): void {
  const current = storeOf(studio).getState().installed;
  if (!current.has(pkg)) {
    return;
  }
  const next = new Set(current);
  next.delete(pkg);
  commit(studio, next);
}
