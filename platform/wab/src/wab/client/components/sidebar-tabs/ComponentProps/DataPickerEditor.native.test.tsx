import "@/wab/client/components/sidebar/MixinControls";
import { InternalDataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { ProjectDependency } from "@/wab/shared/model/classes";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, render, screen } from "@testing-library/react";
import * as React from "react";

type Value = (string | number)[] | string | null | undefined;
const callbacks = vi.hoisted(() => ({ change: undefined as ((value: Value) => void) | undefined }));
vi.mock("@/wab/client/components/sidebar-tabs/DataBinding/DataPicker", () => ({ default: ({ onChange }: { onChange: (value: Value) => void }) => { callbacks.change = onChange; return null; } }));
vi.mock("@/wab/client/studio-ctx/inspector-state", async (original) => ({ ...(await original<typeof import("@/wab/client/studio-ctx/inspector-state")>()), useInspectorSelection: () => undefined }));
vi.mock("antd", async (original) => ({ ...(await original<typeof import("antd")>()), Popover: ({ children, content }: { children: React.ReactNode; content: React.ReactNode }) => <div>{children}{content}</div> }));
afterEach(() => { cleanup(); vi.restoreAllMocks(); });
it("updates imported token display names and retires a retained editing callback", () => {
  const site = createSite();
  const dependency = new ProjectDependency({ uuid: "token-dependency", projectId: "dep12-project", pkgId: "token-package", name: "Original library", version: "1", site: createSite() });
  site.projectDependencies.push(dependency);
  const models = new ModelSnapshots(), lifetime = new AbortController(), viewLife = new AbortController();
  const recorder = new ChangeRecorder({ inst: dependency, _instUtil: instUtil });
  const studio = { site, modelSnapshots: models, arenaState: { lifetime: () => lifetime.signal } } as unknown as StudioCtx;
  const view = { studioCtx: studio, site, siteInfo: { id: "local-project" }, modelLifetime: lifetime.signal, disposeSignal: viewLife.signal, isDisposed: false } as unknown as ViewCtx;
  const change = vi.fn(), setVisible = vi.fn();
  const mounted = render(<InternalDataPickerEditor value={["$dataTokens_dep12_token", "field"]} viewCtx={view} onChange={change} visible setVisible={setVisible} />);
  try {
    expect(screen.getByText("$dataTokens.originalLibrary.token.field")).toBeTruthy();
    act(() => models.sync(recorder.withRecording(() => { dependency.name = "Updated library"; }).changes));
    expect(screen.getByText("$dataTokens.updatedLibrary.token.field")).toBeTruthy();
    const retained = callbacks.change;
    if (!retained) { throw new Error("Expected the rendered data picker callback"); }
    act(() => retained(["original-value"]));
    expect(change).toHaveBeenLastCalledWith(["original-value"]);
    act(() => viewLife.abort()); change.mockClear();
    act(() => retained(["retired-value"]));
    expect(change).not.toHaveBeenCalled();
    expect(mounted.container.textContent).toBe("");
  } finally { mounted.unmount(); recorder.dispose(); models.dispose(); }
});
