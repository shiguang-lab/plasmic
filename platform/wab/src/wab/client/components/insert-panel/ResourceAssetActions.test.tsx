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
import { observable } from "mobx";
import React from "react";

const downloads = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/dom-utils", () => ({ downloadImageAsset: downloads }));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (text: string) => text }),
}));
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
afterEach(cleanup);

function fixture() {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const asset = mgr.addImageAsset({
    name: "Hero",
    type: ImageAssetType.Picture,
    dataUri: "/hero.png",
    width: 640,
    height: 480,
  });
  const state = observable({
    editable: true,
    permission: "writable" as UiAccess,
  });
  const rename = vi.fn((value, name) => mgr.renameImageAsset(value, name));
  const remove = vi.fn().mockResolvedValue(undefined);
  const ops: Pick<SiteOps, "renameImageAsset" | "tryDeleteImageAssets"> = {
    renameImageAsset: rename,
    tryDeleteImageAssets: remove,
  };
  const sc: Pick<
    StudioCtx,
    "site" | "canSave" | "getLeftTabPermission" | "siteOps" | "changeUnsafe"
  > = {
    site,
    canSave: () => state.editable,
    getLeftTabPermission: () => state.permission,
    siteOps: () => ops as SiteOps,
    changeUnsafe: async (fn) => fn(),
  };
  const parentClick = vi.fn();
  const parentKey = vi.fn();
  render(
    <div onClick={parentClick} onKeyDown={parentKey}>
      <ResourceAssetActions studioCtx={sc as StudioCtx} asset={asset} />
    </div>,
  );
  return { site, asset, state, rename, remove, parentClick, parentKey };
}
async function openMenu() {
  fireEvent.click(screen.getByRole("button", { name: "Asset actions" }));
  await screen.findByRole("menu");
}
it("provides the existing sidebar modal context for references and closes without inserting the asset", async () => {
  const f = fixture();
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
  const f = fixture();
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
  const f = fixture();
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
  await screen.findByText("Failed to update asset");
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
  const f = fixture();
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Rename" }));
  const input = await screen.findByRole("textbox", { name: "Asset name" });
  fireEvent.change(input, { target: { value: "Blocked" } });
  act(() => {
    f.state.permission = "readable";
  });
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
  act(() => {
    f.state.permission = "writable";
    f.site.imageAssets = [];
    f.state.editable = false;
  });
  act(() => {
    f.state.editable = true;
  });
  expect(screen.queryByRole("menuitem", { name: "Delete" })).toBeNull();
});
it("delegates deletion to the existing usage-aware confirmation operation and releases the busy state on failure", async () => {
  const f = fixture();
  f.remove.mockRejectedValueOnce(new Error("offline"));
  await openMenu();
  fireEvent.click(screen.getByRole("menuitem", { name: "Delete" }));
  await screen.findByText("Failed to update asset");
  expect(f.remove).toHaveBeenCalledWith([f.asset]);
  expect(f.site.imageAssets).toContain(f.asset);
  expect(screen.getByRole("button", { name: "Asset actions" })).toBeEnabled();
  expect(f.parentClick).not.toHaveBeenCalled();
});
