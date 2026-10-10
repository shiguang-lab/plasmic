import { AppCtx } from "@/wab/client/app-ctx";
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
import { observable } from "mobx";
import { Result } from "neverthrow";
import React from "react";
const mocks = vi.hoisted(() => ({
  read: vi.fn(),
  upload: vi.fn(),
  create: vi.fn(),
  changed: vi.fn(),
  uploaded: vi.fn(),
}));
vi.mock("@/wab/client/dom-utils", () => ({
  readAndSanitizeFileAsImage: mocks.read,
  maybeUploadImage: mocks.upload,
}));
vi.mock("@/wab/client/i18n", () => ({
  useI18n: () => ({ t: (value: string) => value }),
}));
const state = observable({
  editable: true,
  permission: "writable" as UiAccess,
});
const siteOpsFixture: Pick<SiteOps, "createImageAsset"> = {
  createImageAsset: mocks.create,
};
const studioFixture: Pick<
  StudioCtx,
  "appCtx" | "canSave" | "getLeftTabPermission" | "change" | "siteOps"
> = {
  appCtx: {} as AppCtx,
  canSave: () => state.editable,
  getLeftTabPermission: () => state.permission,
  change: async <E, T>(fn: () => Result<T, E>) => {
    mocks.changed();
    return fn();
  },
  siteOps: () => siteOpsFixture as SiteOps,
};
const studioCtx = studioFixture as StudioCtx;
const file = new File(["fixture"], "Hero.png", { type: "image/png" });
function chooseFile(container: HTMLElement) {
  const input = container.querySelector('input[type="file"]');
  expect(input).not.toBeNull();
  if (!input) {
    throw new Error("Missing upload input");
  }
  fireEvent.change(input, { target: { files: [file] } });
}
beforeEach(() => {
  vi.clearAllMocks();
  state.editable = true;
  state.permission = "writable";
  mocks.read.mockResolvedValue({ image: "sanitized" });
  mocks.upload.mockResolvedValue({
    imageResult: { uri: "saved" },
    opts: { name: "Hero.png", type: ImageAssetType.Picture },
  });
});
afterEach(cleanup);
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
  await screen.findByText("Asset uploaded");
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
  await screen.findByText("Asset uploaded");
  expect(mocks.read).toHaveBeenCalledWith(studioCtx.appCtx, file);
  expect(mocks.upload).toHaveBeenCalledWith(
    studioCtx.appCtx,
    { image: "sanitized" },
    ImageAssetType.Picture,
    file,
  );
  expect(mocks.changed).toHaveBeenCalledOnce();
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
  await screen.findByText("Failed to upload asset");
  expect(mocks.create).not.toHaveBeenCalled();
  chooseFile(container);
  await screen.findByText("Asset uploaded");
  expect(mocks.create).toHaveBeenCalledOnce();
});
it("rejects invalid image data before upload and hides actions from read-only users", async () => {
  mocks.read.mockResolvedValueOnce(undefined);
  const { container, rerender } = render(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  chooseFile(container);
  await screen.findByText("Invalid image");
  expect(mocks.upload).not.toHaveBeenCalled();
  act(() => {
    state.editable = false;
  });
  rerender(
    <ResourceUpload studioCtx={studioCtx} onUploaded={mocks.uploaded} />,
  );
  expect(screen.queryByRole("button", { name: "Upload image" })).toBeNull();
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
  act(() => {
    state.permission = "readable";
  });
  await act(async () => {
    finish?.({ imageResult: {}, opts: {} });
  });
  expect(mocks.changed).not.toHaveBeenCalled();
  expect(mocks.uploaded).not.toHaveBeenCalled();
});
