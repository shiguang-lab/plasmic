import { CanvasObserverContext } from "@/wab/client/components/canvas/canvas-observer-context";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { emptyViewSelection } from "@/wab/client/studio-ctx/view-selection";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import { createStore } from "zustand/vanilla";

it("publishes context changes even when a consistency check reads prepared inputs first", () => {
  const first = mkComponent({ name: "First", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  const second = mkComponent({ name: "Second", type: ComponentType.Plain, tplTree: mkTplTagX("div") });
  let component = first;
  const lifetime = new AbortController(), variants = createStore(() => ({}));
  const view = {
    selectionStore: createStore(() => emptyViewSelection), variantStore: variants,
    frameState: { valRootStore: createStore(() => undefined) }, disposeSignal: lifetime.signal,
    currentComponent: () => component, componentStackFrames: () => [],
    valComponentStack: () => [], showDefaultSlotContents: () => false,
  } as unknown as ViewCtx;
  const source = new CanvasObserverContext(view), changed = vi.fn();
  const stop = source.subscribe(changed);
  try {
    expect(source.read().current).toBe(first);
    component = second;
    expect(source.read().current).toBe(second);
    expect(changed).not.toHaveBeenCalled();
    variants.setState({}, true);
    expect(changed).toHaveBeenCalledOnce();
    variants.setState({}, true);
    expect(changed).toHaveBeenCalledOnce();
  } finally { stop(); lifetime.abort(); source.dispose(); }
});
