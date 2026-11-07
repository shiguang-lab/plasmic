import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import ActionChip, {
  ActionChipProps,
} from "@/wab/client/components/sidebar-tabs/StateManagement/ActionChip";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelFieldStore } from "@/wab/client/studio-ctx/model-snapshots";
import { mkBaseVariant } from "@/wab/shared/Variants";
import { ensure } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { mkInteraction } from "@/wab/shared/core/states";
import {
  mkTplTagX,
  setEventHandlerByEventKey,
} from "@/wab/shared/core/tpls";
import { EventHandler } from "@/wab/shared/model/classes";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import React from "react";

afterEach(cleanup);

async function setup() {
  const baseVariant = mkBaseVariant();
  const tpl = mkTplTagX("div", { baseVariant, styles: {} });
  const component = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    variants: [baseVariant],
    tplTree: tpl,
  });
  const site = createSite();
  site.components.push(component);
  const { studioCtx: sc } = fakeStudioCtx({ site });
  await vi.waitFor(() => expect(sc.initialRouteReady).toBe(true));
  sc.observeComponents([component]);
  sc.createViewStateUndoRecord();
  const eventHandler = new EventHandler({ interactions: [] });
  await sc.changeUnsafe(() =>
    setEventHandlerByEventKey(tpl, { attr: "onClick" }, eventHandler),
  );
  return { sc, tpl, component, eventHandler };
}

function chipTree(
  sc: StudioCtx,
  props: ActionChipProps & { ref?: React.Ref<HTMLDivElement> },
) {
  return (
    <StudioCtxContext.Provider value={sc}>
      <ActionChip {...props} />
    </StudioCtxContext.Provider>
  );
}

function renderChip(
  sc: StudioCtx | undefined,
  props: ActionChipProps & { ref?: React.Ref<HTMLDivElement> },
) {
  return render(sc ? chipTree(sc, props) : <ActionChip {...props} />);
}

function getRoot(container: HTMLElement): HTMLDivElement {
  return ensure(
    container.querySelector<HTMLDivElement>("div"),
    "ActionChip root is not rendered",
  );
}

function trackStore<T>(store: ModelFieldStore<T>) {
  const stops: (() => void)[] = [];
  const subscribe = store.subscribe;
  const spy = vi.spyOn(store, "subscribe").mockImplementation((listener) => {
    const stop = subscribe(listener);
    const tracked = vi.fn(stop);
    stops.push(tracked);
    return tracked;
  });
  return { spy, stops };
}

it.each([null, undefined] as const)(
  "renders zero actions for %s handler and keeps click and ref behavior",
  (eventHandler) => {
    const onClick = vi.fn();
    const ref = React.createRef<HTMLDivElement>();
    const { container } = renderChip(undefined, {
      eventHandler,
      onClick,
      ref,
      "data-plasmic-prop": "missing-handler",
    });
    const root = getRoot(container);
    expect(screen.getByText("0 actions")).toBeTruthy();
    expect(ref.current).toBe(root);
    expect(root.getAttribute("data-plasmic-prop")).toBe("missing-handler");
    fireEvent.click(root);
    expect(onClick).toHaveBeenCalledOnce();
  },
);

it("shows an empty handler as zero actions", async () => {
  const { sc, eventHandler } = await setup();
  try {
    renderChip(sc, { eventHandler, onClick: () => undefined });
    expect(screen.getByText("0 actions")).toBeTruthy();
  } finally {
    sc.dispose();
  }
});

it("tracks one interaction through rename and same-length replacement", async () => {
  const { sc, eventHandler } = await setup();
  try {
    const interaction = mkInteraction(
      eventHandler,
      "updateVariable",
      "Open modal",
      {},
    );
    await sc.changeUnsafe(() => eventHandler.interactions.push(interaction));
    const { container } = renderChip(sc, {
      eventHandler,
      onClick: () => undefined,
    });
    const root = getRoot(container);
    expect(screen.getByText("Open modal")).toBeTruthy();

    await act(async () => {
      await sc.changeUnsafe(() => {
        interaction.interactionName = "Renamed modal";
      });
    });
    expect(screen.getByText("Renamed modal")).toBeTruthy();
    expect(screen.queryByText("Open modal")).toBeNull();
    expect(getRoot(container)).toBe(root);

    const replacement = mkInteraction(
      eventHandler,
      "updateVariable",
      "Replacement modal",
      {},
    );
    await act(async () => {
      await sc.changeUnsafe(() => {
        eventHandler.interactions.splice(0, 1, replacement);
      });
    });
    expect(screen.getByText("Replacement modal")).toBeTruthy();
    expect(screen.queryByText("Renamed modal")).toBeNull();
    expect(getRoot(container)).toBe(root);

    await act(async () => {
      await sc.changeUnsafe(() => {
        replacement.interactionName = "Renamed replacement";
      });
    });
    expect(screen.getByText("Renamed replacement")).toBeTruthy();
  } finally {
    sc.dispose();
  }
});

it("updates the count for multiple interactions and zero interactions", async () => {
  const { sc, eventHandler } = await setup();
  try {
    const first = mkInteraction(eventHandler, "updateVariable", "First", {});
    const second = mkInteraction(eventHandler, "updateVariable", "Second", {});
    await sc.changeUnsafe(() =>
      eventHandler.interactions.push(first, second),
    );
    renderChip(sc, { eventHandler, onClick: () => undefined });
    expect(screen.getByText("2 actions")).toBeTruthy();

    const third = mkInteraction(eventHandler, "updateVariable", "Third", {});
    await act(async () => {
      await sc.changeUnsafe(() => eventHandler.interactions.push(third));
    });
    expect(screen.getByText("3 actions")).toBeTruthy();

    await act(async () => {
      await sc.changeUnsafe(() => {
        eventHandler.interactions.pop();
      });
    });
    expect(screen.getByText("2 actions")).toBeTruthy();

    await act(async () => {
      await sc.changeUnsafe(() => {
        eventHandler.interactions.splice(0, eventHandler.interactions.length);
      });
    });
    expect(screen.getByText("0 actions")).toBeTruthy();
  } finally {
    sc.dispose();
  }
});

it("keeps the real root and ref through null, empty, one, two, one and null", async () => {
  const { sc, eventHandler } = await setup();
  try {
    const first = mkInteraction(
      eventHandler,
      "updateVariable",
      "First action",
      {},
    );
    const second = mkInteraction(
      eventHandler,
      "updateVariable",
      "Second action",
      {},
    );
    const interactionsTracking = trackStore(
      sc.modelSnapshots.field(eventHandler, "interactions"),
    );
    const firstNameTracking = trackStore(
      sc.modelSnapshots.field(first, "interactionName"),
    );
    const onClick = vi.fn();
    const ref = React.createRef<HTMLDivElement>();
    const props = (next: EventHandler | null) => ({
      eventHandler: next,
      onClick,
      ref,
      "data-plasmic-prop": "transition",
    });

    const { container, rerender } = renderChip(sc, props(null));
    const root = getRoot(container);
    expect(screen.getByText("0 actions")).toBeTruthy();
    expect(ref.current).toBe(root);

    // null -> empty handler, without remounting the real root.
    rerender(chipTree(sc, props(eventHandler)));
    expect(screen.getByText("0 actions")).toBeTruthy();
    expect(getRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
    expect(interactionsTracking.spy).toHaveBeenCalled();

    // empty handler -> one interaction.
    await act(async () => {
      await sc.changeUnsafe(() => eventHandler.interactions.push(first));
    });
    expect(screen.getByText("First action")).toBeTruthy();
    expect(getRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
    expect(firstNameTracking.spy).toHaveBeenCalled();
    const firstPhaseStops = firstNameTracking.stops.length;
    expect(firstPhaseStops).toBeGreaterThan(0);

    // one -> two interactions; detach the former sole interaction name store.
    await act(async () => {
      await sc.changeUnsafe(() => eventHandler.interactions.push(second));
    });
    expect(screen.getByText("2 actions")).toBeTruthy();
    expect(screen.queryByText("First action")).toBeNull();
    expect(getRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
    firstNameTracking.stops.forEach((stop) =>
      expect(stop).toHaveBeenCalledOnce(),
    );
    interactionsTracking.stops.forEach((stop) =>
      expect(stop).not.toHaveBeenCalled(),
    );

    // two -> one interaction, reusing the same handler and root.
    await act(async () => {
      await sc.changeUnsafe(() => {
        eventHandler.interactions.splice(1, 1);
      });
    });
    expect(screen.getByText("First action")).toBeTruthy();
    expect(screen.queryByText("2 actions")).toBeNull();
    expect(getRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
    expect(firstNameTracking.stops.length).toBeGreaterThan(firstPhaseStops);

    // one -> null, detaching both the name and interaction subscriptions.
    rerender(chipTree(sc, props(null)));
    expect(screen.getByText("0 actions")).toBeTruthy();
    expect(screen.queryByText("First action")).toBeNull();
    expect(getRoot(container)).toBe(root);
    expect(ref.current).toBe(root);
    firstNameTracking.stops.forEach((stop) =>
      expect(stop).toHaveBeenCalledOnce(),
    );
    interactionsTracking.stops.forEach((stop) =>
      expect(stop).toHaveBeenCalledOnce(),
    );
    expect(getRoot(container).getAttribute("data-plasmic-prop")).toBe(
      "transition",
    );
    fireEvent.click(getRoot(container));
    expect(onClick).toHaveBeenCalledOnce();
  } finally {
    sc.dispose();
  }
});

it("replaces the handler prop and follows its own interaction field", async () => {
  const { sc, tpl, eventHandler: firstHandler } = await setup();
  try {
    const first = mkInteraction(firstHandler, "updateVariable", "First", {});
    await sc.changeUnsafe(() =>
      firstHandler.interactions.push(first),
    );
    const secondHandler = new EventHandler({ interactions: [] });
    const second = mkInteraction(secondHandler, "updateVariable", "Second", {});
    await sc.changeUnsafe(() =>
      secondHandler.interactions.push(second),
    );

    const { container, rerender } = renderChip(sc, {
      eventHandler: firstHandler,
      onClick: () => undefined,
    });
    const root = getRoot(container);
    expect(screen.getByText("First")).toBeTruthy();

    await act(async () => {
      await sc.changeUnsafe(() =>
        setEventHandlerByEventKey(tpl, { attr: "onClick" }, secondHandler),
      );
    });
    rerender(
      <StudioCtxContext.Provider value={sc}>
        <ActionChip eventHandler={secondHandler} onClick={() => undefined} />
      </StudioCtxContext.Provider>,
    );
    expect(screen.getByText("Second")).toBeTruthy();
    expect(getRoot(container)).toBe(root);

    await act(async () => {
      await sc.changeUnsafe(() => {
        second.interactionName = "Second renamed";
      });
    });
    expect(screen.getByText("Second renamed")).toBeTruthy();

    await act(async () => {
      await sc.changeUnsafe(() => {
        first.interactionName = "Detached rename";
      });
    });
    expect(screen.queryByText("Detached rename")).toBeNull();
  } finally {
    sc.dispose();
  }
});

it("ignores unrelated committed model changes", async () => {
  const { sc, tpl, eventHandler } = await setup();
  try {
    const interaction = mkInteraction(
      eventHandler,
      "updateVariable",
      "Open modal",
      {},
    );
    await sc.changeUnsafe(() => eventHandler.interactions.push(interaction));
    const commits = vi.fn();
    render(
      <StudioCtxContext.Provider value={sc}>
        <React.Profiler id="action-chip" onRender={commits}>
          <ActionChip eventHandler={eventHandler} onClick={() => undefined} />
        </React.Profiler>
      </StudioCtxContext.Provider>,
    );
    expect(screen.getByText("Open modal")).toBeTruthy();
    commits.mockClear();

    await act(async () => {
      await sc.changeUnsafe(() => {
        tpl.name = "Unrelated name";
        tpl.vsettings[0].rs.values.color = "red";
      });
    });
    expect(commits).not.toHaveBeenCalled();

    await act(async () => {
      await sc.changeUnsafe(() => {
        interaction.interactionName = "Relevant rename";
      });
    });
    expect(commits).toHaveBeenCalled();
    expect(screen.getByText("Relevant rename")).toBeTruthy();
  } finally {
    sc.dispose();
  }
});

it("detaches interaction and interaction-name subscriptions on unmount", async () => {
  const { sc, eventHandler } = await setup();
  try {
    const interaction = mkInteraction(
      eventHandler,
      "updateVariable",
      "Open modal",
      {},
    );
    await sc.changeUnsafe(() => eventHandler.interactions.push(interaction));
    const interactionsStore = sc.modelSnapshots.field(
      eventHandler,
      "interactions",
    );
    const interactionNameStore = sc.modelSnapshots.field(
      interaction,
      "interactionName",
    );
    const stops: (() => void)[] = [];
    const track = (store: {
      subscribe: (listener: () => void) => () => void;
    }) => {
      const subscribe = store.subscribe;
      return vi
        .spyOn(store, "subscribe")
        .mockImplementation((listener: () => void) => {
          const stop = subscribe(listener);
          const tracked = vi.fn(stop);
          stops.push(tracked);
          return tracked;
        });
    };
    const interactionsSubscribe = track(interactionsStore);
    const interactionNameSubscribe = track(interactionNameStore);

    const view = renderChip(sc, {
      eventHandler,
      onClick: () => undefined,
    });
    expect(interactionsSubscribe).toHaveBeenCalled();
    expect(interactionNameSubscribe).toHaveBeenCalled();
    expect(stops.length).toBeGreaterThanOrEqual(2);

    view.unmount();
    stops.forEach((stop) => expect(stop).toHaveBeenCalledOnce());
  } finally {
    sc.dispose();
  }
});
