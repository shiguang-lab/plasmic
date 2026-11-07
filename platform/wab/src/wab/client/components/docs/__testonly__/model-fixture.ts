import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import type { ModelCommit, StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import type { ModelChange } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { deepTrackComponents } from "@/wab/shared/core/tpls";
import type { Component, ObjInst, Site } from "@/wab/shared/model/classes";
import { ChangesType, CssVarsChangeType, type ChangeSummary } from "@/wab/shared/model/model-change-util";
import { mock, mockDeep } from "vitest-mock-extended";
import { createStore } from "zustand/vanilla";

export function createDocsModelFixture(site = createSite()) {
  const listeners = new Set<(event: ModelCommit) => void>();
  const studio = mockDeep<StudioCtx>();
  const metadata = Object.freeze({ id: "docs-test" as ProjectId, name: "Docs test", appAuthProvider: undefined, projectApiToken: "test-token", isMainBranchProtected: false, mentionUsers: Object.freeze([]) });
  Object.assign(studio, { site, modelSnapshots: new ModelSnapshots(), projectMetadataStore: createStore<ReturnType<StudioCtx["projectMetadataStore"]["getState"]>>(() => metadata), siteInfo: metadata });
  studio.subscribeModelChanges.mockImplementation((listener) => { listeners.add(listener); return () => { listeners.delete(listener); }; });
  studio.appCtx.api.addStorageItem.mockResolvedValue(undefined);
  const view = mock<ViewCtx>();
  Object.assign(view, { site, siteInfo: metadata });
  studio.focusedOrFirstViewCtx.mockReturnValue(view);
  deepTrackComponents(site);
  const ctx = new DocsPortalCtx(studio);
  const commit = (model: ObjInst, field: string, owners: Component[] = []) => {
    const node = { inst: model, field };
    const change: ModelChange = { type: "update", changeNode: node, path: [...owners.filter((owner) => owner !== model).map((inst) => ({ inst, field: "params" })), node], oldValue: undefined, newValue: Reflect.get(model, field) };
    const summary: ChangeSummary = { newTrees: new Set(), updatedNodes: new Set(), updatedComponents: new Set(owners), deepUpdatedComponents: new Set(owners), updatedRuleSets: new Map(), changesType: ChangesType.OtherChanges, styleForcesEval: false, tokenOrMixinChangeType: CssVarsChangeType.None, deletedVariantSettings: new Map(), regenMixins: new Map(), rulesReorderedComponents: new Set(), updatedDeps: new Set(), deletedDeps: new Set(), changes: [change] };
    deepTrackComponents(studio.site);
    studio.modelSnapshots.sync(summary.changes);
    listeners.forEach((listener) => listener({ type: "commit", summary }));
  };
  const replaceSite = (next: Site) => {
    studio.modelSnapshots.dispose();
    Object.assign(studio, { site: next, modelSnapshots: new ModelSnapshots() });
    Object.assign(view, { site: next });
    deepTrackComponents(next);
    listeners.forEach((listener) => listener({ type: "site-replaced", site: next }));
  };
  return { studio, ctx, commit, replaceSite, listeners };
}
