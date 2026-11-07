import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { DocsPreviewCanvas } from "@/wab/client/components/docs/DocsPreviewCanvas";
import { createDocsModelFixture } from "@/wab/client/components/docs/__testonly__/model-fixture";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import React from "react";
import { trapInteractionError } from "@/wab/client/components/canvas/studio-canvas-util";
import { PreviewCtx, PreviewState } from "@/wab/client/components/live/PreviewCtx";
import { PreviewFrame, useLivePreview } from "@/wab/client/components/live/PreviewFrame";
import { act, cleanup, render, renderHook } from "@testing-library/react";
import { createStore } from "zustand/vanilla";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  modelListeners: new Set<(event: any) => void>(),
  api: { setStudioReady: vi.fn().mockResolvedValue(undefined) },
  packages: [] as object[],
  dispose: vi.fn(),
  load: vi.fn(),
  committed: undefined as (() => void) | undefined,
  sortedPackages: vi.fn(),
  exec: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/wab/client/frame-ctx/host-frame-ctx", () => ({
  useHostFrameCtx: () => ({ revealStudio: mocks.api.setStudioReady }),
}));
vi.mock("@/wab/client/components/live/live-syncer", () => ({
  onLoadInjectLiveRuntime: mocks.load,
  pushPreviewModules: (
    _win: Window,
    _ctx: unknown,
    options: { onRendered: () => void },
  ) => {
    mocks.push(_win);
    mocks.committed = options.onRendered;
    return mocks.dispose;
  },
}));
vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  trapInteractionError: vi.fn(),
}));
vi.mock("@/wab/shared/cached-selectors", async (original) => ({
  ...(await original<typeof import("@/wab/shared/cached-selectors")>()),
  usedHostLessPkgs: () => mocks.packages,
}));
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({
  getHostLessPkgIdentity: (pkg: { id: string }) => pkg.id,
  getSortedHostLessPkgs: mocks.sortedPackages,
  getVersionForCanvasPackages: () => "test",
}));
vi.mock("@/wab/client/script-exec", () => ({ scriptExec: mocks.exec }));

function mockPreview(options: Partial<PreviewCtx>): PreviewCtx {
  const store = createStore<PreviewState>(() => ({
    previewData: mock<NonNullable<PreviewState["previewData"]>>({ full: options.full, pageHash: options.pageHash ?? "", width: 1440, height: 900, viewport: "desktop" }),
    isLive: options.isLive ?? false,
    refreshKey: 0,
    navigationEntries: [],
    navigationIndex: -1,
    navigating: false,
    targets: [],
    hasVariants: false,
  }));
  const preview = mock<PreviewCtx>();
  Object.assign(preview, options, { store, studioCtx: { ...options.studioCtx, subscribeModelChanges: (listener: (event: any) => void) => { mocks.modelListeners.add(listener); return () => { mocks.modelListeners.delete(listener); }; } } });
  return preview;
}

beforeEach(() => {
  (window as any).__plasmicLive = { setErrorTitle: vi.fn(), reportError: vi.fn(), beginRender: vi.fn(), showError: vi.fn().mockResolvedValue(undefined), getDiagnostics: () => ({ generation: 1 }) };
  vi.clearAllMocks();
  mocks.committed = undefined;
  mocks.packages = [];
  mocks.modelListeners.clear();
  mocks.load.mockResolvedValue(undefined);
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it("reports runtime bootstrap failure and releases the startup overlay", async () => {
  const error = new Error("Runtime download failed");
  mocks.load.mockRejectedValueOnce(error);
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any, full: true, isLive: false, pageHash: "" });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  expect((window as any).__plasmicLive.showError).toHaveBeenCalledExactlyOnceWith(error);
  expect(mocks.api.setStudioReady).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
});

it("reports package loading failure once and can load again after reset", async () => {
  mocks.packages = [{ id: "components" }];
  const error = new Error("Component package download failed");
  mocks.sortedPackages.mockRejectedValueOnce(error).mockResolvedValueOnce([["components", "package"]]);
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any, full: true, isLive: false, pageHash: "" });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  expect((window as any).__plasmicLive.showError).toHaveBeenCalledExactlyOnceWith(error);
  expect(mocks.api.setStudioReady).toHaveBeenCalledOnce();
  hook.rerender();
  expect(mocks.sortedPackages).toHaveBeenCalledOnce();
  expect(mocks.push).not.toHaveBeenCalled();
  act(() => hook.result.current.reset());
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  expect(mocks.push).toHaveBeenCalledExactlyOnceWith(window);
});

it("ignores package failures from a disposed preview", async () => {
  mocks.packages = [{ id: "components" }];
  const pending = Promise.withResolvers<[string, string][]>();
  mocks.sortedPackages.mockReturnValueOnce(pending.promise);
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any, full: true, isLive: false, pageHash: "" });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  act(() => hook.result.current.reset());
  await act(async () => pending.reject(new Error("Old load failed")));
  expect((window as any).__plasmicLive.showError).not.toHaveBeenCalled();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("clears SPA navigation feedback and removes the cursor layer on reset and close", async () => {
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
    full: false,
    isLive: false,
    pageHash: "",
  });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  expect(document.querySelectorAll("[data-plasmic-agent-cursor]")).toHaveLength(
    2,
  );
  const events: string[] = [];
  const listen = (event: Event) =>
    events.push((event as CustomEvent).detail.action);
  window.addEventListener("plasmic-agent-cursor", listen);
  try {
    act(() => previewCtx.store.setState({ previewData: mock<NonNullable<PreviewState["previewData"]>>({ previewPath: "/next" }) }));
    expect(events).toEqual(["clear"]);
    act(() => hook.result.current.reset());
    expect(document.querySelector("[data-plasmic-agent-cursor]")).toBeNull();
    hook.result.current.frameRef.current = window;
    await act(async () => hook.result.current.onLoad());
    expect(
      document.querySelectorAll("[data-plasmic-agent-cursor]"),
    ).toHaveLength(2);
    hook.unmount();
    expect(document.querySelector("[data-plasmic-agent-cursor]")).toBeNull();
  } finally {
    window.removeEventListener("plasmic-agent-cursor", listen);
  }
});

async function setup(full: boolean) {
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
    full,
    isLive: false,
    pageHash: "",
  });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  const notify = (type: string, source: MessageEventSource = window) => {
    act(() => {
      window.dispatchEvent(
        new MessageEvent("message", {
          source,
          data: { source: "plasmic-live", type },
        }),
      );
    });
  };
  const committed = mocks.committed;
  expect(committed).toBeTypeOf("function");
  const commit = () => act(() => committed?.());
  return { ...hook, notify, commit };
}

it.each(["rendered", "error"])(
  "releases the full preview startup overlay after the live frame reports %s",
  async (type) => {
    const { notify, commit } = await setup(true);
    expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
    notify("rendered", {} as MessageEventSource);
    notify("unrelated");
    expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
    notify(type);
    expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
    commit();
    commit();
    expect(mocks.api.setStudioReady).toHaveBeenCalledTimes(1);
  },
);

it("leaves the editor's readiness owner in charge of regular preview", async () => {
  const { notify, commit } = await setup(false);
  notify("rendered");
  commit();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("disables the commit callback when the preview unmounts", async () => {
  const { notify, commit, unmount } = await setup(true);
  unmount();
  expect(mocks.dispose).toHaveBeenCalledOnce();
  notify("rendered");
  commit();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("ignores a commit belonging to a replaced frame", async () => {
  const { result, commit } = await setup(true);
  result.current.frameRef.current = null;
  commit();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("ignores a commit from the previous generation before effect cleanup", async () => {
  const { result } = await setup(true);
  const committed = mocks.committed;
  act(() => {
    result.current.reset();
    result.current.frameRef.current = window;
    committed?.();
  });
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("does not activate a delayed host after reset", async () => {
  let finish = () => {};
  mocks.load.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
    full: true,
    isLive: false,
    pageHash: "",
  });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  let loading: Promise<void> | undefined;
  act(() => {
    loading = hook.result.current.onLoad();
  });
  expect(mocks.load).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.reset());
  await act(async () => {
    finish();
    await loading;
  });
  expect(mocks.committed).toBeUndefined();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("does not activate an earlier load after reset even when the WindowProxy is reused", async () => {
  let finish = () => {};
  mocks.load.mockImplementationOnce(
    () =>
      new Promise<void>((resolve) => {
        finish = resolve;
      }),
  );
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
    full: true,
    isLive: false,
    pageHash: "",
  });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  let loading: Promise<void> | undefined;
  act(() => {
    loading = hook.result.current.onLoad();
  });
  act(() => hook.result.current.reset());
  hook.result.current.frameRef.current = window;
  await act(async () => {
    finish();
    await loading;
  });
  expect(mocks.push).not.toHaveBeenCalled();
});

it.each([true, false])(
  "isolates package installation across reset (old resolves first: %s)",
  async (oldFirst) => {
    mocks.packages = [{ id: "components" }];
    let finishOld = (_value: [string, string][]) => {};
    let finishNew = (_value: [string, string][]) => {};
    mocks.sortedPackages
      .mockImplementationOnce(
        () =>
          new Promise<[string, string][]>((resolve) => {
            finishOld = resolve;
          }),
      )
      .mockImplementationOnce(
        () =>
          new Promise<[string, string][]>((resolve) => {
            finishNew = resolve;
          }),
      );
    const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
      full: true,
      isLive: false,
      pageHash: "",
    });
    const hook = renderHook(() => useLivePreview(previewCtx));
    hook.result.current.frameRef.current = window;
    await act(async () => hook.result.current.onLoad());
    expect(mocks.sortedPackages).toHaveBeenCalledTimes(1);
    expect(mocks.push).not.toHaveBeenCalled();
    act(() => hook.result.current.reset());
    // Navigating an iframe can retain its WindowProxy identity.
    hook.result.current.frameRef.current = window;
    await act(async () => hook.result.current.onLoad());
    expect(mocks.sortedPackages).toHaveBeenCalledTimes(2);
    if (oldFirst) {
      await act(async () => finishOld([["components", "old package"]]));
      expect(mocks.exec).not.toHaveBeenCalled();
      expect(mocks.push).not.toHaveBeenCalled();
    }
    await act(async () => finishNew([["components", "new package"]]));
    expect(mocks.exec).toHaveBeenCalledExactlyOnceWith(window, "new package");
    expect(mocks.push).toHaveBeenCalledExactlyOnceWith(window);
    if (!oldFirst) {
      await act(async () => finishOld([["components", "old package"]]));
      expect(mocks.exec).toHaveBeenCalledExactlyOnceWith(window, "new package");
      expect(mocks.push).toHaveBeenCalledExactlyOnceWith(window);
    }
  },
);

it.each([null, undefined, "", "   "])(
  "reports an empty navigation destination (%s) without a null property error",
  async (destination) => {
    await setup(false);
    const loc = {
      type: "InteractionLoc",
      actionName: "navigation",
      interactionUuid: "openTarget",
    };
    const run = () =>
      (window as any).__PlasmicWrapUserFunction(loc, vi.fn(), { destination });
    expect(run).toThrow("Navigation destination must be a non-empty string");
    expect((window as any).__plasmicLive.reportError).toHaveBeenCalledWith(expect.any(Error), {
      kind: "interaction", fatal: false, interactionUuid: "openTarget",
    });
    expect(trapInteractionError).toHaveBeenCalledWith(
      expect.anything(),
      loc,
      expect.objectContaining({
        message: "Navigation destination must be a non-empty string",
      }),
    );
  },
);

it("routes anchor actions through business history like page actions", async () => {
  const previewCtx = mockPreview({ studioCtx: { appCtx: { api: {} } } as any,
    full: false,
    isLive: false,
    pageHash: "",
  });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  (window as any).__PlasmicWrapUserFunction(
    {
      type: "InteractionLoc",
      actionName: "navigation",
      interactionUuid: "anchor",
    },
    vi.fn(),
    { destination: "#%E8%A7%84%E5%88%99" },
  );
  expect(previewCtx.handleNavigation).toHaveBeenCalledWith(
    "#%E8%A7%84%E5%88%99",
  );
});

it("reloads the original library version in Preview after an update is undone", async () => {
  mocks.packages = [{ id: "icons@1.0.0" }];
  mocks.sortedPackages.mockImplementation(async () =>
    mocks.packages.map((pkg) => {
      const { id } = pkg as { id: string };
      return [id, id];
    }),
  );
  await setup(false);
  mocks.packages = [{ id: "icons@2.0.0" }];
  await act(async () => { mocks.modelListeners.forEach((listener) => listener({ type: "commit", summary: { changes: [{ changeNode: { field: "projectDependencies" } }] } })); });
  mocks.packages = [{ id: "icons@1.0.0" }];
  await act(async () => { mocks.modelListeners.forEach((listener) => listener({ type: "commit", summary: { changes: [{ changeNode: { field: "projectDependencies" } }] } })); });
  expect(mocks.exec.mock.calls.map(([, source]) => source)).toEqual([
    "icons@1.0.0",
    "icons@2.0.0",
    "icons@1.0.0",
  ]);
});


it.each(["live", "docs"] as const)("updates the actual %s iframe host from the native environment", (mode) => {
  const environment = createStudioUiEnvironmentFixture({ hostUrl: "https://first.example/host" });
  const fixture = createDocsModelFixture(createSite());
  const component = new TplMgr({ site: fixture.studio.site }).addComponent({ name: "Preview", type: ComponentType.Plain });
  Object.assign(fixture.studio, environment);
  fixture.ctx.setFocusedComponent(component);
  const preview = mockPreview({ studioCtx: fixture.studio, full: true, isLive: false, component: undefined });
  const view = render(mode === "live" ? <PreviewFrame previewCtx={preview} /> : <DocsPreviewCanvas docsCtx={fixture.ctx} />);
  const iframe = view.container.querySelector("iframe");
  expect(iframe?.getAttribute("src")).toContain("https://first.example/host#live=true");
  act(() => { environment.uiEnvironment.store.setState({ hostUrl: "https://second.example/host" }); });
  expect(view.container.querySelector("iframe")).toBe(iframe);
  expect(iframe?.getAttribute("src")).toContain("https://second.example/host#live=true");
  act(() => { environment.uiEnvironment.store.setState({ brand: { logoTooltip: "Unrelated brand" } }); });
  expect(view.container.querySelector("iframe")).toBe(iframe);
  expect(iframe?.getAttribute("src")).toContain("https://second.example/host#live=true");
  view.unmount();
  expect(mocks.modelListeners.size).toBe(0);
  expect(fixture.listeners.size).toBe(0);
  fixture.ctx.dispose();
});
