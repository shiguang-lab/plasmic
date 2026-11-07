import type { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ViewVariantState } from "@/wab/client/studio-ctx/view-variant-state";
import { GlobalVariantFrame, RootComponentVariantFrame } from "@/wab/shared/component-frame";
import type { ArenaFrame, Site } from "@/wab/shared/model/classes";

/** Install the real frame/variant source when a UI fixture mocks ViewCtx commands. */
export function createViewVariantFixture(models: ModelSnapshots, site: Site, frame: ArenaFrame) {
  const owner = new ViewVariantState(() => models, () => frame, () => site, () => false, () => false);
  owner.transaction(() => {
    owner.replaceFrames([new RootComponentVariantFrame(frame)]);
    owner.setGlobal(new GlobalVariantFrame(site, frame));
  });
  return owner;
}
