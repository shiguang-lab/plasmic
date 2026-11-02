import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import CommentsTab from "@/wab/client/components/comments/CommentsTab";
import { setLanguagePreference } from "@/wab/client/i18n";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ApiUser } from "@/wab/shared/ApiSchema";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const fixture = vi.hoisted(() => ({ ctx: undefined as StudioCtx | undefined }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({
  useStudioCtx: () => fixture.ctx,
}));
vi.mock("@/wab/client/components/comments/RootComment", () => ({ default: () => null }));
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
  expect(screen.getByRole("alert").textContent).toContain("Failed to fetch comments for project");
  expect(screen.queryByText("No open comments")).toBeNull();
  api.getComments.mockResolvedValueOnce({ threads: [], users: [], reactions: [] });
  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Retry" })));
  await waitFor(() => expect(screen.queryByRole("alert")).toBeNull());
  expect(screen.getByText("No open comments")).toBeTruthy();
});
