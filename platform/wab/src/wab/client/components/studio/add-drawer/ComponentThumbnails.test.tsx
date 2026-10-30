import {
  createAddTplCodeComponent,
  createAddTplCodeComponents,
} from "@/wab/client/components/studio/add-drawer/AddDrawer";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";

const savedThumbnail = "data:image/svg+xml,%3Csvg%20id%3D%22saved%22/%3E";
const registeredThumbnail = "data:image/svg+xml,%3Csvg%20id%3D%22registered%22/%3E";
const component = (name: string, thumbnailUrl?: string) =>
  mkCodeComponent(name, {
    name, importPath: "test-library", props: {}, thumbnailUrl,
  }, {});

it("shows the current registered thumbnail for an installed component without rewriting the saved model", () => {
  const button = component("button", savedThumbnail);
  const studioCtx = {
    getCodeComponentMeta: () => ({ thumbnailUrl: registeredThumbnail }),
  } as unknown as StudioCtx;
  const item = createAddTplCodeComponent(studioCtx, button);
  expect(item.previewImageUrl).toBe(registeredThumbnail);
  expect(item.isCompact).toBe(true);
  expect(button.codeComponentMeta.thumbnailUrl).toBe(savedThumbnail);
});

it("uses the saved thumbnail when a registration is not loaded", () => {
  const studioCtx = { getCodeComponentMeta: () => undefined } as unknown as StudioCtx;
  expect(createAddTplCodeComponent(studioCtx, component("button", savedThumbnail))
    .previewImageUrl).toBe(savedThumbnail);
});

it("uses compact direct previews for registered icons without retaining an obsolete saved thumbnail", () => {
  const icon = mkCodeComponent("plasmic-antd-icon-PlusOutlined", {
    name: "plasmic-antd-icon-PlusOutlined", importPath: "@ant-design/icons", props: {}, thumbnailUrl: savedThumbnail,
  }, {});
  const studioCtx = { getCodeComponentMeta: () => ({ props: {} }) } as unknown as StudioCtx;
  const item = createAddTplCodeComponent(studioCtx, icon);
  expect(item.previewImageUrl).toBeUndefined();
  expect(item.isCompact).toBe(true);
  expect(icon.codeComponentMeta.thumbnailUrl).toBe(savedThumbnail);
});

it("deduplicates components and uses image cards only when their own thumbnail is available", () => {
  const button = component("button");
  const custom = component("custom");
  const studioCtx = {
    getCodeComponentMeta: (comp) => comp === button
      ? { thumbnailUrl: registeredThumbnail } : undefined,
  } as unknown as StudioCtx;
  const items = createAddTplCodeComponents(studioCtx, [button, custom, button]);
  expect(items).toHaveLength(2);
  expect(items.find((item) => item.systemName === "button")?.isCompact).toBe(true);
  expect(items.find((item) => item.systemName === "custom")?.isCompact).toBe(false);
});
