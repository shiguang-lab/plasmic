import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  reportError: vi.fn(),
  showError: vi.fn(),
}));

it("keeps failed comment loading distinct from a loaded empty list and recovers on retry", async () => {
  const { studioCtx, api } = fakeStudioCtx();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  const ctx = studioCtx.commentsCtx;
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
  rejectRequest(new Error("Offline"));
  await request;
  expect(ctx.loadFailed).toBe(true);
  expect(ctx.isLoading).toBe(false);
  expect(ctx.hasLoaded).toBe(false);
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
