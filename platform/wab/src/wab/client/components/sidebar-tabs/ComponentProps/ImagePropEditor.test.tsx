import { ImagePropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/ImagePropEditor";
import type { ImageAssetOrUrlPicker, ImagePreview, ImgInfo } from "@/wab/client/components/style-controls/ImageSelector";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { createSite } from "@/wab/shared/core/sites";
import { instUtil } from "@/wab/shared/model/InstUtil";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { mock } from "vitest-mock-extended";

const infoRender = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/style-controls/ImageSelector", () => ({
  ImgInfo: (props: React.ComponentProps<typeof ImgInfo>) => {
    infoRender();
    return <div>{props.filename}{props.imagePreview}<output aria-label="Image URI">{props.url}</output></div>;
  },
  ImagePreview: (props: React.ComponentProps<typeof ImagePreview>) => <output aria-label="Preview URI">{props.uri}</output>,
  ImageAssetOrUrlPicker: (props: React.ComponentProps<typeof ImageAssetOrUrlPicker>) => <button onClick={() => props.onPicked(props.value)}>Pick current</button>,
}));
vi.mock("@/wab/client/components/sidebar/SidebarModal", () => ({ SidebarModal: ({ children }: React.PropsWithChildren) => children }));
vi.mock("antd", () => ({ Tooltip: ({ children, title }: React.PropsWithChildren<{ title: string }>) => <span aria-label={title}>{children}</span> }));

afterEach(() => { cleanup(); infoRender.mockClear(); });

function fixture() {
  const site = createSite();
  const asset = mkImageAsset({ name: "Before", type: ImageAssetType.Picture, dataUri: "before.png" });
  const other = mkImageAsset({ name: "Other", type: ImageAssetType.Picture, dataUri: "other.png" });
  site.imageAssets.push(asset, other);
  const models = new ModelSnapshots();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil });
  const studio = mock<StudioCtx>();
  Object.defineProperties(studio, { site: { value: site }, modelSnapshots: { value: models } });
  const commit = (fn: () => void) => act(() => { models.sync(recorder.withRecording(fn).changes); });
  return { site, asset, other, models, recorder, studio, commit, dispose: () => { recorder.dispose(); models.dispose(); } };
}

it("publishes only the demanded image fields and actual local membership", () => {
  const f = fixture();
  const view = render(<ImagePropEditor attr="Image" studioCtx={f.studio} value={f.asset} type={ImageAssetType.Picture} onPicked={vi.fn()} readOnly />);
  try {
    expect(screen.getByText("Before")).toBeTruthy();
    expect(screen.getByLabelText("Image URI").textContent).toBe("before.png");
    expect(screen.getByLabelText("Replace image...")).toBeTruthy();
    const renders = infoRender.mock.calls.length;
    f.commit(() => { f.other.name = "Unrelated"; f.asset.width = 400; f.site.imageAssets.push(mkImageAsset({ name: "Third", type: ImageAssetType.Picture })); });
    expect(infoRender).toHaveBeenCalledTimes(renders);
    f.commit(() => { f.asset.name = "After"; f.asset.dataUri = "after.png"; });
    expect(screen.getByText("After")).toBeTruthy();
    expect(screen.getByLabelText("Image URI").textContent).toBe("after.png");
    expect(screen.getByLabelText("Preview URI").textContent).toBe("after.png");
    f.commit(() => { f.site.imageAssets.splice(f.site.imageAssets.indexOf(f.asset), 1); });
    expect(screen.queryByLabelText("Replace image...")).toBeNull();
    f.commit(() => { f.site.imageAssets.push(f.asset); });
    expect(screen.getByLabelText("Replace image...")).toBeTruthy();
  } finally { view.unmount(); f.dispose(); }
});

it("changes between absent, URL and asset inputs and preserves the picker command identity", () => {
  const f = fixture();
  const onPicked = vi.fn();
  const props = { attr: "Image", studioCtx: f.studio, type: ImageAssetType.Picture, onPicked };
  const view = render(<ImagePropEditor {...props} />);
  try {
    expect(screen.getByLabelText("Image URI").textContent).toBe("");
    view.rerender(<ImagePropEditor {...props} value="url.png" />);
    expect(screen.getByLabelText("Image URI").textContent).toBe("url.png");
    view.rerender(<ImagePropEditor {...props} value={f.asset} />);
    fireEvent.click(screen.getByText("Before"));
    fireEvent.click(screen.getByText("Pick current"));
    expect(onPicked).toHaveBeenLastCalledWith(f.asset);
    view.rerender(<ImagePropEditor {...props} />);
    const renders = infoRender.mock.calls.length;
    f.commit(() => { f.asset.name = "Detached"; f.asset.dataUri = "detached.png"; });
    expect(infoRender).toHaveBeenCalledTimes(renders);
    expect(screen.getByLabelText("Image URI").textContent).toBe("");
  } finally { view.unmount(); f.dispose(); }
});
