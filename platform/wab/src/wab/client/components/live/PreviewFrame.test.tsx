import { PreviewCtx } from "@/wab/client/components/live/PreviewCtx";
import { useLivePreview } from "@/wab/client/components/live/PreviewFrame";
import { act, cleanup, renderHook } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({
  api: { setStudioReady: vi.fn().mockResolvedValue(undefined) },
  packages: [] as object[],
  dispose: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({
  useTopFrameApi: () => mocks.api,
}));
vi.mock("@/wab/client/components/live/live-syncer", () => ({
  onLoadInjectSystemJS: vi.fn().mockResolvedValue(undefined),
  pushPreviewModules: () => mocks.dispose,
}));
vi.mock("@/wab/client/components/canvas/studio-canvas-util", () => ({
  trapInteractionError: vi.fn(),
}));
vi.mock("@/wab/shared/cached-selectors", () => ({
  usedHostLessPkgs: () => mocks.packages,
}));

beforeEach(() => vi.clearAllMocks());
afterEach(cleanup);

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
  return { ...hook, notify };
}

it.each(["rendered", "error"])(
  "releases the full preview startup overlay after the live frame reports %s",
  async (type) => {
    const { notify } = await setup(true);
    expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
    notify("rendered", {} as MessageEventSource);
    notify("unrelated");
    expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
    notify(type);
    notify(type);
    expect(mocks.api.setStudioReady).toHaveBeenCalledTimes(1);
  },
);

it("leaves the editor's readiness owner in charge of regular preview", async () => {
  const { notify } = await setup(false);
  notify("rendered");
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});

it("removes the readiness listener when the preview unmounts", async () => {
  const { notify, unmount } = await setup(true);
  unmount();
  expect(mocks.dispose).toHaveBeenCalledOnce();
  notify("rendered");
  expect(mocks.api.setStudioReady).not.toHaveBeenCalled();
});
