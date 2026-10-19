import * as React from "react";
import { act, cleanup, render } from "@testing-library/react";
import LeftProjectSettingsPanel from "@/wab/client/components/sidebar/LeftProjectSettingsPanel";
import { TplMgr } from "@/wab/shared/TplMgr";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { createSite } from "@/wab/shared/core/sites";
import { mkTplComponent } from "@/wab/shared/core/tpls";
import type { GlobalContextMeta } from "@plasmicapp/host";
import { observable, runInAction } from "mobx";

const mocks = vi.hoisted(() => ({ studio: undefined as any, panel: undefined as any, list: undefined as any }));
vi.mock("@/wab/client/contexts/StudioContexts", () => ({ useStudioCtx: () => mocks.studio }));
vi.mock("@/wab/client/plasmic/plasmic_kit_left_pane/PlasmicLeftSettingsPanel", () => ({ default: (props: any) => { mocks.panel = props; return props.content.props.children; } }));
vi.mock("@/wab/client/components/widgets/SimpleReorderableList", () => ({ SimpleReorderableList: (props: any) => { mocks.list = props; return null; } }));
afterEach(cleanup);

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
  site.globalContexts = observable.array(site.globalContexts, { deep: false });
  const change = vi.fn((fn: () => void) => runInAction(fn));
  mocks.studio = { site, getLeftTabPermission: () => "editable", changeUnsafe: change };
  render(<LeftProjectSettingsPanel />);
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.tpl)).toEqual([first, hidden, last]);
  act(() => mocks.panel.leftSearchPanel.searchboxProps.onChange({ target: { value: "Match" } }));
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.tpl)).toEqual([first, last]);
  act(() => mocks.list.onReordered(1, 0));
  expect(change).toHaveBeenCalledTimes(1);
  expect(site.globalContexts).toEqual([last, first, unresolved, hidden]);
  expect(mocks.list.children.map((child: React.ReactElement<any>) => child.props.context.component)).toEqual([last.component, first.component]);
});
