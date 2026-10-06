import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdCollapse, AntdCollapsePanel } from "../src/registerCollapse";
import { AntdMenu, AntdMenuItem, AntdSubMenu } from "../src/registerMenu";
import { AntdList, AntdListItem, registerAdditional } from "../src/registerAdditional";
import type { Registerable } from "../src/utils";
const selected = { __plasmic_selection_prop__: { isSelected: true } };
const Canvas = ({ interactive = false, children }: { interactive?: boolean; children: React.ReactNode }) => <PlasmicCanvasContext.Provider value={{ componentName: "test", globalVariants: {}, interactive }}>{children}</PlasmicCanvasContext.Provider>;
test("selected Collapse content reveals through SDK slot wrappers without changing runtime keys or firing events", () => {
 const onChange = vi.fn();
 const props = { defaultActiveKey: [], accordion: true, onChange };
 const Wrapper = ({children}: any) => children();
 const panels = <Wrapper>{() => <AntdCollapsePanel key="closed" header="Closed" {...selected}><button>Panel action</button></AntdCollapsePanel>}</Wrapper>;
 const view = render(<Canvas><AntdCollapse {...props}>{panels}</AntdCollapse></Canvas>);
 expect(screen.getByRole("button", {name:"Panel action"})).toBeTruthy();
 expect(onChange).not.toHaveBeenCalled();
 expect(props.defaultActiveKey).toEqual([]);
 view.rerender(<Canvas interactive><AntdCollapse {...props}>{panels}</AntdCollapse></Canvas>);
 expect(screen.queryByRole("button", {name:"Panel action"})).toBeNull();
});
test("nested Menu selection reveals every ancestor and resets for preview", () => {
 const onOpenChange = vi.fn();
 const children = <AntdSubMenu key="outer" title="Outer"><AntdSubMenu key="inner" title="Inner"><AntdMenuItem key="leaf" {...selected}>Leaf</AntdMenuItem></AntdSubMenu></AntdSubMenu>;
 const view = render(<Canvas><AntdMenu mode="inline" defaultOpenKeys={[]} onOpenChange={onOpenChange}>{children}</AntdMenu></Canvas>);
 expect(screen.getByText("Leaf")).toBeTruthy();
 expect(onOpenChange).not.toHaveBeenCalled();
 view.rerender(<Canvas interactive><AntdMenu mode="inline" defaultOpenKeys={[]} onOpenChange={onOpenChange}>{children}</AntdMenu></Canvas>);
 expect(screen.queryByText("Leaf")).toBeNull();
});
test("List row templates receive the real record and index, and retain interactive content", () => {
 const data = [{id:1,title:"Business row",status:"Done"}];
 const action = vi.fn();
 render(<AntdList dataSource={data} renderItem={(item: any,index) => <AntdListItem><span>{item.title} {index} {item.status}</span><button onClick={() => action(item)}>Action</button></AntdListItem>} />);
 expect(screen.getByText("Business row 0 Done")).toBeTruthy();
 expect(screen.queryByText("[object Object]")).toBeNull();
 fireEvent.click(screen.getByRole("button",{name:"Action"}));
 expect(action).toHaveBeenCalledWith(data[0]);
});
test("List registration exposes the native renderItem Slot and does not inject example data", () => {
 const metas = new Map<string,any>(); registerAdditional({registerComponent:(_c,m)=>metas.set(m.name,m)} as Registerable);
 const meta = metas.get("plasmic-antd6-list");
 expect(meta.props.renderItem.renderPropParams).toEqual(["item","index"]);
 expect(meta.props.dataSource.defaultValue).toBeUndefined();
 render(<AntdList><AntdListItem>Static content</AntdListItem></AntdList>);
 expect(screen.getByText("Static content")).toBeTruthy();
 expect(screen.queryByText("First item")).toBeNull();
});
test("Collapse default panel Slots use editable text schemas that the hostless publisher can materialize", async () => {
 const { registerCollapse } = await import("../src/registerCollapse");
 const metas = new Map<string,any>(); registerCollapse({registerComponent:(_c,m)=>metas.set(m.name,m)} as Registerable);
 for(const panel of metas.get("plasmic-antd6-collapse").props.children.defaultValue) {
  expect(panel.props.header).toEqual([{type:"text",value:`Panel ${panel.props.key}`}]);
  expect(panel.props.children).toEqual([{type:"text",value:`Panel ${panel.props.key} content`}]);
 }
});
