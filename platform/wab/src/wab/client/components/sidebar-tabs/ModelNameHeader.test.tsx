import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { COMMANDS } from "@/wab/client/commands/command";
import { ModelNameHeader } from "@/wab/client/components/sidebar-tabs/ModelNameHeader";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { mkArenaFrame, mkMixedArena } from "@/wab/shared/Arenas";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplTagX } from "@/wab/shared/core/tpls";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { err } from "neverthrow";
import React from "react";

beforeEach(() =>
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    },
  ),
);
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

async function setup() {
  vi.spyOn(ViewCtx.prototype, "isVisible").mockReturnValue(false);
  const baseVariant = mkBaseVariant();
  const tpl = mkTplTagX("div", { baseVariant, styles: {} });
  tpl.name = "Original";
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    variants: [baseVariant],
    tplTree: tpl,
  });
  const site = createSite();
  site.components.push(component);
  const arena = mkMixedArena("Model fields");
  const frame = mkArenaFrame({
    site,
    component,
    name: "Page",
    width: 100,
    height: 100,
    left: 0,
    top: 0,
  });
  arena.children.push(frame);
  site.arenas.push(arena);
  const { studioCtx: sc } = fakeStudioCtx({
    site,
    initialUrl: "/projects/test?arena_type=custom&arena=Model%20fields",
  });
  await vi.waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const vc = ensure(sc.tryGetViewCtxForFrame(frame), "View context");
  sc.observeComponents([component]);
  vi.spyOn(vc, "scheduleSync").mockImplementation(() => undefined);
  vi.spyOn(vc, "awaitSync").mockResolvedValue();
  sc.createViewStateUndoRecord();
  return { sc, vc, tpl, component };
}

it("edits through the real rename command and publishes undo/redo without unrelated Inspector commits", async () => {
  const { sc, vc, tpl, component } = await setup();
  try {
    const store = sc.modelSnapshots.field(tpl, "name");
    const commits = vi.fn();
    const unrelated = vi.fn();
    render(
      <React.StrictMode>
        <React.Profiler id="name" onRender={commits}>
          <ModelNameHeader
            nameStore={store}
            icon={null}
            placeholder="Element name"
            onChange={(name) => {
              void COMMANDS.element.rename.execute(
                sc,
                { name },
                { tpl, viewCtx: vc },
              );
            }}
          />
        </React.Profiler>
        <React.Profiler id="component" onRender={unrelated}>
          <ModelNameHeader
            nameStore={sc.modelSnapshots.field(component, "name")}
            icon={null}
            placeholder="Component name"
            onChange={() => undefined}
          />
        </React.Profiler>
      </React.StrictMode>,
    );
    const input = screen.getByPlaceholderText<HTMLInputElement>("Element name");
    expect(input.value).toBe("Original");
    commits.mockClear();
    unrelated.mockClear();
    await act(async () => {
      await sc.changeUnsafe(() => {
        tpl.vsettings[0].rs.values.color = "red";
      });
    });
    expect(commits).not.toHaveBeenCalled();
    expect(unrelated).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.change(input, { target: { value: "Edited" } });
      fireEvent.blur(input);
      await vi.waitFor(() => expect(tpl.name).toBe("Edited"));
    });
    expect(store.getState()).toBe("Edited");
    expect(unrelated).not.toHaveBeenCalled();
    await act(() => sc.undo());
    expect(input.value).toBe("Original");
    await act(() => sc.redo());
    expect(input.value).toBe("Edited");
    expect(sc.modelSnapshots.field(tpl, "name")).toBe(store);
    expect(unrelated).not.toHaveBeenCalled();
  } finally {
    cleanup();
    sc.dispose();
  }
});

it("publishes only final committed values and keeps failed transaction changes private", async () => {
  const { sc, tpl, component } = await setup();
  try {
    const name = sc.modelSnapshots.field(tpl, "name");
    const componentName = sc.modelSnapshots.field(component, "name");
    const publish = vi.fn(() => {
      expect(name.getState()).toBe("Final");
      expect(componentName.getState()).toBe("Final component");
    });
    const stop = name.subscribe(publish);
    const result = await sc.change(() => {
      tpl.name = "Rejected";
      component.name = "Rejected component";
      return err("Rejected");
    });
    expect(result.isErr()).toBe(true);
    expect(tpl.name).toBe("Original");
    expect(name.getState()).toBe("Original");
    expect(componentName.getState()).toBe("Page");
    expect(publish).not.toHaveBeenCalled();
    await sc.changeUnsafe(() => {
      tpl.name = "Intermediate";
      tpl.name = "Final";
      component.name = "Final component";
    });
    expect(publish).toHaveBeenCalledOnce();
    stop();
  } finally {
    sc.dispose();
  }
});
