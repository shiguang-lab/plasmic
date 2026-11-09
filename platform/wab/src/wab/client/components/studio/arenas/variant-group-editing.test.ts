import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { TplMgr, VariantOptionsType } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import type { ModelRef } from "@/wab/client/studio-ctx/model-snapshots";
import type { VariantGroup } from "@/wab/shared/model/classes";
import { waitFor } from "@testing-library/react";
import { err } from "neverthrow";

it("publishes group edit requests after the successful model fence and discards thrown requests", async () => {
  const site = createSite(), mgr = new TplMgr({ site });
  const component = mgr.addComponent({ type: ComponentType.Plain, name: "Edit groups" });
  const { studioCtx: studio } = fakeStudioCtx({ site });
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  studio.dbCtx().maybeObserveComponents([component]);
  studio.createViewStateUndoRecord();
  const publish = vi.fn((ref: ModelRef<VariantGroup> | undefined) => {
    const group = studio.modelSnapshots.resolve(ensure(ref, "Published group"));
    expect(studio.modelSnapshots.field(component, "variantGroups").getState()).toContain(studio.modelSnapshots.ref(group));
  });
  const stop = studio.variantGroupEditingStore.subscribe(publish);
  try {
    await studio.changeUnsafe(() => {
      studio.siteOps().createVariantGroup(component, VariantOptionsType.singleChoice);
      expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
    });
    expect(publish).toHaveBeenCalledOnce();
    stop();
    const request = ensure(studio.variantGroupEditingStore.getState(), "Edit request");
    expect(studio.canUndo()).toBe(true);
    await studio.undo();
    expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
    expect(studio.canRedo()).toBe(true);
    await studio.redo();
    expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
    await studio.changeUnsafe(() => studio.requestVariantGroupEditing(ensure(component.variantGroups[0], "Restored group")));
    studio.consumeVariantGroupEditing(request);
    expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
    await expect(studio.changeUnsafe(() => {
      studio.requestVariantGroupEditing(ensure(component.variantGroups[0], "Existing group"));
      throw new Error("Aborted edit");
    })).rejects.toThrow("Aborted edit");
    expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
    const rejectedPublications = vi.fn();
    const stopRejected = studio.variantGroupEditingStore.subscribe(rejectedPublications);
    try {
      const result = await studio.change(() => {
        studio.requestVariantGroupEditing(ensure(component.variantGroups[0], "Existing group"));
        return err("Rejected edit");
      });
      expect(result.isErr()).toBe(true);
      expect(result._unsafeUnwrapErr()).toBe("Rejected edit");
      expect(studio.variantGroupEditingStore.getState()).toBeUndefined();
      expect(rejectedPublications).not.toHaveBeenCalled();
    } finally { stopRejected(); }
  } finally { stop(); studio.dispose(); }
});
