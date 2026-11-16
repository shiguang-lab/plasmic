import { promptRevisionRevert, promptVersionRevert } from "@/wab/client/components/sidebar-tabs/versions-tab/utils";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { zIndex } from "@/wab/client/z-index";
import type { MinimalRevisionInfo, PkgVersionInfoMeta } from "@/wab/shared/SharedApi";
import type { ProjectId } from "@/wab/shared/ApiSchema";
import type { ProjectRevision } from "@/wab/server/entities/Entities";
import { ensure } from "@/wab/shared/common";
import { FastBundler } from "@/wab/shared/bundler";
import { createSite } from "@/wab/shared/core/sites";
import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { mock } from "vitest-mock-extended";

const errors = vi.hoisted(() => ({ handleError: vi.fn(), showError: vi.fn() }));
vi.mock("@/wab/client/ErrorNotifications", () => errors);
vi.mock("@/wab/client/components/modals/SiteDiffs", () => ({ SiteDiffs: () => null }));

function fixture() {
  const data = JSON.stringify(new FastBundler().bundle(createSite(), "project", "test"));
  const getProjectRevision = vi.fn<StudioCtx["appCtx"]["api"]["getProjectRevision"]>().mockResolvedValue({ rev: mock<ProjectRevision>({ data }), depPkgs: [], etag: "test" });
  const studio = mock<StudioCtx>({
    siteInfo: { id: "project" as ProjectId },
    appCtx: { api: { getProjectRevision }, lastBundleVersion: "test" },
  });
  const previous = mock<MinimalRevisionInfo>({ id: "previous", createdAt: new Date("2026-11-05") });
  const latest = mock<MinimalRevisionInfo>({ id: "latest" });
  const release = mock<PkgVersionInfoMeta>({ revisionId: previous.id, version: "1.0.0", createdAt: previous.createdAt });
  return { studio, previous, latest, release, getProjectRevision };
}
beforeEach(() => vi.clearAllMocks());

it.each(["revision", "release"] as const)("loads %s diffs with the compiler enabled and places confirmation above the versions popover", async (kind) => {
  const f = fixture();
  let prompt: Promise<boolean | undefined> = Promise.resolve(undefined);
  await act(async () => {
    prompt = kind === "revision"
      ? promptRevisionRevert(f.previous, f.latest, f.studio)
      : promptVersionRevert(f.release, [f.release], [f.latest], f.studio);
  });
  try {
    await waitFor(() => expect(f.getProjectRevision).toHaveBeenCalledTimes(2));
    expect(f.getProjectRevision.mock.calls).toEqual([["project", "previous"], ["project", "latest"]]);
    await screen.findByText("No changes");
    expect(errors.handleError).not.toHaveBeenCalled();
    expect(errors.showError).not.toHaveBeenCalled();
    const dialog = screen.getByRole("dialog");
    expect(Number(ensure(dialog.closest<HTMLElement>(".ant-modal-wrap"), "Modal wrapper").style.zIndex)).toBe(zIndex.quickModal);
  } finally {
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Cancel" })));
    expect(await prompt).toBeUndefined();
  }
});

it("reports a failed diff once and still allows confirmation", async () => {
  const f = fixture();
  f.getProjectRevision.mockRejectedValue(new Error("Request failed"));
  let prompt: Promise<boolean | undefined> = Promise.resolve(undefined);
  await act(async () => { prompt = promptRevisionRevert(f.previous, f.latest, f.studio); });
  try {
    await screen.findByText("Could not fetch the differences. You can still proceed with the revert.");
    expect(errors.showError).toHaveBeenCalledExactlyOnceWith(expect.objectContaining({ message: "Request failed" }), { title: "Failed to load changes" });
    expect(errors.handleError).not.toHaveBeenCalled();
  } finally {
    await act(async () => fireEvent.click(screen.getByRole("button", { name: "Revert" })));
    expect(await prompt).toBe(true);
  }
});
