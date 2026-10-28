import { trapInteractionError } from "@/wab/client/components/canvas/studio-canvas-util";
import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { useLivePreview } from "@/wab/client/components/live/PreviewFrame";
import { act, cleanup, renderHook } from "@testing-library/react";
import { mock } from "vitest-mock-extended";
import { observable, runInAction } from "mobx";

const mocks = vi.hoisted(() => ({
  api: { setStudioReady: vi.fn().mockResolvedValue(undefined) },
  packages: [] as object[],
  dispose: vi.fn(),
  load: vi.fn(),
  committed: undefined as (() => void) | undefined,
  sortedPackages: vi.fn(),
  exec: vi.fn(),
  push: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => mocks.api,
}));
vi.mock("@/wab/client/components/live/live-syncer", () => ({
  onLoadInjectLiveRuntime: mocks.load,
  pushPreviewModules: (_win: Window, _ctx: unknown, options: { onRendered: () => void }) => {
    mocks.push(_win);
    mocks.committed = options.onRendered;
    return mocks.dispose;
  },
}));
vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  trapInteractionError: vi.fn(),
}));
vi.mock("@/wab/shared/cached-selectors", () => ({
  usedHostLessPkgs: () => mocks.packages,
}));
vi.mock("@/wab/client/components/studio/studio-bundles", () => ({
  getHostLessPkgIdentity: (pkg: { id: string }) => pkg.id,
  getSortedHostLessPkgs: mocks.sortedPackages,
  getVersionForCanvasPackages: () => "test",
}));
vi.mock("@/wab/client/dom-utils", () => ({ scriptExec: mocks.exec }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.committed = undefined;
  mocks.packages = [];
  mocks.load.mockResolvedValue(undefined);
});
afterEach(cleanup);

it("clears SPA navigation feedback and removes the cursor layer on reset and close", async () => {
  const data = observable.box<PreviewCtx["previewData"]>(undefined, { deep: false });
  const previewCtx = mock<PreviewCtx>({ full: false, isLive: false, popup: undefined, pageHash: "" });
  Object.defineProperty(previewCtx, "previewData", { get: () => data.get() });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  await act(async () => hook.result.current.onLoad());
  expect(document.querySelectorAll("[data-plasmic-agent-cursor]")).toHaveLength(2);
  const events: string[] = [];
  const listen = (event: Event) => events.push((event as CustomEvent).detail.action);
  window.addEventListener("plasmic-agent-cursor", listen);
  try {
    act(() => runInAction(() => data.set(mock<NonNullable<PreviewCtx["previewData"]>>({ previewPath: "/next" }))));
    expect(events).toEqual(["clear"]);
    act(() => hook.result.current.reset());
    expect(document.querySelector("[data-plasmic-agent-cursor]")).toBeNull();
    hook.result.current.frameRef.current = window;
    await act(async () => hook.result.current.onLoad());
    expect(document.querySelectorAll("[data-plasmic-agent-cursor]")).toHaveLength(2);
    hook.unmount();
    expect(document.querySelector("[data-plasmic-agent-cursor]")).toBeNull();
  } finally {
    window.removeEventListener("plasmic-agent-cursor", listen);
  }
});

async function setup(full: boolean) {
  const previewCtx = mock<PreviewCtx>({
    full,
    isLive: false,
    popup: undefined,
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
  mocks.load.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const previewCtx = mock<PreviewCtx>({ full: true, isLive: false, popup: undefined, pageHash: "" });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  let loading: Promise<void> | undefined;
  act(() => { loading = hook.result.current.onLoad(); });
  expect(mocks.load).toHaveBeenCalledTimes(1);
  act(() => hook.result.current.reset());
  await act(async () => { finish(); await loading; });
  expect(mocks.committed).toBeUndefined();
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("does not activate an earlier load after reset even when the WindowProxy is reused", async () => {
  let finish = () => {};
  mocks.load.mockImplementationOnce(() => new Promise<void>((resolve) => { finish = resolve; }));
  const previewCtx = mock<PreviewCtx>({ full: true, isLive: false, popup: undefined, pageHash: "" });
  const hook = renderHook(() => useLivePreview(previewCtx));
  hook.result.current.frameRef.current = window;
  let loading: Promise<void> | undefined;
  act(() => { loading = hook.result.current.onLoad(); });
  act(() => hook.result.current.reset());
  hook.result.current.frameRef.current = window;
  await act(async () => { finish(); await loading; });
  expect(mocks.push).not.toHaveBeenCalled();
});

it.each([true, false])("isolates package installation across reset (old resolves first: %s)", async (oldFirst) => {
  mocks.packages = [{ id: "components" }];
  let finishOld = (_value: [string, string][]) => {};
  let finishNew = (_value: [string, string][]) => {};
  mocks.sortedPackages
    .mockImplementationOnce(() => new Promise<[string, string][]>((resolve) => { finishOld = resolve; }))
    .mockImplementationOnce(() => new Promise<[string, string][]>((resolve) => { finishNew = resolve; }));
  const previewCtx = mock<PreviewCtx>({ full: true, isLive: false, popup: undefined, pageHash: "" });
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
});

it.each([null, undefined, "", "   "])("reports an empty navigation destination (%s) without a null property error", async (destination) => {
  await setup(false);
  const loc = { type: "InteractionLoc", actionName: "navigation", interactionUuid: "openTarget" };
  const run = () => (window as any).__PlasmicWrapUserFunction(loc, vi.fn(), { destination });
  expect(run).toThrow("Navigation destination must be a non-empty string");
  expect(trapInteractionError).toHaveBeenCalledWith(expect.anything(), loc,
    expect.objectContaining({ message: "Navigation destination must be a non-empty string" }));
});

it("reloads the original library version in Preview after an update is undone", async () => {
  mocks.packages = [{ id: "icons@1.0.0" }];
  mocks.sortedPackages.mockImplementation(async () => mocks.packages.map((pkg) => {
    const { id } = pkg as { id: string };
    return [id, id];
  }));
  const hook = await setup(false);
  mocks.packages = [{ id: "icons@2.0.0" }];
  await act(async () => hook.rerender());
  mocks.packages = [{ id: "icons@1.0.0" }];
  await act(async () => hook.rerender());
  expect(mocks.exec.mock.calls.map(([, source]) => source)).toEqual(["icons@1.0.0", "icons@2.0.0", "icons@1.0.0"]);
});
