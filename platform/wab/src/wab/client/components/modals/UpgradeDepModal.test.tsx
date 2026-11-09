import { promptDeleteDep } from "@/wab/client/components/modals/UpgradeDepModal";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, ensureKnownTplTag } from "@/wab/shared/model/classes";
import { modelKeysForChanges } from "@/wab/shared/model-change-keys";
import { ModelRevisions } from "@/wab/shared/model-revisions";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

const current = vi.hoisted(() => ({ prompt: undefined as any }));
vi.mock("@/wab/client/components/quick-modals", () => ({
  showTemporaryPrompt: (factory) => { current.prompt = factory(vi.fn(), vi.fn()); return Promise.resolve(undefined); },
}));
vi.mock("@/wab/client/components/widgets/Modal", () => ({ Modal: ({ children }) => <section>{children}</section> }));
vi.mock("@shiguang2/components/esm/scrollbar", () => ({ Scrollbar: ({ children }) => <div>{children}</div> }));

afterEach(() => { cleanup(); revisions.dispose(); });
it("refreshes an open removal warning when admitted document references change", async () => {
  const importedSite = createSite(), importedManager = new TplMgr({ site: importedSite });
  const imported = importedManager.addComponent({ name: "Imported badge", type: ComponentType.Plain });
  const dependency = new ProjectDependency({ uuid: "imported", name: "Library", pkgId: "pkg", projectId: "project", version: "1.0.0", site: importedSite });
  const site = createSite({ projectDependencies: [dependency] }), manager = new TplMgr({ site });
  const consumer = manager.addComponent({ name: "Consumer", type: ComponentType.Plain });
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil,
    isExternalRef: (inst) => inst === dependency || inst === imported });
  await promptDeleteDep({ studioCtx: { site, modelRevisions: revisions } as unknown as StudioCtx, curDep: dependency });
  const mounted = render(current.prompt);
  try {
    expect(screen.queryByText("Some things you are using have been removed!")).toBeNull();
    act(() => {
      const changes = recorder.withRecording(() => {
        ensureKnownTplTag(consumer.tplTree).children.push(mkTplComponent(imported, consumer.variants[0]));
      });
      revisions.markModelKeysDirty(modelKeysForChanges(changes, () => undefined));
      revisions.flushModelRevisions();
    });
    expect(screen.getByText("Some things you are using have been removed!")).toBeTruthy();
    act(() => {
      const changes = recorder.withRecording(() => { ensureKnownTplTag(consumer.tplTree).children.splice(0); });
      revisions.markModelKeysDirty(modelKeysForChanges(changes, () => undefined));
      revisions.flushModelRevisions();
    });
    expect(screen.queryByText("Some things you are using have been removed!")).toBeNull();
  } finally { mounted.unmount(); recorder.dispose(); }
});

let revisions = new ModelRevisions();
beforeEach(() => { revisions = new ModelRevisions(); });
