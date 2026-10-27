import { AlertBanner, AlertSpec, AlertData } from "@/wab/client/components/widgets/plasmic/AlertBanner";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { DesktopDraftController } from "@/wab/client/studio-ctx/desktop-drafts";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { observable } from "mobx";
import React from "react";
import { mock } from "vitest-mock-extended";

afterEach(cleanup);

it("keeps the draft review entry accessible while conflicting edits are blocked", () => {
  const desktopDraft = mock<DesktopDraftController>({ dialogOpen: false, status: { state: "conflict", pendingDrafts: 1 } });
  const studioCtx = mock<StudioCtx>({ desktopDraft, blockChanges: true, isAtTip: false });
  studioCtx.alertBannerState = observable.box<AlertData | null>(AlertSpec.ConcurrentEdit, { deep: false });
  const mask = document.createElement("div");
  mask.className = "dark-mask";
  document.body.append(mask);
  render(<AlertBanner studioCtx={studioCtx} />);
  expect(screen.getByRole("alert").textContent).toContain("Drafts need attention");
  expect(document.querySelector(".dark-mask")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Local drafts" }));
  expect(desktopDraft.dialogOpen).toBe(true);
});
