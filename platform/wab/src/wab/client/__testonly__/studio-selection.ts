import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { StudioSelection } from "@/wab/client/studio-ctx/studio-selection";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";

export function createStudioSelectionFixture(view?: ViewCtx) {
  const models = new ModelSnapshots();
  const selection = new StudioSelection(() => models);
  selection.set(view, []);
  return { selectionStore: selection.store };
}
