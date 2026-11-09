import { toOpaque } from "@/wab/commons/types";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { getDedicatedArena } from "@/wab/shared/core/sites";
import { isTplNamable } from "@/wab/shared/core/tpls";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type { TplCommentThread } from "@/wab/client/components/comments/utils";
import CommentsTab from "@/wab/client/components/comments/CommentsTab";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ApiUser } from "@/wab/shared/ApiSchema";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ ctx: undefined as StudioCtx | undefined }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock("@/wab/client/components/comments/RootComment", () => ({
  default: ({ commentThread }: { commentThread: TplCommentThread }) => <span>{commentThread.comments[0]?.body}</span>,
}));
vi.mock("@/wab/client/ErrorNotifications", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/wab/client/ErrorNotifications")>()),
  reportError: vi.fn(),
  showError: vi.fn(),
}));

afterEach(cleanup);

it("shows a local comment load error and restores the list after retry", async () => {
  await setLanguagePreference("en");
  const { studioCtx, api } = fakeStudioCtx();
  fixture.ctx = studioCtx;
  studioCtx.appCtx.selfInfo = mock<ApiUser>();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  api.getComments.mockRejectedValueOnce(new Error("Bad Gateway"));
  await studioCtx.commentsCtx.fetchComments();

  render(<CommentsTab />);
  expect(screen.getByRole("alert").textContent).toContain(
    "Failed to fetch comments for project",
  );
  expect(screen.queryByText("No open comments")).toBeNull();
  api.getComments.mockResolvedValueOnce({
    threads: [],
    users: [],
    reactions: [],
  });
  await act(async () =>
    fireEvent.click(screen.getByRole("button", { name: "Retry" })),
  );
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("No open comments")).toBeTruthy();
});

it("keeps the real panel idle during equal background refreshes and updates explicit filter controls", async () => {
  await setLanguagePreference("en");
  const { studioCtx, api } = fakeStudioCtx();
  fixture.ctx = studioCtx;
  studioCtx.appCtx.selfInfo = mock<ApiUser>();
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  api.getComments.mockResolvedValue({ threads: [], users: [], reactions: [] });
  await studioCtx.commentsCtx.fetchComments();
  const commits = vi.fn();
  render(
    <React.Profiler id="comments" onRender={commits}>
      <CommentsTab />
    </React.Profiler>,
  );
  await act(async () => {
    await Promise.resolve();
  });
  commits.mockClear();
  await act(async () => {
    for (let i = 0; i < 20; i++) {
      await studioCtx.commentsCtx.fetchComments();
    }
  });
  expect(commits).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("checkbox", { name: "Related to me" }));
  expect(studioCtx.commentsCtx.filterStore.getState().onlyRelated).toBe(true);
  expect(screen.getByText("No comments related to you")).toBeTruthy();
  commits.mockClear();
  await act(() => {
    for (let i = 0; i < 100; i++) {
      studioCtx.commentsCtx.setCommentsFilter({
        ...studioCtx.commentsCtx.filterStore.getState(),
      });
    }
  });
  expect(commits).not.toHaveBeenCalled();
});


it("filters the real comment data when only the native current arena changes", async () => {
  await setLanguagePreference("en");
  const { studioCtx, api, appCtx } = fakeStudioCtx();
  fixture.ctx = studioCtx;
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  studioCtx.appCtx.selfInfo = mock<ApiUser>({ id: toOpaque("self"), email: "self@example.com" });
  vi.spyOn(studioCtx, "showComments").mockReturnValue(true);
  const first = await studioCtx.changeUnsafe(() => studioCtx.addComponent("First", { type: ComponentType.Page }));
  const second = await studioCtx.changeUnsafe(() => studioCtx.addComponent("Second", { type: ComponentType.Page, noSwitchArena: true }));
  const subject = first.tplTree;
  if (!isTplNamable(subject)) { throw new Error("Expected namable page root"); }
  studioCtx.bundler().bundle(studioCtx.site, studioCtx.siteInfo.id, appCtx.lastBundleVersion);
  const address = ensure(studioCtx.bundler().addrOf(subject), "Comment subject address");
  const date = new Date(2026, 10, 1).toISOString();
  const common = { createdAt: date, updatedAt: date, deletedAt: null, createdById: "self", updatedById: "self", deletedById: null };
  api.getComments.mockResolvedValue({
    threads: [{ ...common, id: toOpaque("first-thread"), resolved: false, location: { subject: address, variants: [] },
      comments: [{ ...common, id: toOpaque("comment"), commentThreadId: toOpaque("first-thread"), body: "First page thread" }], commentThreadHistories: [] }],
    users: [studioCtx.appCtx.selfInfo], reactions: [],
  });
  await studioCtx.commentsCtx.fetchComments();
  studioCtx.currentArena = ensure(getDedicatedArena(studioCtx.site, first), "First arena");
  const { unmount } = render(<CommentsTab />);
  expect(screen.getByText("First page thread")).toBeTruthy();
  expect(screen.queryByText("No open comments")).toBeNull();
  act(() => { studioCtx.currentArena = ensure(getDedicatedArena(studioCtx.site, second), "Second arena"); });
  expect(screen.getByText("No open comments")).toBeTruthy();
  act(() => { studioCtx.currentArena = ensure(getDedicatedArena(studioCtx.site, first), "First arena"); });
  expect(screen.queryByText("No open comments")).toBeNull();
  unmount();
  studioCtx.dispose();
});
