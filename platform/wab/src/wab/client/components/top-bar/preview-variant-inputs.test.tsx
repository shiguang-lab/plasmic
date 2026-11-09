import { PreviewVariantInputs, usePreviewVariantModelInputs } from "@/wab/client/components/top-bar/preview-variant-inputs";
import VariantsComboSelect from "@/wab/client/components/top-bar/VariantsComboSelect";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { mkGlobalVariantSplit, SplitStatus, SplitType } from "@/wab/shared/core/splits";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { ProjectDependency, isKnownProjectDependency } from "@/wab/shared/model/classes";
import { act, cleanup, render, screen, renderHook } from "@testing-library/react";
import * as React from "react";
import { createStore } from "zustand/vanilla";

const current = vi.hoisted(() => ({ studio: undefined as any, preview: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => current.studio }));
vi.mock("@/wab/client/components/live/PreviewCtx", async () => {
  const { useStore } = await import("zustand");
  return { usePreviewCtx: () => current.preview, usePreviewSelector: (preview, selector) => useStore(preview.store, selector) };
});
vi.mock("@/wab/client/plasmic/plasmic_kit_top_bar/PlasmicVariantsComboSelect", () => ({
  PlasmicVariantsComboSelect: ({ children }) => <output>{children}</output>,
}));
vi.mock("antd", () => ({ Dropdown: ({ children }) => <>{children}</> }));

const disposals: (() => void)[] = [];
afterEach(() => { cleanup(); disposals.splice(0).forEach((dispose) => dispose()); });

function fixture() {
  const site = createSite(), manager = new TplMgr({ site });
  const component = manager.addComponent({ name: "Root", type: ComponentType.Plain });
  const otherComponent = manager.addComponent({ name: "Other", type: ComponentType.Plain });
  const group = manager.createGlobalVariantGroup("Theme");
  const dark = manager.createGlobalVariant(group, "Dark");
  const models = new ModelSnapshots(), lifetime = new AbortController();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil, isExternalRef: isKnownProjectDependency });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const source = new PreviewVariantInputs(studio, component);
  const changed = vi.fn(), stop = source.subscribe(changed);
  const edit = (fn: () => void) => {
    const changes = recorder.withRecording(fn);
    models.sync(changes.changes);
  };
  disposals.push(() => { stop(); lifetime.abort(); models.dispose(); recorder.dispose(); });
  return { site, manager, component, otherComponent, group, dark, studio, source, changed, edit, lifetime };
}

it("updates the mounted preview picker after variant and split group renames", () => {
  const f = fixture();
  current.studio = f.studio;
  current.preview = {
    component: f.component,
    store: createStore(() => ({ previewData: {} })),
    getVariants: () => [f.dark],
  };
  render(<VariantsComboSelect />);
  expect(screen.getByRole("status").textContent).toBe("Dark");
  act(() => f.edit(() => { f.dark.name = "Night"; }));
  expect(screen.getByRole("status").textContent).toBe("Night");
  act(() => f.edit(() => {
    f.site.splits.push(mkGlobalVariantSplit({ group: f.group, variant: f.dark, type: SplitType.Experiment, status: SplitStatus.Running }));
  }));
  expect(screen.getByRole("status").textContent).toBe("Theme");
  act(() => f.edit(() => { f.group.param.variable.name = "Appearance"; }));
  expect(screen.getByRole("status").textContent).toBe("Appearance");
});

it("rebinds added dependency groups and releases departed fields", () => {
  const f = fixture();
  const dependencySite = createSite(), manager = new TplMgr({ site: dependencySite });
  const group = manager.createGlobalVariantGroup("Imported theme"), variant = manager.createGlobalVariant(group, "Light");
  const dep = new ProjectDependency({ uuid: "dep", pkgId: "pkg", projectId: "project", version: "1.0.0", name: "Library", site: dependencySite });
  const externalRecorder = new ChangeRecorder({ inst: dependencySite, _instUtil: instUtil });
  disposals.push(() => externalRecorder.dispose());
  const editDependency = (fn: () => void) => f.studio.modelSnapshots.sync(externalRecorder.withRecording(fn).changes);
  f.edit(() => { f.site.projectDependencies.push(dep); });
  f.changed.mockClear();
  editDependency(() => { variant.name = "Bright"; });
  expect(f.changed).toHaveBeenCalledOnce();
  f.edit(() => { f.site.projectDependencies.splice(0); });
  f.changed.mockClear();
  editDependency(() => { variant.name = "Detached"; });
  expect(f.changed).not.toHaveBeenCalled();
});

it("keeps its snapshot stable for unrelated model edits and closes with its model lifetime", () => {
  const f = fixture(), before = f.source.getSnapshot();
  f.edit(() => { f.component.name = "Unrelated title"; });
  expect(f.source.getSnapshot()).toBe(before);
  expect(f.changed).not.toHaveBeenCalled();
  f.lifetime.abort();
  expect(f.source.getSnapshot().alive).toBe(false);
  f.changed.mockClear();
  f.edit(() => { f.dark.name = "After close"; });
  expect(f.changed).not.toHaveBeenCalled();
});


it("binds the newly selected component without retaining the previous field subscriptions", () => {
  const f = fixture();
  current.studio = f.studio;
  const store = createStore(() => ({ previewData: {} }));
  current.preview = { component: f.component, store, getVariants: () => [] };
  let commits = 0;
  const mounted = render(<React.Profiler id="picker" onRender={() => { commits++; }}><VariantsComboSelect /></React.Profiler>);
  act(() => {
    current.preview.component = f.otherComponent;
    store.setState({ previewData: {} });
  });
  const before = commits;
  act(() => f.edit(() => { f.component.variants[0].name = "Detached base"; }));
  expect(commits).toBe(before);
  mounted.unmount();
});

it("does not admit a retained component into another Studio when preview props change owners", () => {
  const first = fixture(), second = fixture();
  const mounted = renderHook(({ studio, component }) => usePreviewVariantModelInputs(studio, component), { initialProps: { studio: first.studio, component: first.component } });
  const admitted = vi.spyOn(second.studio.modelSnapshots, "declaredField");
  try {
    expect(mounted.result.current.alive).toBe(true);
    mounted.rerender({ studio: second.studio, component: first.component });
    expect(mounted.result.current.alive).toBe(false); expect(admitted).not.toHaveBeenCalled();
    mounted.rerender({ studio: second.studio, component: second.component });
    expect(mounted.result.current.alive).toBe(true); expect(admitted).toHaveBeenCalled();
  } finally { mounted.unmount(); admitted.mockRestore(); }
});
