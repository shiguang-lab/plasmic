import { ContentEditorControlInputs } from "@/wab/client/components/canvas/content-editor-control-inputs";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { mkTplTagX, TplTagType } from "@/wab/shared/core/tpls";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { mock } from "vitest-mock-extended";

it("tracks content eligibility and boundaries, ignoring labels and detaching on close", () => {
  const child = mkTplTagX("span");
  const root = mkTplTagX("div", {}, [child]);
  const recorder = new ChangeRecorder({ inst: root, _instUtil: instUtil });
  const models = new ModelSnapshots();
  const signal = new AbortController();
  const studio = mock<StudioCtx>();
  Object.defineProperty(studio, "modelSnapshots", { value: models });
  const view = mock<ViewCtx>();
  Object.defineProperties(view, { studioCtx: { value: studio }, disposeSignal: { value: signal.signal } });
  view.focusedTplAncestorsThroughComponents.mockReturnValue([{ node: root, layer: 0 }]);
  const source = new ContentEditorControlInputs(view);
  const publish = vi.fn();
  const stop = source.subscribe(publish);
  const commit = (command: () => void) => models.sync(recorder.withRecording(command).changes);
  publish.mockClear();
  try {
    const before = source.getSnapshot();
    commit(() => { child.name = "Not an eligibility input"; });
    expect(source.getSnapshot()).toBe(before);
    expect(publish).not.toHaveBeenCalled();
    commit(() => { root.type = TplTagType.Text; });
    expect(publish).toHaveBeenCalledOnce();
    publish.mockClear();
    commit(() => { root.children = []; });
    expect(publish).toHaveBeenCalledOnce();
    publish.mockClear();
    signal.abort();
    expect(publish).toHaveBeenCalledOnce();
    expect(source.getSnapshot().alive).toBe(false);
    publish.mockClear();
    commit(() => { root.type = TplTagType.Other; });
    expect(publish).not.toHaveBeenCalled();
  } finally { stop(); models.dispose(); recorder.dispose(); }
});
