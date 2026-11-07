import { showError } from "@/wab/client/ErrorNotifications";
vi.mock("@/wab/client/ErrorNotifications", async (original) => ({
  ...(await original<typeof import("@/wab/client/ErrorNotifications")>()),
  showError: vi.fn(),
}));
import { SiteOps } from "@/wab/client/components/canvas/site-ops";
import { ResourceAssetActions } from "@/wab/client/components/insert-panel/ResourceAssetActions";
import { useMaybeSidebarModalContext } from "@/wab/client/components/sidebar/SidebarModal";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { createSite } from "@/wab/shared/core/sites";
import { UiAccess } from "@/wab/shared/ui-config-utils";
import "@testing-library/jest-dom/vitest";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { deepMerged } from "@/wab/commons/collections";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { mock } from "vitest-mock-extended";
import React from "react";
import { ok } from "neverthrow";

const downloads = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/dom-utils", async (original) => ({ ...(await original<typeof import("@/wab/client/dom-utils")>()), downloadImageAsset: downloads }));

vi.mock("@/wab/client/components/sidebar/FindReferencesModal", () => ({
  FindReferencesModal: ({ onClose }: { onClose: () => void }) => {
    if (!useMaybeSidebarModalContext()) {
      throw new Error("Missing sidebar modal context");
    }
    return (
      <div>
        References opened<button onClick={onClose}>Close references</button>
      </div>
    );
  },
}));
const studios: StudioCtx[] = [];
afterEach(async () => { cleanup(); for (const studio of studios.splice(0)) { await studio.awaitEval(); studio.dispose(); } vi.restoreAllMocks(); });

async function fixture() {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const asset = mgr.addImageAsset({
    name: "Hero",
    type: ImageAssetType.Picture,
    dataUri: "/hero.png",
    width: 640,
    height: 480,
  });
  const {studioCtx: sc, api} = fakeStudioCtx({site, devFlagOverrides:{ccStubs:true}});
  studios.push(sc);
  await waitFor(() => expect(sc.initialRouteReady).toBe(true));
  const rename = vi.spyOn(SiteOps.prototype, "renameImageAsset");
  const remove = vi.spyOn(SiteOps.prototype, "tryDeleteImageAssets").mockResolvedValue(ok({deletedResources:[],messages:[]}));
  async function setPermission(permission: UiAccess) {
    api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), {
      project: { ...sc.siteInfo, uiConfig: deepMerged(sc.getCurrentUiConfig(), { leftTabs: { images: permission, imagesSection: permission, iconsSection: permission } }) },
      perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false,
    }));
    await act(async () => { await sc.refreshSiteInfo(); });
  }
  const parentClick = vi.fn();
  const parentKey = vi.fn();
  render(
    <div onClick={parentClick} onKeyDown={parentKey}>
      <ResourceAssetActions studioCtx={sc} asset={asset} />
    </div>,
  );
  return { site, asset, sc, setPermission, rename, remove, parentClick, parentKey };
}
async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Asset actions" }));
  await screen.findByRole("menu");
}
it("provides the existing sidebar modal context for references and closes without inserting the asset", async () => {
  const f = await fixture();
  await openMenu();
  fireEvent.click(
    screen.getByRole("menuitem", { name: "Find all references" }),
  );
  await screen.findByText("References opened");
  fireEvent.click(screen.getByRole("button", { name: "Close references" }));
  expect(screen.queryByText("References opened")).toBeNull();
  expect(f.parentClick).not.toHaveBeenCalled();
});
it("previews real image dimensions and downloads without inserting from the parent card", async () => {
  const f = await fixture();
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Preview" }));
  const dialog = await screen.findByRole("dialog");
  expect(dialog.querySelector('img[alt="Hero"]')).toHaveAttribute(
    "src",
    "/hero.png",
  );
  await waitFor(() => expect(screen.getByText("640 × 480")).toBeVisible());
  expect(f.parentClick).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Download image" }));
  expect(downloads).toHaveBeenCalledWith(f.asset);
  expect(f.parentClick).not.toHaveBeenCalled();
});
it("renames through the existing model, preserves failed input and retries", async () => {
  const f = await fixture();
  f.rename.mockImplementationOnce(() => {
    throw new Error("offline");
  });
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  const input = await screen.findByRole("textbox", { name: "Asset name" });
  fireEvent.change(input, { target: { value: "  NewHero  " } });
  fireEvent.keyDown(input, { key: "A" });
  expect(f.parentKey).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.any(Error), { title: "Failed to update asset" }));
  expect(input).toHaveValue("  NewHero  ");
  expect(f.asset.name).toBe("Hero");
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  fireEvent.keyDown(screen.getByRole("button", { name: "Asset actions" }), {
    key: "z",
    metaKey: true,
  });
  expect(f.parentKey).toHaveBeenCalledOnce();
  expect(f.asset.name).toBe("NewHero");
  expect(f.rename).toHaveBeenLastCalledWith(f.asset, "NewHero");
  expect(f.parentClick).not.toHaveBeenCalled();
});
it("hides mutations for read-only and dependency assets, and rechecks revoked permission", async () => {
  const f = await fixture();
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  const input = await screen.findByRole("textbox", { name: "Asset name" });
  fireEvent.change(input, { target: { value: "Blocked" } });
  await f.setPermission("readable");
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.keyDown(input, { key: "Enter", code: "Enter", charCode: 13 });
  expect(f.rename).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  await openMenu();
  expect(screen.queryByRole("menuitem", { name: "Rename" })).toBeNull();
  expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
  await waitFor(() =>
    expect(screen.getByRole("menuitem", { name: "Preview" })).toBeVisible(),
  );
  await f.setPermission("writable");
  await act(async () => { await f.sc.changeUnsafe(() => { f.site.imageAssets = []; }); f.sc.editMode = false; });
  act(() => {
    f.sc.editMode = true;
  });
  expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
});
it("delegates deletion to the existing usage-aware confirmation operation and releases the busy state on failure", async () => {
  const f = await fixture();
  f.remove.mockRejectedValueOnce(new Error("offline"));
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.any(Error), { title: "Failed to update asset" }));
  expect(f.remove).toHaveBeenCalledWith([f.asset]);
  expect(f.site.imageAssets).toContain(f.asset);
  expect(screen.getByRole("button", { name: "Asset actions" })).toBeEnabled();
  expect(f.parentClick).not.toHaveBeenCalled();
});
