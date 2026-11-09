import "@testing-library/jest-dom/vitest";
import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import type ListItem from "@/wab/client/components/ListItem";
import { AnimationSequenceRow } from "@/wab/client/components/sidebar/AnimationSequenceControls";
import { ImageAssetControl, ImageAssetSidebarPopup } from "@/wab/client/components/sidebar/image-asset-controls";
import MultiAssetsActions from "@/wab/client/components/sidebar/MultiAssetsActions";
import type { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import type { DraggableInsertable } from "@/wab/client/components/studio/add-drawer/DraggableInsertable";
import { Matcher } from "@/wab/client/components/view-common";
import { AppCtxContext } from "@/wab/client/contexts/AppContexts";
import { ensure } from "@/wab/shared/common";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { createSite } from "@/wab/shared/core/sites";
import { AnimationSequence, ImageAsset } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import React from "react";

const painted = vi.hoisted(() => vi.fn());
vi.mock("@/wab/client/components/ListItem", () => ({
  default: ({children, icon, rightContent, onClick, menu}: React.ComponentProps<typeof ListItem>) => {
    painted();
    return <section data-native-leaf>{icon}<button onClick={onClick}>Open {children}</button><output>{rightContent}</output>{typeof menu === "function" ? menu() : menu}</section>;
  },
}));
vi.mock("@/wab/client/components/studio/add-drawer/DraggableInsertable", () => ({
  DraggableInsertable: ({children, spec}: React.ComponentProps<typeof DraggableInsertable>) => <div data-insert-key={spec.key} data-insert-label={spec.label}>{children}</div>,
}));
vi.mock("@/wab/client/components/sidebar/SidebarModal", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/sidebar/SidebarModal")>()),
  SidebarModal: ({title,children,onClose}: React.ComponentProps<typeof SidebarModal>) => <section aria-label="Asset editor">{title}{children}<button onClick={onClose}>Close editor</button></section>,
}));
// The popup uses the real focus-on-displayed hook; jsdom has no layout observer.
beforeAll(() => vi.stubGlobal("IntersectionObserver", class {
  observe = vi.fn(); unobserve = vi.fn(); disconnect = vi.fn();
}));
afterAll(() => vi.unstubAllGlobals());
const studios = new Set<StudioCtx>();
afterEach(async () => {
  cleanup();
  for (const studio of studios) { await studio.awaitEval(); studio.dispose(); }
  studios.clear(); vi.restoreAllMocks(); painted.mockClear();
});
async function setup() {
  const site = createSite();
  const mgr = new TplMgr({site});
  const asset = mgr.addImageAsset({name:"Hero",type:ImageAssetType.Picture,dataUri:"/hero.png",width:640,height:480});
  const replacement = mgr.addImageAsset({name:"Replacement",type:ImageAssetType.Picture,dataUri:"/replacement.png",width:200,height:100});
  const sequence = mgr.addAnimationSequence("Entrance");
  const fixture = fakeStudioCtx({site,devFlagOverrides:{ccStubs:true}});
  const studio = fixture.studioCtx;
  studios.add(studio);
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  return {studio,asset,replacement,sequence};
}

it("updates the native image row fields, keeps bulk commands and detaches a replaced model", async () => {
  const {studio,asset,replacement,sequence} = await setup();
  const clicked=vi.fn(),references=vi.fn();
  const contents=(current=asset) => <StudioCtxContext.Provider value={studio}><MultiAssetsActions type="asset" selectableAssets={studio.site.imageAssets.map(model => model.uuid)} onDelete={async () => false}><ImageAssetControl studioCtx={studio} asset={current} matcher={new Matcher("")} editable onFindReferences={references} onClick={clicked} /></MultiAssetsActions></StudioCtxContext.Provider>;
  const view=render(contents());
  expect(screen.getByText("640 × 480")).toBeTruthy();
  painted.mockClear();
  await act(async () => { await studio.changeUnsafe(() => { sequence.name="Unrelated animation"; }); });
  expect(painted).not.toHaveBeenCalled();
  await act(async () => { await studio.changeUnsafe(() => { asset.name="Updated hero";asset.width=101.4;asset.height=80.2;asset.dataUri="/updated.png"; }); });
  expect(screen.getByRole("button",{name:"Open Updated hero"})).toBeTruthy();
  expect(screen.getByText("101 × 80")).toBeTruthy();
  expect(ensure(view.container.querySelector<HTMLElement>(".image-preview .img-thumb"), "Updated image preview")).toHaveStyle({ backgroundImage: 'url("/updated.png")' });
  const updatedAsset=new ImageAsset({uuid:"updated-asset",type:ImageAssetType.Picture,name:asset.name,dataUri:asset.dataUri,width:asset.width,height:asset.height,aspectRatio:asset.aspectRatio});
  await act(async () => {await studio.changeUnsafe(() => {studio.site.imageAssets.splice(studio.site.imageAssets.indexOf(asset),1,updatedAsset);});});
  view.rerender(contents(updatedAsset));
  expect(ensure(view.container.querySelector("[data-insert-key]"), "Native insert wrapper").getAttribute("data-insert-key")).toBe("updated-asset");
  expect(ensure(view.container.querySelector("[data-insert-label]"), "Native insert wrapper").getAttribute("data-insert-label")).toBe("Updated hero");
  fireEvent.click(screen.getByRole("button",{name:"Open Updated hero"}));
  expect(clicked).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Find all references"}));
  expect(references).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Start bulk selection"}));
  expect(within(ensure(view.container.querySelector<HTMLElement>("[data-native-leaf]"),"Image row")).getByRole("checkbox")).toHaveProperty("checked", true);
  fireEvent.click(screen.getByRole("button",{name:"Open Updated hero"}));
  expect(within(ensure(view.container.querySelector<HTMLElement>("[data-native-leaf]"),"Image row")).getByRole("checkbox")).toHaveProperty("checked", false);
  expect(clicked).toHaveBeenCalledOnce();
  const iconAsset=new ImageAsset({uuid:"updated-icon",type:ImageAssetType.Icon,name:updatedAsset.name,dataUri:"/updated.svg",width:updatedAsset.width,height:updatedAsset.height,aspectRatio:updatedAsset.aspectRatio});
  await act(async () => {await studio.changeUnsafe(() => {studio.site.imageAssets.splice(studio.site.imageAssets.indexOf(updatedAsset),1,iconAsset);});});
  view.rerender(contents(iconAsset));
  expect(screen.queryByText("101 × 80")).toBeNull();
  view.rerender(contents(replacement)); painted.mockClear();
  await act(async () => { await studio.changeUnsafe(() => { iconAsset.name="Old image changed"; }); });
  expect(painted).not.toHaveBeenCalled();
  expect(screen.getByRole("button",{name:"Open Replacement"})).toBeTruthy();
  await act(async () => { await studio.changeUnsafe(() => { replacement.name="Current image changed"; }); });
  expect(screen.getByRole("button",{name:"Open Current image changed"})).toBeTruthy();
  view.unmount();
});

it("updates popup name, preview and upload type through real transactions and retains rename/close commands", async () => {
  const {studio,asset} = await setup();
  const closed=vi.fn();
  const contents=(current=asset) => <AppCtxContext.Provider value={studio.appCtx}><StudioCtxContext.Provider value={studio}><ImageAssetSidebarPopup studioCtx={studio} asset={current} editable onClose={closed} /></StudioCtxContext.Provider></AppCtxContext.Provider>;
  const view=render(contents());
  expect(screen.getByDisplayValue("Hero")).toBeTruthy();
  expect(ensure(view.container.querySelector('input[type="file"]'), "Actual upload input").getAttribute("accept")).toBe(".gif,.jpg,.jpeg,.png,.avif,.tif,.svg,.webp,.ico");
  await act(async () => { await studio.changeUnsafe(() => { asset.name="Icon name";asset.dataUri="/icon.svg"; }); });
  expect(screen.getByDisplayValue("Icon name")).toBeTruthy();
  expect(ensure(view.container.querySelector<HTMLElement>(".image-preview .img-thumb"), "Updated icon preview")).toHaveStyle({ backgroundImage: 'url("/icon.svg")' });
  const iconAsset=new ImageAsset({uuid:"popup-icon",type:ImageAssetType.Icon,name:asset.name,dataUri:asset.dataUri,width:asset.width,height:asset.height,aspectRatio:asset.aspectRatio});
  await act(async () => {await studio.changeUnsafe(() => {studio.site.imageAssets.splice(studio.site.imageAssets.indexOf(asset),1,iconAsset);});});
  view.rerender(contents(iconAsset));
  expect(ensure(view.container.querySelector('input[type="file"]'), "Actual upload input").getAttribute("accept")).toBe(".svg");
  const input=screen.getByDisplayValue("Icon name");
  fireEvent.change(input,{target:{value:"Renamed icon"}});fireEvent.blur(input);
  await waitFor(() => expect(iconAsset.name).toBe("Renamed icon"));
  await act(async () => { await studio.changeUnsafe(() => { iconAsset.dataUri=null; }); });
  expect(view.container.querySelector(".image-preview")).toBeNull();
  fireEvent.click(screen.getByRole("button",{name:"Close editor"}));expect(closed).toHaveBeenCalledOnce();
});

it("updates animation name and UI action identity without observing the whole sequence and preserves row commands", async () => {
  const {studio,sequence,asset} = await setup();
  const clicked=vi.fn(),edited=vi.fn(),references=vi.fn(),duplicate=vi.fn(),removed=vi.fn();
  const handler=vi.spyOn(studio.uiActionBus,"registerHandler");
  const contents=(current=sequence) => <StudioCtxContext.Provider value={studio}><AnimationSequenceRow studioCtx={studio} sequence={current} matcher={new Matcher("")} onClick={clicked} onEdit={edited} onFindReferences={references} onDuplicate={duplicate} onDelete={removed} /></StudioCtxContext.Provider>;
  const view=render(contents());
  expect(screen.getByRole("button",{name:"Open Entrance"})).toBeTruthy();
  painted.mockClear();
  await act(async () => { await studio.changeUnsafe(() => { asset.width=900; }); });
  expect(painted).not.toHaveBeenCalled();
  await act(async () => { await studio.changeUnsafe(() => { sequence.name="Updated entrance"; }); });
  expect(screen.getByRole("button",{name:"Open Updated entrance"})).toBeTruthy();
  const updatedSequence=new AnimationSequence({uuid:"updated-sequence",name:sequence.name,keyframes:sequence.keyframes});
  await act(async () => {await studio.changeUnsafe(() => {studio.site.animationSequences.splice(studio.site.animationSequences.indexOf(sequence),1,updatedSequence);});});
  view.rerender(contents(updatedSequence));
  expect(handler).toHaveBeenLastCalledWith("Model:AnimationSequence:updated-sequence",expect.any(Function));
  fireEvent.click(screen.getByRole("button",{name:"Open Updated entrance"}));
  expect(clicked).toHaveBeenCalledOnce();expect(edited).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Find all references"}));expect(references).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Duplicate"}));expect(duplicate).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("menuitem",{name:"Delete"}));expect(removed).toHaveBeenCalledOnce();
  view.unmount();
});
