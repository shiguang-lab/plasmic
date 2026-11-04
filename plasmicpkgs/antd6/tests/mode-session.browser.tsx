import React from "react";
import { createRoot } from "react-dom/client";
import { createSessionCanvas } from "./canvas-session";
import { AntdTabs, AntdTabItem, registerTabs } from "../src/registerTabs";
import { AntdModal, registerModal } from "../src/registerModal";
import { AntdDrawer, registerDrawer } from "../src/registerDrawer";
import { AntdCollapse, AntdCollapsePanel, registerCollapse } from "../src/registerCollapse";
import { AntdMenu, AntdMenuItem, AntdSubMenu, registerMenu } from "../src/registerMenu";
import { AntdDatePicker, registerDatePicker } from "../src/registerDatePicker";
import { AntdTable, AntdColumn, registerTable } from "../src/registerTable";

const Canvas = createSessionCanvas([registerTabs, registerModal, registerDrawer, registerCollapse, registerMenu, registerDatePicker, registerTable]);
const calls: string[] = [];
const changed = () => { calls.push("business event"); };
const selected = { __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "children" } };
const initial = Object.freeze({ activeKey: undefined, defaultActiveKey: "first", open: false });
(window as any).sessionCheck = { calls, initial };
function Field() { return <input aria-label="Session draft" defaultValue="" />; }

function App() {
  const [mode, setMode] = React.useState({ interactive: false, standalone: false });
  React.useEffect(() => {
    const handle = (event: MessageEvent) => {
      if (event.source === parent && event.data?.sessionMode) {setMode(event.data.sessionMode);}
    };
    window.addEventListener("message", handle);
    return () => window.removeEventListener("message", handle);
  }, []);
  const widget = new URLSearchParams(location.search).get("widget");
  let content: React.ReactElement;
  switch (widget) {
    case "modal":
      content = <AntdModal {...selected} open={initial.open} onOpenChange={changed} afterOpenChange={changed} modalScopeClassName="" wrapClassName=""><Field /></AntdModal>;
      break;
    case "drawer":
      content = <AntdDrawer {...selected} open={initial.open} onOpenChange={changed} afterOpenChange={changed}><Field /></AntdDrawer>;
      break;
    case "collapse":
      content = <AntdCollapse onChange={changed}><AntdCollapsePanel key="a" header="Alpha">First</AntdCollapsePanel><AntdCollapsePanel key="b" header="Beta" {...selected}><Field /></AntdCollapsePanel></AntdCollapse>;
      break;
    case "menu":
      content = <AntdMenu mode="inline" onOpenChange={changed}><AntdSubMenu key="a" title="Group"><AntdMenuItem key="b" {...selected}><Field /></AntdMenuItem></AntdSubMenu></AntdMenu>;
      break;
    case "table":
      content = <AntdTable data={{ data: [{ id: "a", title: "Alpha" }] }} rowKey="id" pagination={false}
        expandable={{ expandedRowKeys: [] }} expandedRowRender={() => <Field />} onExpandedRowsChange={changed}
        {...{ __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "expandedRowRender" } }}>
        <AntdColumn title="Title" dataIndex="title" />
      </AntdTable>;
      break;
    case "picker":
      content = <AntdDatePicker {...selected} open={false} onOpenChange={changed} onChange={changed} />;
      break;
    default:
      content = <AntdTabs {...{ defaultActiveKey: initial.defaultActiveKey, onChange: changed, items: <>
        <AntdTabItem key="first" label="First">First content</AntdTabItem>
        <AntdTabItem key="second" label="Second" {...selected}><Field /></AntdTabItem>
      </> } as any} />;
  }
  return <div data-mode={mode.interactive ? "interactive" : "editing"} style={{ padding: 24 }}>
    {mode.standalone ? content : <Canvas interactive={mode.interactive}>{content}</Canvas>}
  </div>;
}

createRoot(document.getElementById("root") as HTMLElement).render(<App />);
