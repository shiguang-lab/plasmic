import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createSite } from "@/wab/shared/core/sites";
import { createStore } from "zustand/vanilla";
import type { Preset } from "@/wab/client/code-components/code-presets";
import type { TplComponent } from "@/wab/shared/model/classes";
import {
  createPresetsStore,
  useComponentPresets,
  usePresetsModalComponent,
} from "@/wab/client/studio-ctx/presets-state";
import { ModelRevisions, modelKeys } from "@/wab/shared/model-revisions";
import { getComponentPresets } from "@/wab/client/code-components/code-presets";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { CodeComponent } from "@/wab/shared/core/components";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

/**
 * `getPresetsModalComponent` read `StudioCtx._presetsModalComponent`, an
 * `observable.box`. The modal now subscribes to a store.
 */

// The real implementation pulls the codegen graph; this test only covers the
// subscription behaviour of the hook.
vi.mock("@/wab/client/code-components/code-presets", () => ({
  getComponentPresets: vi.fn(),
}));

beforeEach(() => {
  revisions.dispose(); revisions = new ModelRevisions();
  vi.mocked(getComponentPresets).mockReset().mockReturnValue([]);
});

const owners = new Set<() => void>();
afterEach(() => { cleanup(); owners.forEach((close) => close()); owners.clear(); });

function codeComponent(name: string): CodeComponent {
  return { name } as unknown as CodeComponent;
}

function fakeStudio(): StudioCtx {
  const models = new ModelSnapshots(), lifetime = new AbortController();
  owners.add(() => { lifetime.abort(); models.dispose(); });
  return { site: createSite(), modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal }, modelRevisions: revisions, getCodeRegistrationRevision: () => "0:0", subscribeCodeRegistrations: () => () => undefined, presetsStore: createPresetsStore() } as unknown as StudioCtx;
}

it("renders nothing until a component is selected", () => {
  const studio = fakeStudio();

  function Modal() {
    const component = usePresetsModalComponent(studio);
    return <output data-testid="modal">{component?.name ?? "closed"}</output>;
  }

  render(<Modal />);

  expect(screen.getByTestId("modal").textContent).toBe("closed");
});

it("opens and closes as the selected component changes", async () => {
  const studio = fakeStudio();
  let renders = 0;

  function Modal() {
    const component = usePresetsModalComponent(studio);
    renders += 1;
    return <output data-testid="modal">{component?.name ?? "closed"}</output>;
  }

  render(<Modal />);
  const before = renders;

  await act(async () => {
    studio.presetsStore.setState({ modalComponent: codeComponent("Modal") });
  });
  expect(screen.getByTestId("modal").textContent).toBe("Modal");
  expect(renders - before).toBe(1);

  await act(async () => {
    studio.presetsStore.setState({ modalComponent: undefined });
  });
  expect(screen.getByTestId("modal").textContent).toBe("closed");
  expect(renders - before).toBe(2);
});

it("does not re-render when the same component is re-selected", async () => {
  const studio = fakeStudio();
  const modal = codeComponent("Modal");
  studio.presetsStore.setState({ modalComponent: modal });
  let renders = 0;

  function Picker() {
    usePresetsModalComponent(studio);
    renders += 1;
    return null;
  }

  render(<Picker />);
  const before = renders;

  await act(async () => {
    studio.presetsStore.setState({ modalComponent: modal });
  });

  expect(renders).toBe(before);
});


it("re-reads presets without rendering unchanged output when the site revision changes", async () => {
  const studio = fakeStudio();
  const component = codeComponent("Modal");
  let renders = 0;

  function Picker() {
    useComponentPresets(studio, component);
    renders += 1;
    return null;
  }

  render(<Picker />);
  const before = renders;
  const reads = vi.mocked(getComponentPresets).mock.calls.length;

  await act(async () => {
    revisions.markModelKeysDirty([modelKeys.site]);
    revisions.flushModelRevisions();
  });

  expect(renders - before).toBe(0);
  expect(vi.mocked(getComponentPresets).mock.calls.length).toBeGreaterThan(reads);
});

it("returns a stable empty list without a component", () => {
  const studio = fakeStudio();
  const results: unknown[] = [];
  const subscribe = vi.spyOn(studio.modelRevisions, "subscribeModelKeys");
  const register = vi.spyOn(studio, "subscribeCodeRegistrations");

  function Picker() {
    results.push(useComponentPresets(studio, undefined));
    return null;
  }

  const { rerender } = render(<Picker />);
  rerender(<Picker />);

  expect(results[0]).toBe(results[results.length - 1]);
  expect(subscribe).not.toHaveBeenCalled();
  expect(register).not.toHaveBeenCalled();
  expect(getComponentPresets).not.toHaveBeenCalled();
});

let revisions = new ModelRevisions();

it("updates registered templates and retires the old owner's subscriptions", () => {
  const studio = fakeStudio(), component = codeComponent("Button"), registry = createStore(() => 0);
  const disconnected = vi.fn();
  Object.assign(studio, { subscribeCodeRegistrations: (listener: () => void) => { const stop = registry.subscribe(listener); return () => { disconnected(); stop(); }; } });
  let templates: Preset[] = [];
  vi.mocked(getComponentPresets).mockImplementation(() => templates);
  function Picker() { return <output>{useComponentPresets(studio, component).map((preset) => preset.name).join(",")}</output>; }
  render(<Picker />);
  act(() => { templates = [{ name: "Updated", tpl: {} as TplComponent }]; registry.setState(1, true); });
  expect(screen.getByRole("status").textContent).toBe("Updated");
  act(() => { owners.forEach((close) => close()); });
  expect(screen.getByRole("status").textContent).toBe("");
  expect(disconnected).toHaveBeenCalled();
  vi.mocked(getComponentPresets).mockClear();
  act(() => { registry.setState(2, true); revisions.markModelKeysDirty([modelKeys.site]); revisions.flushModelRevisions(); });
  expect(getComponentPresets).not.toHaveBeenCalled();
});
