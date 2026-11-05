import React from "react";
import { ConfigProvider } from "antd";
import { createRoot } from "react-dom/client";
import { createSessionCanvas } from "./canvas-session";
import { PlasmicCanvasContext } from "@plasmicapp/host";
import { applyCanvasSessionState, CanvasSessionState, canvasSessionInstanceKey } from "../../../platform/wab/src/wab/client/components/canvas/canvas-session-state";
import { AntdTabs, AntdTabItem, registerTabs } from "../src/registerTabs";
import { AntdModal, registerModal } from "../src/registerModal";
import { AntdDrawer, registerDrawer } from "../src/registerDrawer";
import { AntdCollapse, AntdCollapsePanel, registerCollapse } from "../src/registerCollapse";
import { AntdMenu, AntdMenuItem, AntdSubMenu, registerMenu } from "../src/registerMenu";
import { AntdDatePicker, registerDatePicker } from "../src/registerDatePicker";
import { AntdTable, AntdColumn, registerTable } from "../src/registerTable";
import { AntdTooltip, registerTooltip } from "../src/registerTooltip";
import { AntdPopover, registerPopover } from "../src/registerPopover";
import { AntdDropdown, registerDropdown } from "../src/registerDropdown";
import { AntdPopconfirm, registerAdditional } from "../src/registerAdditional";
import type { Registerable } from "../src/utils";

const Canvas = createSessionCanvas([registerTabs, registerModal, registerDrawer, registerCollapse, registerMenu, registerDatePicker, registerTable, registerTooltip]);
const calls: string[] = [];
const changed = () => { calls.push("business event"); };
const selected = { __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "children" } };
const initial = Object.freeze({ activeKey: undefined, defaultActiveKey: "first", open: false });
(window as any).sessionCheck = { calls, initial };
function Field() { return <input aria-label="Session draft" defaultValue="" />; }

const devices = ["Xiaomi Redmi Note 12", "Motorola Moto G54", "TECNO Spark 20", "Samsung Galaxy A54", "Xiaomi Redmi Note 12"].map((text, id) => ({ id, text }));
const overlayMetadata = new Map<any, any>();
for (const register of [registerTooltip, registerPopover, registerDropdown, registerAdditional]) {
  register({ registerComponent: (component, meta) => overlayMetadata.set(component, meta) } as Registerable);
}
const overlays = { tooltip: AntdTooltip, popover: AntdPopover, popconfirm: AntdPopconfirm, dropdown: AntdDropdown };
type OverlayKind = keyof typeof overlays;
function DeviceCell({ kind, click, text, index, session, interactive, standalone, implicitOpen, onChange }: {
  kind: OverlayKind; click: boolean; text: string; index: number; session: CanvasSessionState; interactive: boolean; standalone: boolean;
  implicitOpen: boolean; onChange: (open: boolean) => void;
}) {
  const instance = canvasSessionInstanceKey("table.column.overlay[0]", React.useId());
  const [, redraw] = React.useReducer((value) => value + 1, 0);
  const Component = overlays[kind] as React.ElementType;
  const meta = overlayMetadata.get(Component);
  const props: Record<string, any> = {
    onOpenChange: (open: boolean, info?: { source?: string }) => {
      onChange(open);
      calls.push(`open:${index}:${open}${info?.source ? ":" + info.source : ""}`);
    },
  };
  if (!standalone) {
    // Every row evaluates one Studio render slot. Its generated implicit value
    // is shared, while mounted instance state and authored props stay separate.
    const sourceProps = { ...props };
    props.__plasmic_selection_prop__ = { isSelected: index === 4, selectedSlotName: kind === "tooltip" ? "title" : kind === "popover" ? "content" : kind === "popconfirm" ? "description" : "menuItems" };
    const specs = Object.values<any>(meta.states ?? {}).filter((state) => state.type === "writable").map((state) => ({
      ...state,
      initialValueProp: state.initialValueProp ?? meta.props[state.valueProp]?.uncontrolledProp,
      controlled: false,
    }));
    if (specs.some((spec) => spec.valueProp === "open")) { props.open = implicitOpen; }
    if (!interactive) {
      session.resolve(instance, "open", undefined);
      props.previewOpen = session.reveal(instance, "open", index === 4);
    }
    props.__plasmic_selection_prop__.states = applyCanvasSessionState(session, instance, props,
      specs, interactive, redraw, !!meta.canvasOverlay, sourceProps);
  }
  const trigger = <span className="__wab_text" data-row={index}><span className="__wab_rich_text">{text}</span></span>;
  const content = <span data-popup-row={index}>{text}</span>;
  const businessProps = kind === "dropdown"
    ? { trigger: click ? "click" : "hover", menuItemsJson: [{ key: "details", label: content }], onAction: (key: string) => calls.push(`action:${index}:${key}`) }
    : kind === "popconfirm"
      ? { title: "Confirm device", description: content, okText: "Confirm", cancelText: "Cancel", onConfirm: () => calls.push(`confirm:${index}`), onCancel: () => calls.push(`cancel:${index}`) }
      : kind === "popover"
        ? { content, trigger: click ? "click" : "hover" }
        : { title: content };
  return <Component {...businessProps} {...props}>{trigger}</Component>;
}
function TableOverlays({ kind, click, interactive, standalone }: { kind: OverlayKind; click: boolean; interactive: boolean; standalone: boolean }) {
  const [session] = React.useState(() => new CanvasSessionState());
  const [implicitOpen, setImplicitOpen] = React.useState(false);
  const content = <ConfigProvider theme={{ token: { motion: false } }}>
    <button data-outside style={{ marginLeft: 480 }}>Outside table</button>
    <AntdTable data={{ data: devices }} rowKey="id" pagination={false} style={{ width: 124 }}>
      <AntdColumn title="Device" dataIndex="text" width={124} ellipsis={{ showTitle: false }} render={(text: string, _row: any, index: number) =>
        <DeviceCell kind={kind} click={click} text={text} index={index} session={session} interactive={interactive} standalone={standalone} implicitOpen={implicitOpen} onChange={setImplicitOpen} />} />
    </AntdTable>
  </ConfigProvider>;
  return standalone ? content : <PlasmicCanvasContext.Provider value={{ componentName: "table-test", globalVariants: {}, interactive }}>{content}</PlasmicCanvasContext.Provider>;
}

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
    case "table-tooltip":
    case "table-popover":
    case "table-popconfirm":
    case "table-dropdown":
    case "table-popover-click":
    case "table-dropdown-click":
      content = <TableOverlays kind={widget.split("-")[1] as OverlayKind} click={widget.endsWith("-click")} interactive={mode.interactive} standalone={mode.standalone} />;
      break;
    case "tooltip":
      content = <>{[0, 1].map((row) => <AntdTooltip key={row} title={`Full text ${row}`}
        onOpenChange={(open) => calls.push(`tooltip:${open}`)}
        afterOpenChange={(open) => calls.push(`after:${open}`)}
        __plasmic_selection_prop__={{ isSelected: true, selectedSlotName: "title" }}>
        {row === 0 ? <input aria-label="Session draft" defaultValue="" /> : <button>Second tooltip</button>}
      </AntdTooltip>)}</>;
      break;
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
