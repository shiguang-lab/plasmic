import { fakeStudioCtx } from "@/wab/client/__testonly__/fake-init-ctx";
import { AnimationSequenceEditModal } from "@/wab/client/components/sidebar/AnimationSequenceControls";
import type { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import type { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { StyleComponentContext } from "@/wab/client/components/style-controls/StyleComponent";
import type { KeyFrameStops } from "@/wab/client/components/style-controls/KeyFrameStops";
import type { DimTokenSpinner } from "@/wab/client/components/widgets/DimTokenSelector";
import { StudioCtxContext } from "@/wab/client/contexts/StudioContexts";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { createSite } from "@/wab/shared/core/sites";
import { mkRuleSet } from "@/wab/shared/core/styles";
import { KeyFrame } from "@/wab/shared/model/classes";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import "@testing-library/jest-dom/vitest";
import React from "react";

vi.mock("@/wab/client/components/sidebar/SidebarModal", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/sidebar/SidebarModal")>()),
  SidebarModal: ({title,children,onClose}: React.ComponentProps<typeof SidebarModal>) => <section>{title}{children}<button onClick={onClose}>Close editor</button></section>,
}));
vi.mock("@/wab/client/components/sidebar/SidebarSection", async (original) => ({
  ...(await original<typeof import("@/wab/client/components/sidebar/SidebarSection")>()),
  SidebarSection: ({title,children}: React.ComponentProps<typeof SidebarSection>) => {
    const component=React.useContext(StyleComponentContext);
    // The style editor keeps its own graph. Observe only which opaque RuleSet
    // the existing StyleComponent provider supplies to this presentation boundary.
    if (typeof children === "function") {
      const rs=ensure(component,"Style provider").props.expsProvider.targetRs();
      return <output aria-label="Keyframe style owner">{rs.uid}</output>;
    }
    return <section>{title}{children}</section>;
  },
}));
vi.mock("@/wab/client/components/widgets/DimTokenSelector", () => {
  function Spinner({value,onChange}: React.ComponentProps<typeof DimTokenSpinner>) {
    return <input aria-label="Keyframe percentage" value={String(value)} onChange={event => onChange(event.target.value,"raw")} />;
  }
  return {default:Spinner,DimTokenSpinner:Spinner};
});
vi.mock("@/wab/client/components/style-controls/KeyFrameStops", () => ({
  KeyFrameStops: ({sequence,onSelectKeyframe,onDeleteKeyframe}: React.ComponentProps<typeof KeyFrameStops>) => <div>{sequence.keyframes.map(keyframe => <React.Fragment key={keyframe.uid}><button onClick={() => onSelectKeyframe(keyframe)}>Select keyframe {keyframe.uid}</button>{sequence.keyframes.length>1 && <button onClick={() => onDeleteKeyframe?.(keyframe)}>Delete keyframe {keyframe.uid}</button>}</React.Fragment>)}</div>,
}));
beforeAll(() => vi.stubGlobal("IntersectionObserver",class {observe=vi.fn();unobserve=vi.fn();disconnect=vi.fn();}));
afterAll(() => vi.unstubAllGlobals());
let studio: StudioCtx;
afterEach(async () => { cleanup();await studio.awaitEval();studio.dispose();vi.restoreAllMocks(); });

it("keeps default creation, external field updates, keyframe selection, percentage ordering and deletion on the actual model", async () => {
  const site=createSite();const mgr=new TplMgr({site});const sequence=mgr.addAnimationSequence("Entrance");
  ({studioCtx:studio}=fakeStudioCtx({site,devFlagOverrides:{ccStubs:true}}));
  await waitFor(() => expect(studio.initialRouteReady).toBe(true));
  const closed=vi.fn();
  render(<StudioCtxContext.Provider value={studio}><AnimationSequenceEditModal studioCtx={studio} sequence={sequence} show onClose={closed} /></StudioCtxContext.Provider>);
  await waitFor(() => expect(sequence.keyframes).toHaveLength(1));
  const first=ensure(sequence.keyframes[0],"Default keyframe");
  expect(first.percentage).toBe(0);expect(screen.getByLabelText("Keyframe percentage")).toHaveValue("0%");
  expect(screen.getByLabelText("Keyframe style owner")).toHaveTextContent(String(first.rs.uid));
  await act(async () => {await studio.changeUnsafe(() => {sequence.name="Updated entrance";first.percentage=25;});});
  expect(screen.getByDisplayValue("Updated entrance")).toBeTruthy();
  expect(screen.getByLabelText("Keyframe percentage")).toHaveValue("25%");
  const replacedRs=mkRuleSet({values:{opacity:"0.5"}});
  await act(async () => {await studio.changeUnsafe(() => {first.rs=replacedRs;});});
  expect(screen.getByLabelText("Keyframe style owner")).toHaveTextContent(String(replacedRs.uid));
  const second=new KeyFrame({percentage:50,rs:mkRuleSet({})});
  await act(async () => {await studio.changeUnsafe(() => {sequence.keyframes.push(second);});});
  fireEvent.click(screen.getByRole("button",{name:`Select keyframe ${second.uid}`}));
  expect(screen.getByLabelText("Keyframe percentage")).toHaveValue("50%");
  fireEvent.change(screen.getByLabelText("Keyframe percentage"),{target:{value:"10%"}});
  await waitFor(() => expect(second.percentage).toBe(10));
  expect(sequence.keyframes).toEqual([second,first]);
  fireEvent.click(screen.getByRole("button",{name:`Delete keyframe ${second.uid}`}));
  await waitFor(() => expect(sequence.keyframes).toEqual([first]));
  expect(screen.getByLabelText("Keyframe percentage")).toHaveValue("25%");
  await act(async () => {await studio.changeUnsafe(() => {sequence.keyframes=[];});});
  await waitFor(() => expect(sequence.keyframes).toHaveLength(1));
  expect(sequence.keyframes[0]).not.toBe(first);
  expect(screen.getByLabelText("Keyframe percentage")).toHaveValue("0%");
  fireEvent.click(screen.getByRole("button",{name:"Close editor"}));expect(closed).toHaveBeenCalledOnce();
});
