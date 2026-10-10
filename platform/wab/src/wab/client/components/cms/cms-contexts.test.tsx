import {
  useCmsRow,
  useCmsRowHistory,
  useCmsRowRevision,
} from "@/wab/client/components/cms/cms-contexts";
import { CmsRowId, CmsRowRevisionId, CmsTableId } from "@/wab/shared/ApiSchema";
import { act, cleanup, renderHook, waitFor } from "@testing-library/react";
import React from "react";
import { SWRConfig } from "swr";
const mocks = vi.hoisted(() => ({
  getCmsRow: vi.fn(),
  listCmsRowRevisions: vi.fn(),
  getCmsRowRevision: vi.fn(),
}));
vi.mock("@/wab/client/contexts/AppContexts", () => ({ useApi: () => mocks }));
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
const wrapper = ({ children }: { children: React.ReactNode }) => (
  <SWRConfig
    value={{
      provider: () => new Map(),
      shouldRetryOnError: false,
      dedupingInterval: 0,
    }}
  >
    {children}
  </SWRConfig>
);

it("returns actual row error and recovers using the same row endpoint", async () => {
  mocks.getCmsRow
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ id: "row1", revision: 2 });
  const { result } = renderHook(
    () => useCmsRow("table1" as CmsTableId, "row1" as CmsRowId),
    { wrapper },
  );
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  expect(result.current.row).toBeUndefined();
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.row).toEqual({ id: "row1", revision: 2 });
  expect(result.current.error).toBeUndefined();
  expect(mocks.getCmsRow).toHaveBeenLastCalledWith("row1");
});

it("exposes history failure and retains an actual empty response after retry", async () => {
  mocks.listCmsRowRevisions
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce([]);
  const { result } = renderHook(() => useCmsRowHistory("row1" as CmsRowId), {
    wrapper,
  });
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.revisions).toEqual([]);
  expect(result.current.error).toBeUndefined();
  expect(mocks.listCmsRowRevisions).toHaveBeenLastCalledWith("row1");
});

it("recovers a selected revision without substituting current draft data", async () => {
  mocks.getCmsRowRevision
    .mockRejectedValueOnce(new Error("offline"))
    .mockResolvedValueOnce({ id: "rev1", data: { "": { title: "Original" } } });
  const { result } = renderHook(
    () => useCmsRowRevision("row1" as CmsRowId, "rev1" as CmsRowRevisionId),
    { wrapper },
  );
  await waitFor(() => expect(result.current.error).toBeInstanceOf(Error));
  await act(async () => {
    await result.current.mutate();
  });
  expect(result.current.revision?.data).toEqual({ "": { title: "Original" } });
  expect(mocks.getCmsRowRevision).toHaveBeenLastCalledWith("rev1");
});
