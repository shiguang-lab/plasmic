import type { MockInstance } from "vitest";
import { message } from "antd";
import { mock } from "vitest-mock-extended";
import { showError } from "@/wab/client/ErrorNotifications";
vi.mock("@/wab/client/ErrorNotifications", async (original) => ({
  ...(await original<typeof import("@/wab/client/ErrorNotifications")>()),
  showError: vi.fn(),
}));
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { deepMerged } from "@/wab/commons/collections";
import type { GetProjectResponse } from "@/wab/shared/ApiSchema";
import { SiteOps } from "@/wab/client/components/canvas/site-ops";
import { ResourceUpload } from "@/wab/client/components/insert-panel/ResourceUpload";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
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
import React from "react";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  upload: vi.fn(),
  create: vi.fn(),
  uploaded: vi.fn(),
}));
vi.mock("@/wab/client/dom-utils", async (original) => ({
  ...(await original<typeof import("@/wab/client/dom-utils")>()),
  readAndSanitizeFileAsImage: mocks.read,
  maybeUploadImage: mocks.upload,
}));
vi.mock("@/wab/client/i18n", async (original) => ({
  ...(await original<typeof import("@/wab/client/i18n")>()),
  useI18n: () => ({ t: (value: string) => value }),
}));
let studioCtx: StudioCtx;
let api: ReturnType<typeof fakeStudioCtx>["api"];
let changed: MockInstance<StudioCtx["change"]>;
async function setPermission(permission: UiAccess) {
  api.getSiteInfo.mockResolvedValueOnce(Object.assign(mock<GetProjectResponse>(), {
    project: { ...studioCtx.siteInfo, uiConfig: deepMerged(studioCtx.getCurrentUiConfig(), { leftTabs: { images: permission, imagesSection: permission, iconsSection: permission } }) },
    perms: [], owner: undefined, latestRevisionSynced: 0, hasAppAuth: false, appAuthProvider: undefined, isMainBranchProtected: false,
  }));
  await act(async () => { await studioCtx.refreshSiteInfo(); });
}
const file = new File(["fixture"], "Hero.png", { type: "image/png" });
function chooseFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  if (!input) {
    throw new Error("Missing upload input");
  }
  fireEvent.change(input, { target: { files: [file] } });
}
beforeEach(async () => {
  vi.clearAllMocks();
  vi.spyOn(message, "success").mockReturnValue(mock());
  vi.spyOn(message, "error").mockReturnValue(mock());
  ({studioCtx, api} = fakeStudioCtx({devFlagOverrides:{ccStubs:true}}));
  await waitFor(() => expect(studioCtx.initialRouteReady).toBe(true));
  changed = vi.spyOn(studioCtx, "change");
  vi.spyOn(SiteOps.prototype, "createImageAsset").mockImplementation(mocks.create);
  mocks.read.mockResolvedValue({ image: "sanitized" });
  mocks.upload.mockResolvedValue({
    imageResult: { uri: "saved" },
    opts: { name: "Hero.png", type: ImageAssetType.Picture },
  });
});
afterEach(async () => {
  await act(async () => { cleanup(); await studioCtx.awaitEval(); studioCtx.dispose(); });
  vi.restoreAllMocks();
});
it("shows progress on the selected icon upload and locks the image action until it finishes", async () => {
  let finish: (() => void) | undefined;
  mocks.read.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = () => resolve({ image: "sanitized" });
      }),
  );
  const { container } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  const iconInput = container.querySelector(
    'input[accept="image/svg+xml,.svg"]',
  );
  if (!iconInput) {
    throw new Error("Missing icon upload input");
  }
  const icon = new File(["<svg/>"], "Icon.svg", { type: "image/svg+xml" });
  fireEvent.change(iconInput, { target: { files: [icon] } });
  await waitFor(() =>
    expect(mocks.read).toHaveBeenCalledWith(studioCtx.appCtx, icon),
  );
  expect(screen.getByRole("button", { name: /Upload icon/ })).toHaveClass(
    "ant-btn-loading",
  );
  expect(screen.getByRole("button", { name: "Upload image" })).not.toHaveClass(
    "ant-btn-loading",
  );
  expect(screen.getByRole("button", { name: "Upload image" })).toBeDisabled();
  await act(async () => finish?.());
  await waitFor(() => expect(message.success).toHaveBeenCalledExactlyOnceWith({ content: "Asset uploaded" }));
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.upload).toHaveBeenCalledWith(
    studioCtx.appCtx,
    { image: "sanitized" },
    ImageAssetType.Icon,
    icon,
  );
  expect(screen.getByRole("button", { name: "Upload image" })).toBeEnabled();
});
it("creates the asset through the saved model only after a successful upload", async () => {
  const { container } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  chooseFile(container);
  await waitFor(() => expect(message.success).toHaveBeenCalledExactlyOnceWith({ content: "Asset uploaded" }));
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.read).toHaveBeenCalledWith(studioCtx.appCtx, file);
  expect(mocks.upload).toHaveBeenCalledWith(
    studioCtx.appCtx,
    { image: "sanitized" },
    ImageAssetType.Picture,
    file,
  );
  expect(changed).toHaveBeenCalledOnce();
  expect(mocks.create).toHaveBeenCalledWith(
    { uri: "saved" },
    { name: "Hero.png", type: ImageAssetType.Picture },
  );
  expect(mocks.uploaded).toHaveBeenCalledWith(ImageAssetType.Picture);
});
it("retains upload controls after failure and retries without creating an empty asset", async () => {
  mocks.upload.mockRejectedValueOnce(new Error("offline"));
  const { container } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  chooseFile(container);
  await waitFor(() => expect(showError).toHaveBeenCalledWith(expect.any(Error), { title: "Failed to upload asset" }));
  expect(mocks.create).not.toHaveBeenCalled();
  chooseFile(container);
  await waitFor(() => expect(message.success).toHaveBeenCalledExactlyOnceWith({ content: "Asset uploaded" }));
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.create).toHaveBeenCalledOnce();
});
it("rejects invalid image data before upload and hides actions from read-only users", async () => {
  mocks.read.mockResolvedValueOnce(undefined);
  const { container, rerender } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  chooseFile(container);
  await waitFor(() => expect(message.error).toHaveBeenCalledExactlyOnceWith({ content: "Invalid image" }));
  expect(container.querySelector(".ant-alert")).toBeNull();
  expect(mocks.upload).not.toHaveBeenCalled();
  act(() => {
    studioCtx.editMode = false;
  });
  rerender(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  expect(screen.queryByRole("button", { name: "Upload image" })).toBeNull();
});
it("does not duplicate an image validation error reported by the upload helper", async () => {
  mocks.upload.mockImplementationOnce(() => {
    void message.error({ content: "Can only use svg images as icons" });
    return {};
  });
  const { container } = render(<ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />);
  chooseFile(container);
  await waitFor(() => expect(message.error).toHaveBeenCalledExactlyOnceWith({ content: "Can only use svg images as icons" }));
  expect(message.success).not.toHaveBeenCalled();
  expect(mocks.create).not.toHaveBeenCalled();
  expect(container.querySelector(".ant-alert")).toBeNull();
});
it("locks upload controls and does not modify the model if edit permission is revoked during upload", async () => {
  let finish:
    ((result: { imageResult: object; opts: object }) => void) | undefined;
  mocks.upload.mockImplementationOnce(
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  const { container } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  chooseFile(container);
  await waitFor(() => expect(mocks.upload).toHaveBeenCalledOnce());
  expect(screen.getByRole("button", { name: "Upload icon" })).toBeDisabled();
  await setPermission("readable");
  await act(async () => {
    finish?.({ imageResult: {}, opts: {} });
  });
  expect(changed).not.toHaveBeenCalled();
  expect(mocks.uploaded).not.toHaveBeenCalled();
});
