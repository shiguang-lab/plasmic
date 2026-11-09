import { StudioArenaState } from "@/wab/client/studio-ctx/studio-arena-state";
import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import LeftProjectSettingsPanel from "@/wab/client/components/sidebar/LeftProjectSettingsPanel";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import type { GlobalContextMeta } from "@plasmicapp/host";
import { ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { createStudioUiEnvironmentFixture } from "@/wab/client/__testonly__/studio-ui-environment";
import { createHostlessPkgsStore } from "@/wab/client/studio-ctx/hostless-pkgs-state";
import { ChangeRecorder } from "@/wab/shared/core/observable-model";
import { instUtil } from "@/wab/shared/model/InstUtil";

const mocks = vi.hoisted(() => ({ studio: undefined as any, panel: undefined as any, list: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => mocks.studio }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSettingsPanel", () => ({ default: (props: any) => { mocks.panel = props; return props.content.props.children; } }));
vi.mock("@/wab/client/components/widgets/SimpleReorderableList", () => ({ SimpleReorderableList: (props: any) => { mocks.list = props; return null; } }));
const disposals: (() => void)[] = [];
afterEach(() => { cleanup(); disposals.splice(0).forEach((dispose) => dispose()); });

it("reorders filtered contexts by their actual tpl identity across an unresolved entry", () => {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const add = (name: string) => {
    const meta = { name, props: {}, importPath: "", __isContext: true } as unknown as GlobalContextMeta<any>;
    const component = mkCodeComponent(name, meta, {});
    mgr.attachComponent(component);
    return site.globalContexts[site.globalContexts.length - 1];
  };
  const first = add("MatchFirst"), hidden = add("Unrelated"), last = add("MatchLast");
  const unresolved = mkTplComponent(mkCodeComponent("Unresolved", { name: "Unresolved", props: {}, importPath: "", __isContext: true } as unknown as GlobalContextMeta<any>, {}), site.globalVariant);
  site.globalContexts.splice(1, 0, unresolved);
  const modelSnapshots = new ModelSnapshots(), arenaState = new StudioArenaState({site, modelSnapshots}), modelListeners = new Set<() => void>();
  const recorder = new ChangeRecorder({ inst: site, _instUtil: instUtil, isExternalRef: (inst) => inst === unresolved.component });
  const change = vi.fn((fn: () => void) => { modelSnapshots.sync(recorder.withRecording(fn).changes); });
  mocks.studio = { site, modelSnapshots, arenaState, subscribeModelChanges: (listener: () => void) => { modelListeners.add(listener); return () => {modelListeners.delete(listener);}; },
    ...createStudioUiEnvironmentFixture(), hostlessPkgsStore: createHostlessPkgsStore(), changeUnsafe: change };
  disposals.push(() => { arenaState.dispose(); modelSnapshots.dispose(); recorder.dispose(); });
  render(<LeftProjectSettingsPanel />);
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.tpl)).toEqual([first, hidden, last]);
  act(() => { mocks.panel.leftSearchPanel.searchboxProps.onChange({ target: { value: "Match" } }); });
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.tpl)).toEqual([first, last]);
  act(() => { mocks.list.onReordered(1, 0); });
  expect(change).toHaveBeenCalledTimes(1);
  expect(site.globalContexts).toEqual([last, first, unresolved, hidden]);
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.component)).toEqual([last.component, first.component]);
  const heldReorder = mocks.list.onReordered;
  const retiredOrder = site.globalContexts.slice();
  act(() => mocks.studio.arenaState.reset());
  act(() => heldReorder(0, 1));
  expect(site.globalContexts).toEqual(retiredOrder);
});
