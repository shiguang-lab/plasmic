import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { reportError, showError } from "@/wab/client/ErrorNotifications";
vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  reportError: vi.fn(),
  showError: vi.fn(),
}));

it("keeps failed comment loading distinct from a loaded empty list and recovers on retry", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  const ctx = studioCtx.commentsCtx;
  expect(ctx.commentsFilter()).toEqual({
    scope: "current",
    status: "unresolved",
    onlyRelated: false,
  });
  let rejectRequest: (reason: Error) => void = () => {};
  api.getComments.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      }),
  );
  const request = ctx.fetchComments();
  expect(ctx.isLoading).toBe(true);
  expect(ctx.hasLoaded).toBe(false);
  const error = new Error("Bad Gateway");
  rejectRequest(error);
  await request;
  expect(ctx.loadFailed).toBe(true);
  expect(ctx.isLoading).toBe(false);
  expect(ctx.hasLoaded).toBe(false);
  expect(reportError).toHaveBeenCalledWith(error);
  expect(showError).not.toHaveBeenCalled();
  api.getComments.mockResolvedValueOnce({
    threads: [],
    users: [],
    reactions: [],
  });
  await ctx.fetchComments();
  expect(ctx.hasLoaded).toBe(true);
  expect(ctx.loadFailed).toBe(false);
  expect(ctx.computedData().allThreads).toEqual([]);
});
