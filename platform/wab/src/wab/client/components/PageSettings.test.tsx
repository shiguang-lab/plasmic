import { CodeComponentsRegistry } from "@/wab/shared/code-components/code-components";
import { DEVFLAGS } from "@/wab/shared/devflags";
import { createHostlessPkgsStore } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { asCode, codeLit } from "@/wab/shared/core/exprs";
import { TemplatedString, ObjectPath } from "@/wab/shared/model/classes";
import PageSettings from "@/wab/client/components/PageSettings";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType, PageComponent } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";

const fixture = vi.hoisted(() => ({ studio: undefined as any, path: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => fixture.studio }));
beforeEach(() => {
  const site = createSite(), modelSnapshots = new ModelSnapshots(), lifetime = new AbortController();
  const schema = Object.freeze({});
  const codeComponentsRegistry = new CodeComponentsRegistry(globalThis, {});
  const hostLessRegistry = new CodeComponentsRegistry(globalThis, {});
  fixture.studio = { site, modelSnapshots, hostlessPkgsStore: createHostlessPkgsStore(), arenaState: { lifetime: () => lifetime.signal },
    projectFlags: () => DEVFLAGS, customFunctionsSchema: () => schema,
    subscribeCodeRegistrations: (listener: () => void) => {
      const stopHost = codeComponentsRegistry.revisionStore.subscribe(listener);
      const stopHostless = hostLessRegistry.revisionStore.subscribe(listener);
      return () => { stopHost(); stopHostless(); };
    },
    close: () => { lifetime.abort(); modelSnapshots.dispose(); } };
});
vi.mock(
  "@/wab/client/components/sidebar-tabs/legacy-component-params-section",
  () => ({ LegacyComponentParamsSection: () => null }),
);
vi.mock("@/wab/client/components/style-controls/ImageSelector", () => ({
  ImageAssetPreviewAndPicker: () => (
    <div data-testid="image-chooser">Image chooser</div>
  ),
}));
vi.mock("@/wab/client/components/sidebar-tabs/PropEditorRow", async () => {
  const ReactModule = await import("react");
  return {
    PropValueEditorContext: ReactModule.createContext({}),
    InnerPropEditorRow: ({ label, expr }) => <input aria-label={label} value={expr ? asCode(expr, { projectFlags: DEVFLAGS, component: null, inStudio: true }).code : ""} readOnly />,
    PropEditorRow: () => null,
  };
});
afterEach(() => { cleanup(); fixture.studio.close(); });

it("opens the image chooser without a rendered canvas and keeps it open across form renders", async () => {
  const mgr = new TplMgr({ site: fixture.studio.site });
  const page = mgr.addComponent({
    name: "Page2",
    type: ComponentType.Page,
  }) as PageComponent;
  const { rerender } = render(<PageSettings page={page} />);
  const trigger = screen.getByRole("button", { name: "Choose an image" });
  expect(trigger.getAttribute("aria-expanded")).toBe("false");
  fireEvent.click(trigger);
  expect(await screen.findByTestId("image-chooser")).toBeTruthy();
  expect(trigger.getAttribute("aria-expanded")).toBe("true");
  rerender(<PageSettings page={page} className="updated-form" />);
  expect(
    screen
      .getByRole("button", { name: "Choose an image" })
      .getAttribute("aria-expanded"),
  ).toBe("true");
});


it("refreshes committed title expressions while keeping an open image chooser mounted", async () => {
  const manager = new TplMgr({ site: fixture.studio.site });
  const page = manager.addComponent({ name: "Page", type: ComponentType.Page }) as PageComponent;
  const path = new ObjectPath({ path: ["title"], fallback: codeLit("Default") });
  const title = new TemplatedString({ text: ["Before ", path] });
  page.pageMeta.title = title;
  const recorder = new ChangeRecorder({ inst: fixture.studio.site, _instUtil: instUtil });
  render(<PageSettings page={page} />);
  const input = screen.getByLabelText("Title") as HTMLInputElement;
  expect(input.value).toContain("Before");
  fireEvent.click(screen.getByRole("button", { name: "Choose an image" }));
  const chooser = await screen.findByTestId("image-chooser");
  try {
    act(() => {
      const changes = recorder.withRecording(() => { title.text[0] = "After "; path.path = ["changedTitle"]; });
      fixture.studio.modelSnapshots.sync(changes.changes);
    });
    expect(input.value).toContain("After");
    expect(input.value).toContain("changedTitle");
    expect(screen.getByTestId("image-chooser")).toBe(chooser);
  } finally { recorder.dispose(); }
});


it("does not register a retained old page in a replacement model world", () => {
  const manager = new TplMgr({ site: fixture.studio.site });
  const page = manager.addComponent({ name: "Retained page", type: ComponentType.Page }) as PageComponent;
  const { rerender } = render(<PageSettings page={page} />);
  act(() => { fixture.studio.close(); });
  const nextModels = new ModelSnapshots();
  const fields = vi.spyOn(nextModels, "declaredField");
  fixture.studio.modelSnapshots = nextModels;
  fixture.studio.site = createSite();
  try {
    expect(() => rerender(<PageSettings page={page} className="retained" />)).not.toThrow();
    expect(fields).not.toHaveBeenCalled();
  } finally { nextModels.dispose(); }
});
