import { PlasmicCanvasContext } from "@plasmicapp/host";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { afterEach, beforeAll, beforeEach, expect, test, vi } from "vitest";
import { registerAll } from "../src";
import {
  ResourceAuthorization,
  ResourceAuthorizationRecord,
  resourceAuthorizationMeta,
  resourceAuthorizationRecordMeta,
} from "../src/registerResourceAuthorization";
import { NativeAuthorizationExample } from "./fixtures/native-resource-authorization";

const resource = {
  resourceTypeCode: "GROUP",
  resourceId: "group-1",
  resourceName: "测试客群",
};
const apiSources = {
  dataPolicy: "/test/policies",
  dataResourceTypeList: "/test/types",
  userOptions: "/test/users",
  deptTree: "/test/depts",
};
const get = vi.fn(async (url: string) => {
  const data = url === apiSources.dataResourceTypeList
    ? [{ typeCode: "GROUP", typeName: "客群" }]
    : url === `${apiSources.dataPolicy}/actions`
      ? [{ code: "READ", name: "查看" }]
      : url === apiSources.userOptions
        ? [{ userId: "user-1", nickname: "测试用户" }]
        : url === apiSources.deptTree
          ? [{ code: "dept-1", name: "测试组织" }]
          : url.endsWith("resource-permissions")
            ? {
                ...resource,
                permissions: [{
                  actionCode: "READ",
                  actionName: "查看",
                  allowBindings: [{ id: 1, bindType: "USER", bindId: "user-1", bindName: "测试用户", policyCode: "personal", policyName: "个人策略" }],
                  denyBindings: [],
                }],
              }
            : { policyCode: "personal", policyCategory: "PERSONALIZED" };
  return { data: { code: 0, data } };
});
const post = vi.fn(async () => ({ data: { code: 0 } }));
const deletePolicy = vi.fn(async () => ({ data: { code: 0 } }));
const drawers = [
  { name: "ResourceAuthorization", Component: ResourceAuthorization },
  { name: "ResourceAuthorization.Record", Component: ResourceAuthorizationRecord },
];

function Environment({ children, editing = false, interactive = false }: {
  children: React.ReactNode;
  editing?: boolean;
  interactive?: boolean;
}) {
  return (
    <PlasmicCanvasContext.Provider value={editing ? {
      componentName: "Authorization test", globalVariants: {}, interactive,
    } : false}>
      <ConfigProvider theme={{ token: { motion: false } }}>{children}</ConfigProvider>
    </PlasmicCanvasContext.Provider>
  );
}

beforeAll(() => {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: false, media: query, onchange: null,
    addListener: vi.fn(), removeListener: vi.fn(),
    addEventListener: vi.fn(), removeEventListener: vi.fn(), dispatchEvent: vi.fn(),
  }));
  vi.stubGlobal("ResizeObserver", class {
    observe() {} unobserve() {} disconnect() {}
  });
});
beforeEach(() => {
  vi.clearAllMocks();
  Object.assign(window, { $$request: { get, post, delete: deletePolicy } });
});
afterEach(() => {
  cleanup();
  delete (window as any).$$request;
});

test("registerAll exposes both real drawer contracts with independent runtime open state", () => {
  const registrations: any[] = [];
  registerAll({ registerComponent(component, meta) { registrations.push({ component, meta }); } });
  expect(registrations.map(({ meta }) => meta.name)).toEqual([
    "plasmic-react-ui-action-group",
    "plasmic-react-ui-resource-authorization",
    "plasmic-react-ui-resource-authorization-record",
  ]);
  expect(registrations[1].component).toBe(ResourceAuthorization);
  expect(registrations[2].component).toBe(ResourceAuthorizationRecord);
  for (const meta of [resourceAuthorizationMeta, resourceAuthorizationRecordMeta]) {
    expect(meta.canvasOverlay).toEqual({ triggerSlot: "trigger" });
    expect(meta.props.trigger).toMatchObject({ type: "slot", hidePlaceholder: true });
    expect((meta.props.previewOpen as any).editOnly).toBe(true);
    expect(meta.states?.open).toMatchObject({ valueProp: "open", onChangeProp: "onOpenChange" });
    expect((meta.props.onClose as any).argTypes).toEqual([]);
    expect((meta.props.onSuccess as any).argTypes).toEqual([]);
    expect(meta.props).not.toHaveProperty("children");
  }
  expect(resourceAuthorizationRecordMeta.props).not.toHaveProperty("resourceName");
});

test.each(drawers)("$name trigger opens and closes without manual state binding, preserving its click handler", async ({ Component }) => {
  const onClick = vi.fn();
  const onOpenChange = vi.fn();
  const onClose = vi.fn();
  render(<Environment><Component {...resource} apiSources={apiSources}
    onOpenChange={onOpenChange} onClose={onClose}
    trigger={<button onClick={onClick}>打开授权</button>} /></Environment>);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(get).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "打开授权" }));
  const drawer = await screen.findByRole("dialog");
  expect(onClick).toHaveBeenCalledOnce();
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  await waitFor(() => expect(get).toHaveBeenCalled());
  fireEvent.click(within(drawer).getByRole("button", { name: /close/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(onClose).toHaveBeenCalledOnce();
  fireEvent.click(screen.getByRole("button", { name: "打开授权" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true]]);
});

test.each(drawers)("$name trigger requests changes while explicit open stays controlled", async ({ Component }) => {
  const onOpenChange = vi.fn();
  const onClose = vi.fn();
  const props = { ...resource, apiSources, onOpenChange, onClose,
    trigger: <button>受控打开</button> };
  const { rerender } = render(<Environment><Component {...props} open={false} /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "受控打开" }));
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(get).not.toHaveBeenCalled();
  rerender(<Environment><Component {...props} open /></Environment>);
  const drawer = await screen.findByRole("dialog");
  fireEvent.click(within(drawer).getByRole("button", { name: /close/i }));
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(onClose).toHaveBeenCalledOnce();
  expect(screen.getByRole("dialog")).toBeTruthy();
  rerender(<Environment><Component {...props} open={false} /></Environment>);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test.each(drawers)("$name disabled or cancelled trigger cannot open", async ({ Component }) => {
  const onOpenChange = vi.fn();
  const props = { ...resource, apiSources, onOpenChange };
  const { rerender } = render(<Environment><Component {...props} trigger={<button disabled>禁用打开</button>} /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "禁用打开" }));
  rerender(<Environment><Component {...props} trigger={<button onClick={(event) => event.preventDefault()}>取消打开</button>} /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "取消打开" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(get).not.toHaveBeenCalled();
});

test.each(drawers)("$name selecting or clicking the trigger on the editing canvas does not reveal or change runtime open", async ({ Component }) => {
  const onOpenChange = vi.fn();
  const notify = vi.fn();
  const props = { ...resource, apiSources, onOpenChange, plasmicNotifyAutoOpenedContent: notify,
    trigger: <button>画布触发器</button>,
    __plasmic_selection_prop__: { isSelected: true, selectedSlotName: "trigger" } };
  const { rerender } = render(<Environment editing><Component {...props} /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "画布触发器" }));
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(notify).not.toHaveBeenCalled();
  rerender(<Environment editing><Component {...props} __plasmic_selection_prop__={{ isSelected: true }} /></Environment>);
  expect(await screen.findByRole("dialog")).toBeTruthy();
  expect(notify).toHaveBeenCalledOnce();
  rerender(<Environment editing interactive><Component {...props} /></Environment>);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(get).not.toHaveBeenCalled();
});

test("row-local triggers open the drawer for the clicked resource", async () => {
  render(<Environment>{["group-a", "group-b"].map((resourceId) => (
    <ResourceAuthorizationRecord key={resourceId} resourceTypeCode="GROUP" resourceId={resourceId}
      apiSources={apiSources} trigger={<button>{resourceId}</button>} />
  ))}</Environment>);
  fireEvent.click(screen.getByRole("button", { name: "group-b" }));
  expect(await screen.findByRole("dialog")).toBeTruthy();
  await waitFor(() => expect(get).toHaveBeenCalledWith(`${apiSources.dataPolicy}/resource-permissions`, {
    resourceId: "group-b", resourceTypeCode: "GROUP",
  }));
  expect(screen.getAllByRole("dialog")).toHaveLength(1);
});

test.each([false, true])("native generation keeps the button and open/close behavior without a trigger prop (record=%s)", async (record) => {
  const onOpenChange = vi.fn();
  const onClose = vi.fn();
  render(<Environment><NativeAuthorizationExample {...resource} apiSources={apiSources}
    record={record} onOpenChange={onOpenChange} onClose={onClose} /></Environment>);
  expect(screen.queryByRole("dialog")).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "原生打开" }));
  const drawer = await screen.findByRole("dialog");
  await waitFor(() => expect(get).toHaveBeenCalled());
  expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(true);
  fireEvent.click(within(drawer).getByRole("button", { name: /close/i }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(onOpenChange.mock.calls).toEqual([[true], [false]]);
  expect(onClose).toHaveBeenCalledOnce();
});

test.each([false, true])("native generation preserves disabled and cancelled trigger clicks (record=%s)", (record) => {
  const onOpenChange = vi.fn();
  const onTriggerClick = vi.fn((event: React.MouseEvent<HTMLButtonElement>) => event.preventDefault());
  const props = { ...resource, apiSources, record, onOpenChange, onClose: vi.fn(), onTriggerClick };
  const { rerender } = render(<Environment><NativeAuthorizationExample {...props} triggerDisabled /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "原生打开" }));
  expect(onTriggerClick).not.toHaveBeenCalled();
  rerender(<Environment><NativeAuthorizationExample {...props} /></Environment>);
  fireEvent.click(screen.getByRole("button", { name: "原生打开" }));
  expect(onTriggerClick).toHaveBeenCalledOnce();
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.queryByRole("dialog")).toBeNull();
  expect(get).not.toHaveBeenCalled();
});

test.each(drawers)(
  "$name opens on selection without requests or business callbacks, and explicit canvas close wins",
  async ({ Component }) => {
    const onClose = vi.fn();
    const onOpenChange = vi.fn();
    const onSuccess = vi.fn();
    const notify = vi.fn();
    const props = { ...resource, open: false, apiSources, onClose, onOpenChange, onSuccess,
      plasmicNotifyAutoOpenedContent: notify, __plasmic_selection_prop__: { isSelected: true } };
    const { rerender } = render(<Environment editing><Component {...props} /></Environment>);
    const drawer = await screen.findByRole("dialog");
    expect(notify).toHaveBeenCalledOnce();
    fireEvent.click(within(drawer).getByRole("button", { name: /close/i }));
    expect(get).not.toHaveBeenCalled();
    expect(post).not.toHaveBeenCalled();
    expect(deletePolicy).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
    expect(onOpenChange).not.toHaveBeenCalled();
    expect(onSuccess).not.toHaveBeenCalled();
    rerender(<Environment editing><Component {...props} previewOpen={false} /></Environment>);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  },
);

test.each(drawers)(
  "$name ignores canvas previewOpen and selection in Preview, then closes with the native callback",
  async ({ Component }) => {
    const onClose = vi.fn();
    const onOpenChange = vi.fn();
    const props = { ...resource, open: false, apiSources, onClose, onOpenChange,
      previewOpen: true, __plasmic_selection_prop__: { isSelected: true } };
    const { rerender } = render(<Environment editing interactive><Component {...props} /></Environment>);
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(get).not.toHaveBeenCalled();
    rerender(<Environment editing interactive><Component {...props} open previewOpen={false} /></Environment>);
    const drawer = await screen.findByRole("dialog");
    await waitFor(() => expect(get).toHaveBeenCalled());
    fireEvent.click(within(drawer).getByRole("button", { name: /close/i }));
    expect(onOpenChange).toHaveBeenCalledExactlyOnceWith(false);
    expect(onClose).toHaveBeenCalledOnce();
  },
);

test.each(["USER", "DEPT"])("authorizes %s with the original policy payload and emits success before close", async (bindType) => {
  const events: string[] = [];
  render(<Environment><ResourceAuthorization {...resource} open apiSources={apiSources}
    onClose={() => events.push("close")} onSuccess={() => events.push("success")}
    onOpenChange={(open) => events.push(`open:${open}`)} /></Environment>);
  await screen.findByText("查看 (READ)");
  const selectors = screen.getAllByRole("combobox");
  if (bindType === "DEPT") {
    fireEvent.mouseDown(selectors[0]);
    fireEvent.click(await screen.findByText("组织", { selector: ".ant-select-item-option-content" }));
  }
  fireEvent.mouseDown(selectors[1]);
  fireEvent.click(await screen.findByText(bindType === "USER" ? "测试用户" : "测试组织", { selector: ".ant-select-item-option-content" }));
  fireEvent.click(screen.getByRole("button", { name: /确\s*认\s*授\s*权/ }));
  await waitFor(() => expect(post).toHaveBeenCalledOnce());
  const [url, payload] = post.mock.calls[0] as unknown as [string, any];
  expect(url).toBe(apiSources.dataPolicy);
  expect(payload).toMatchObject({ resourceTypeCode: "GROUP", policyCategory: "PERSONALIZED", bindType,
    bindId: bindType === "USER" ? "user-1" : "dept-1" });
  expect(JSON.parse(payload.policyContent)).toEqual({ Statement: {
    Effect: "Allow", Action: ["READ"], Resource: [{ code: "@id:exact:group-1", name: "测试客群" }],
  } });
  expect(events).toEqual(["success", "open:false", "close"]);
});

test("Record deletes only after native confirmation, refreshes permissions, and emits success", async () => {
  const onSuccess = vi.fn();
  render(<Environment><ResourceAuthorizationRecord {...resource} open apiSources={apiSources}
    onClose={vi.fn()} onSuccess={onSuccess} /></Environment>);
  await screen.findByText("测试用户");
  const button = await screen.findByRole("button", { name: "delete" });
  fireEvent.click(button);
  const confirmation = (await screen.findByText("确认删除", { selector: ".ant-modal-title" })).closest('[role="dialog"]') as HTMLElement;
  expect(confirmation).toBeTruthy();
  expect(deletePolicy).not.toHaveBeenCalled();
  fireEvent.click(within(confirmation).getByRole("button", { name: /确\s*定/ }));
  await waitFor(() => expect(onSuccess).toHaveBeenCalledOnce());
  expect(deletePolicy).toHaveBeenCalledExactlyOnceWith(`${apiSources.dataPolicy}/personal`);
  expect(get.mock.calls.filter(([url]) => url.endsWith("resource-permissions"))).toHaveLength(2);
});
