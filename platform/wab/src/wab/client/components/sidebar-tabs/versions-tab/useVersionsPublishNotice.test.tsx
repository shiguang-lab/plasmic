import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { Api } from "@/wab/client/api";
import { useVersionsPublishNotice } from "@/wab/client/components/sidebar-tabs/versions-tab/useVersionsPublishNotice";
import type { PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

const mocks = vi.hoisted(() => ({ handleError: vi.fn() }));
vi.mock("@/wab/client/ErrorNotifications", async (original) => ({ ...(await original<typeof import("@/wab/client/ErrorNotifications")>()), handleError: mocks.handleError }));
type RevisionResponse = Awaited<ReturnType<Api["getProjectRevWithoutData"]>>;
function release(id: string): PkgVersionInfoMeta {
  return { id, pkgId: "pkg", version: "1.0.0", tags: [], createdAt: new Date("2026-01-01"), updatedAt: new Date("2026-01-01"), deletedAt: null, createdById: null, updatedById: null, deletedById: null, revisionId: `${id}-revision`, branchId: null };
}
beforeEach(() => { mocks.handleError.mockClear(); localStorage.clear(); });
afterEach(async () => { await act(async () => { cleanup(); }); });

it("keeps publication notices on the latest release despite reordered responses and metadata-only edits", async () => {
  const { studioCtx, api, dbCtx } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  dbCtx.revisionNum = 9;
  const first = Promise.withResolvers<RevisionResponse>(), latest = Promise.withResolvers<RevisionResponse>();
  api.getProjectRevWithoutData.mockReturnValueOnce(first.promise).mockReturnValueOnce(latest.promise);
  const hook = renderHook(() => useVersionsPublishNotice(studioCtx));
  act(() => { studioCtx.versionHistory.prependRelease(release("first")); });
  await waitFor(() => expect(api.getProjectRevWithoutData).toHaveBeenCalledTimes(1));
  act(() => { studioCtx.versionHistory.prependRelease(release("latest")); });
  await waitFor(() => expect(api.getProjectRevWithoutData).toHaveBeenCalledTimes(2));
  await act(async () => { latest.resolve(mock<RevisionResponse>({ rev: { revision: 7 } })); });
  expect(hook.result.current.useVersionsCTA).toBe(true);
  await act(async () => { first.resolve(mock<RevisionResponse>({ rev: { revision: 20 } })); });
  expect(hook.result.current.useVersionsCTA).toBe(true);
  const published = studioCtx.versionHistory.getRelease("latest");
  api.updatePkgVersion.mockResolvedValueOnce({ pkg: { ...published, description: "Metadata only", tags: ["updated"], model: { root: "", map: {}, deps: [], version: "test" } } });
  await act(async () => { await studioCtx.updatePkgVersion("pkg", "1.0.0", null, { description: "Metadata only" }); });
  expect(api.getProjectRevWithoutData).toHaveBeenCalledTimes(2);
  act(() => { dbCtx.revisionNum = 7; });
  expect(hook.result.current.useVersionsCTA).toBe(false);
  act(() => { dbCtx.revisionNum = 9; hook.result.current.dismissVersionsCTA(); });
  expect(hook.result.current.useVersionsCTA).toBe(false);
  hook.unmount(); studioCtx.dispose();
});

it("reports a failed revision lookup and ignores a response after unmount", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const failure = new Error("Published revision lookup failed");
  api.getProjectRevWithoutData.mockRejectedValueOnce(failure);
  studioCtx.versionHistory.prependRelease(release("failed"));
  const hook = renderHook(() => useVersionsPublishNotice(studioCtx));
  await waitFor(() => expect(mocks.handleError).toHaveBeenCalledWith(failure));
  expect(hook.result.current.useVersionsCTA).toBe(false);
  expect(studioCtx.versionHistory.store.getState().releases[0].id).toBe("failed");
  const pending = Promise.withResolvers<RevisionResponse>();
  api.getProjectRevWithoutData.mockReturnValueOnce(pending.promise);
  act(() => { studioCtx.versionHistory.prependRelease(release("pending")); });
  await waitFor(() => expect(api.getProjectRevWithoutData).toHaveBeenCalledTimes(2));
  hook.unmount(); studioCtx.dispose();
  await act(async () => { pending.resolve(mock<RevisionResponse>({ rev: { revision: 1 } })); });
  expect(mocks.handleError).toHaveBeenCalledOnce();
});
