import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { FindReferencesModal } from "@/wab/client/components/sidebar/FindReferencesModal";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ComponentType } from "@/wab/shared/core/components";
import { createSite } from "@/wab/shared/core/sites";
import { act, cleanup, render, screen, waitFor } from "@testing-library/react";
import * as React from "react";

vi.mock("@/wab/client/components/sidebar/SidebarModal", async (original) => ({
  ...await original<typeof import("@/wab/client/components/sidebar/SidebarModal")>(),
  SidebarModal: ({ title, children }: { title: React.ReactNode; children: React.ReactNode }) => <section>{title}{children}</section>,
}));
afterEach(cleanup);

it("updates reference names after a real model commit without replacing command targets", async () => {
  const site = createSite();
  const component = new TplMgr({ site }).addComponent({ name: "Original reference", type: ComponentType.Plain });
  const { studioCtx } = fakeStudioCtx({ site });
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  const { unmount } = render(<FindReferencesModal studioCtx={studioCtx} displayName="Target" icon={null}
    usageSummary={{ components: [component], frames: [] }} onClose={vi.fn()} />);
  try {
    expect(screen.getByText("Original reference")).toBeTruthy();
    await act(async () => { await studioCtx.changeUnsafe(() => { component.name = "Renamed reference"; }); });
    expect(screen.getByText("Renamed reference")).toBeTruthy();
    expect(screen.queryByText("Original reference")).toBeNull();
  } finally { unmount(); studioCtx.dispose(); }
});
