import { PlasmicCanvasContext } from "@plasmicapp/host";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdPopconfirm, registerAdditional } from "../src/registerAdditional";
import { AntdDrawer, registerDrawer } from "../src/registerDrawer";
import { AntdDropdown, registerDropdown } from "../src/registerDropdown";
import { AntdMenuItem } from "../src/registerMenu";
import { AntdModal, registerModal } from "../src/registerModal";
import { AntdPopover, registerPopover } from "../src/registerPopover";
import { AntdOption, AntdSelect, registerSelect } from "../src/registerSelect";
import { AntdTooltip, registerTooltip } from "../src/registerTooltip";
import type { Registerable } from "../src/utils";
import { createSessionCanvas } from "./canvas-session";
import { CanvasSessionState } from "../../../platform/wab/src/wab/client/components/canvas/canvas-session-state";

function Canvas({
  children,
  interactive = false,
}: {
  children: React.ReactNode;
  interactive?: boolean;
}) {
  return (
    <PlasmicCanvasContext.Provider
      value={{
        componentName: "Overlay test",
        globalVariants: {},
        interactive,
      }}
    >
      <ConfigProvider theme={{ token: { motion: false } }}>
        {children}
      </ConfigProvider>
    </PlasmicCanvasContext.Provider>
  );
}

const content = (
  <span data-testid="content" contentEditable suppressContentEditableWarning>
    Editable content
  </span>
);
const trigger = <button>Trigger</button>;

test("Tooltip selection reveals remain visible during interaction, and native hover remains dismissible", async () => {
  const SessionCanvas = createSessionCanvas([registerTooltip]);
  const onOpenChange = vi.fn(), afterOpenChange = vi.fn();
  const page = (interactive: boolean, selected = true) => (
    <SessionCanvas interactive={interactive}>
      <ConfigProvider theme={{ token: { motion: false } }}>
        {[0, 1].map((row) => (
          <AntdTooltip key={row} title={`Full text ${row}`} mouseEnterDelay={0} mouseLeaveDelay={0}
            onOpenChange={onOpenChange} afterOpenChange={afterOpenChange}
            __canvas={{ selected, slot: "title" }}>
            <button>{`Row ${row}`}</button>
          </AntdTooltip>
        ))}
      </ConfigProvider>
    </SessionCanvas>
  );
  const visible = () => document.querySelectorAll(".ant-tooltip:not(.ant-tooltip-hidden)");
  const view = render(page(false));
  await waitFor(() => expect(visible()).toHaveLength(2));
  for (const mode of [true, false, true]) {
    view.rerender(page(mode));
    await waitFor(() => expect(visible()).toHaveLength(2));
  }
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(afterOpenChange).not.toHaveBeenCalled();
  view.rerender(page(true, false));
  await waitFor(() => expect(visible()).toHaveLength(0));
  expect(afterOpenChange).not.toHaveBeenCalled();
  for (const row of [0, 1, 0]) {
    const target = screen.getByRole("button", { name: `Row ${row}` });
    fireEvent.mouseEnter(target);
    await waitFor(() => {
      expect(visible()).toHaveLength(1);
      expect(visible()[0].textContent).toBe(`Full text ${row}`);
    });
    fireEvent.mouseLeave(target);
    await waitFor(() => expect(visible()).toHaveLength(0));
  }
  expect(onOpenChange.mock.calls).toEqual([[true], [false], [true], [false], [true], [false]]);
  // Browser regression checks both lifecycle edges after real popup alignment.
  expect(afterOpenChange).toHaveBeenLastCalledWith(false);
});

test("Modal exposes only its native buttons as editing parts, preserving props and runtime behavior", () => {
  let meta: any;
  registerModal({ registerComponent: (_impl: any, value: any) => { meta = value; } } as Registerable);
  expect(meta.canvasParts.ok.props).toEqual(["okText", "okButtonProps", "confirmLoading", "onOk"]);
  expect(meta.canvasParts.ok.text.prop).toBe("okText");
  expect(meta.canvasParts.cancel.text.prop).toBe("cancelText");
  expect(meta.props.okButtonProps.fields.type.options).toContain("primary");
  expect(meta.props.cancelButtonProps.fields.size.options).toContain("small");
  const onOk = vi.fn(), onCancel = vi.fn();
  const props = { open: true, modalScopeClassName: "", wrapClassName: "", onOk, onCancel, okText: "Next", cancelText: "Dismiss", okButtonProps: { className: "custom-ok", style: { color: "red" } } };
  const view = render(<Canvas><AntdModal {...props} /></Canvas>);
  const ok = screen.getByRole("button", { name: "Next" });
  expect(ok.matches(meta.canvasParts.ok.selector)).toBe(true);
  expect(ok.querySelector(meta.canvasParts.ok.text.selector)?.textContent).toBe("Next");
  expect(ok.classList.contains("custom-ok")).toBe(true);
  expect(ok.style.color).toBe("red");
  fireEvent.click(ok);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(onOk).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
  view.rerender(<Canvas><AntdModal {...props} footer={<button>Custom action</button>} /></Canvas>);
  expect(document.querySelector(meta.canvasParts.ok.selector)).toBeNull();
  expect(document.querySelector(meta.canvasParts.cancel.selector)).toBeNull();
  view.rerender(<AntdModal {...props} />);
  expect(document.querySelector(meta.canvasParts.ok.selector)).toBeNull();
  fireEvent.click(screen.getByRole("button", { name: "Next" }));
  expect(onOk).toHaveBeenCalledTimes(1);
  fireEvent.click(screen.getByRole("button", { name: "Dismiss" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test.each([false, true])(
  "Dropdown renders wrapped menu slots (interactive=%s)",
  async (interactive) => {
    function CanvasObserver({ children }: { children: () => React.ReactNode }) {
      return <>{children()}</>;
    }
    const action = vi.fn();
    render(
      <Canvas interactive={interactive}>
        <AntdDropdown
          open={interactive || undefined}
          onAction={action}
          __canvas={{
            selected: true,
            slot: null,
          }}
          useMenuItemsSlot
          menuItems={() => (
            <CanvasObserver>
              {() => (
                <>
                  <AntdMenuItem key="list">新建常规客群</AntdMenuItem>
                  <AntdMenuItem key="sql">SQL 建群</AntdMenuItem>
                </>
              )}
            </CanvasObserver>
          )}
        >
          {trigger}
        </AntdDropdown>
      </Canvas>,
    );
    const item = await screen.findByRole("menuitem", { name: "新建常规客群" });
    expect(screen.getByRole("menuitem", { name: "SQL 建群" })).toBeTruthy();
    fireEvent.click(item);
    if (interactive) {
      expect(action).toHaveBeenCalledWith("list");
    } else {
      expect(action).not.toHaveBeenCalled();
    }
  },
);

test("selecting Dropdown itself auto-opens its menu and reports the hidden-content status", async () => {
  const notify = vi.fn();
  render(
    <Canvas>
      <AntdDropdown
        open={false}
        menuItemsJson={[{ key: "item", label: "Dropdown content" }]}
        __canvas={{
          onReveal: notify,
          selected: true,
          slot: null,
        }}
      >
        {trigger}
      </AntdDropdown>
    </Canvas>,
  );
  expect(
    await screen.findByRole("menuitem", { name: "Dropdown content" }),
  ).toBeTruthy();
  expect(notify).toHaveBeenCalledTimes(1);
});

const cases = [
  {
    name: "Tooltip",
    Component: AntdTooltip,
    slot: "title",
    triggerSlot: "children",
    props: { title: content, children: trigger },
    selector: ".ant-tooltip:not(.ant-tooltip-hidden)",
  },
  {
    name: "Popover",
    Component: AntdPopover,
    slot: "content",
    triggerSlot: "children",
    props: { content, children: trigger },
    selector: ".ant-popover:not(.ant-popover-hidden)",
  },
  {
    name: "Popconfirm",
    Component: AntdPopconfirm,
    slot: "description",
    triggerSlot: "children",
    props: { title: "Confirm", description: content, children: trigger },
    selector: ".ant-popover:not(.ant-popover-hidden)",
  },
  {
    name: "Modal",
    Component: AntdModal,
    slot: "children",
    triggerSlot: "trigger",
    props: {
      children: content,
      trigger,
      modalScopeClassName: "",
      wrapClassName: "",
    },
    selector: ".ant-modal-wrap:not([style*='display: none'])",
  },
  {
    name: "Drawer",
    Component: AntdDrawer,
    slot: "children",
    props: { children: content },
    selector: ".ant-drawer-open",
  },
  {
    name: "Dropdown",
    Component: AntdDropdown,
    slot: "menuItems",
    triggerSlot: "children",
    props: {
      children: trigger,
      useMenuItemsSlot: true,
      menuItems: () => <AntdMenuItem key="item">{content}</AntdMenuItem>,
    },
    selector: ".ant-dropdown:not(.ant-dropdown-hidden)",
  },
  {
    name: "Select",
    Component: AntdSelect,
    slot: "children",
    props: {
      useChildren: true,
      children: <AntdOption value="item">{content}</AntdOption>,
    },
    selector: ".ant-select-dropdown:not(.ant-select-dropdown-hidden)",
  },
];

for (const { name, Component, props, slot, triggerSlot, selector } of cases) {
  // Dynamic component props vary; keep the assertions shared across actual native portals.
  const Overlay = Component as React.ComponentType<any>;
  test(`${name}: selection opens an editable body portal without changing business open`, async () => {
    const notify = vi.fn(),
      onOpenChange = vi.fn();
    const element = (
      slot?: string,
      selected = true,
    ) => (
      <Canvas>
        <Overlay
          {...props}
          open={false}
          {...(name === "Select" ? {} : { destroyOnHidden: true })}
          onOpenChange={onOpenChange}
          __canvas={{ selected, slot, onReveal: notify }}
        />
      </Canvas>
    );
    const view = render(element(slot));
    expect(document.querySelector("[__canvas]")).toBeNull();
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    const node = screen.getByTestId("content");
    expect(view.container.contains(node)).toBe(false);
    node.focus();
    expect(document.activeElement).toBe(node);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    view.rerender(element(undefined, false));
    await waitFor(() => expect(document.querySelector(selector)).toBeFalsy());
    if (triggerSlot) {
      view.rerender(element(triggerSlot));
      expect(document.querySelector(selector)).toBeFalsy();
    }
    view.rerender(element(slot));
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test(`${name}: interactive canvas reveals selection while published runtime keeps business props`, async () => {
    const notify = vi.fn();
    const element = (
      <Overlay
        {...props}
        open={false}
        __canvas={{
          onReveal: notify,
          selected: true,
          slot: slot,
        }}
      />
    );
    const view = render(<Canvas interactive>{element}</Canvas>);
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(notify).toHaveBeenCalled();
    notify.mockClear();
    view.rerender(element);
    await waitFor(() => expect(document.querySelector(selector)).toBeFalsy());
    view.rerender(<Overlay {...props} open />);
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(notify).not.toHaveBeenCalled();
  });

  test(`${name}: editor operations control a session without adding design props`, async () => {
    const SessionCanvas = createSessionCanvas([registerTooltip, registerPopover, registerAdditional, registerModal, registerDrawer, registerDropdown, registerSelect]);
    const session = new CanvasSessionState();
    const businessProps = Object.freeze({ ...props, open: false });
    const element = (interactive = false) => (
      <ConfigProvider theme={{ token: { motion: false } }}>
        <SessionCanvas session={session} interactive={interactive}>
          <Overlay key="overlay" {...businessProps} />
        </SessionCanvas>
      </ConfigProvider>
    );
    const view = render(element());
    expect(document.querySelector(selector)).toBeFalsy();
    session.set("root/overlay", "open", true, true);
    view.rerender(element());
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    view.rerender(element(true));
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    view.rerender(element());
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    session.set("root/overlay", "open", false, true);
    view.rerender(element());
    await waitFor(() => expect(document.querySelector(selector)).toBeFalsy());
    expect(businessProps.open).toBe(false);
    expect(businessProps).not.toHaveProperty("previewOpen");
    view.unmount();
    render(<Overlay {...businessProps} />);
    expect(document.querySelector(selector)).toBeFalsy();
  });
}

test.each(
  cases.filter(({ name }) =>
    ["Tooltip", "Popover", "Popconfirm", "Modal", "Drawer"].includes(name),
  ),
)(
  "$name: open lifecycle callbacks are silent in editing and active in runtime",
  async ({ Component, props, selector }) => {
    const Overlay = Component as React.ComponentType<any>;
    const afterOpenChange = vi.fn();
    const view = render(
      <Canvas>
        <Overlay {...props} __canvas={{ selected: true }} afterOpenChange={afterOpenChange} />
      </Canvas>,
    );
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(afterOpenChange).not.toHaveBeenCalled();
    view.unmount();
    render(
      <Canvas interactive>
        <Overlay {...props} open afterOpenChange={afterOpenChange} />
      </Canvas>,
    );
    await waitFor(() => expect(afterOpenChange).toHaveBeenCalledWith(true));
  },
);

test("nested Modal and Select content stays open while selecting the inner option", async () => {
  render(
    <Canvas>
      <AntdModal
        open={false}
        modalScopeClassName=""
        wrapClassName=""
        __canvas={{
          selected: true,
          slot: "children",
        }}
      >
        <AntdSelect
          open={false}
          useChildren
          __canvas={{
            selected: true,
            slot: "children",
          }}
        >
          <AntdOption value="item">{content}</AntdOption>
        </AntdSelect>
      </AntdModal>
    </Canvas>,
  );
  await waitFor(() => expect(screen.getByTestId("content")).toBeTruthy());
  expect(screen.getByRole("dialog")).toBeTruthy();
});

test.each(["Modal", "Drawer", "Tooltip", "Popover", "Popconfirm", "Dropdown"])(
  "hiding an editing %s also removes cached descendant portals",
  async (name) => {
    const entry = cases.find((item) => item.name === name)!;
    const Overlay = entry.Component as React.ComponentType<any>;
    const child = (
      <AntdSelect
        __canvas={{ selected: true }}
        options={[{ value: "inner", label: "Nested option" }]}
      />
    );
    const childProps =
      name === "Popover"
        ? { content: child }
        : name === "Tooltip"
          ? { title: child }
          : name === "Popconfirm"
            ? { description: child }
            : name === "Dropdown"
              ? {
                  menuItems: () => (
                    <AntdMenuItem key="item">{child}</AntdMenuItem>
                  ),
                }
              : { children: child };
    const element = (selected: boolean) => (
      <Canvas>
        <Overlay
          {...entry.props}
          {...childProps}
          __canvas={{
            selected,
            slot: entry.slot,
          }}
        />
      </Canvas>
    );
    const view = render(element(true));
    await waitFor(() => expect(screen.getByText("Nested option")).toBeTruthy());
    view.rerender(element(false));
    await waitFor(() => expect(screen.queryByText("Nested option")).toBeNull());
  },
);

test("published Modal keeps native content caching after closing", async () => {
  const element = (open: boolean) => (
    <Canvas interactive>
      <AntdModal open={open} modalScopeClassName="" wrapClassName="">
        {content}
      </AntdModal>
    </Canvas>
  );
  const view = render(element(true));
  const node = screen.getByTestId("content");
  view.rerender(element(false));
  await waitFor(() =>
    expect(
      document.querySelector(".ant-modal-wrap")?.getAttribute("style"),
    ).toContain("display: none"),
  );
  expect(screen.getByTestId("content")).toBe(node);
});

test("editing Modal, Drawer, Popconfirm and Dropdown cannot run close or business actions", async () => {
  const action = vi.fn();
  const view = render(
    <Canvas>
      <AntdModal
        __canvas={{ selected: true }}
        onOpenChange={action}
        onOk={action}
        onCancel={action}
        afterOpenChange={action}
        afterClose={action}
        modalScopeClassName=""
        wrapClassName=""
      />
    </Canvas>,
  );
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(action).not.toHaveBeenCalled();
  view.rerender(
    <Canvas>
      <AntdDrawer
        __canvas={{ selected: true }}
        onOpenChange={action}
        onClose={action}
        afterOpenChange={action}
      />
    </Canvas>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Close" }));
  expect(action).not.toHaveBeenCalled();
  view.rerender(
    <Canvas>
      <AntdPopconfirm
        __canvas={{ selected: true }}
        title="Confirm"
        onConfirm={action}
        onCancel={action}
        onOpenChange={action}
      >
        {trigger}
      </AntdPopconfirm>
    </Canvas>,
  );
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(action).not.toHaveBeenCalled();
  view.rerender(
    <Canvas>
      <AntdDropdown
        __canvas={{ selected: true }}
        onAction={action}
        onOpenChange={action}
        menuItemsJson={[{ key: "item", label: "Item" }]}
      >
        {trigger}
      </AntdDropdown>
    </Canvas>,
  );
  fireEvent.click(screen.getByText("Item"));
  expect(action).not.toHaveBeenCalled();
});

test("uncontrolled Select preserves native defaultOpen and emits changes only in runtime", async () => {
  const onChange = vi.fn(),
    onOpenChange = vi.fn();
  const view = render(
    <Canvas>
      <AntdSelect
        __canvas={{ selected: true }}
        defaultOpen
        options={[{ value: "item", label: "Item" }]}
        onChange={onChange}
        onOpenChange={onOpenChange}
      />
    </Canvas>,
  );
  fireEvent.click(screen.getByText("Item"));
  expect(onChange).not.toHaveBeenCalled();
  expect(onOpenChange).not.toHaveBeenCalled();
  view.unmount();
  render(
    <AntdSelect
      defaultOpen
      options={[{ value: "item", label: "Item" }]}
      onChange={onChange}
    />,
  );
  fireEvent.click(screen.getByText("Item"));
  expect(onChange).toHaveBeenCalledWith(
    "item",
    expect.objectContaining({ value: "item" }),
  );
});

test("all editing overrides are pruned from generated code rather than mapped to defaultOpen", () => {
  const metas = new Map<string, any>();
  const loader = {
    registerComponent: (_: unknown, meta: any) => metas.set(meta.name, meta),
  } as Registerable;
  for (const register of [
    registerTooltip,
    registerPopover,
    registerAdditional,
    registerModal,
    registerDrawer,
    registerDropdown,
    registerSelect,
  ]) {
    register(loader);
  }
  for (const name of [
    "tooltip",
    "popover",
    "popconfirm",
    "modal",
    "drawer",
    "dropdown",
    "select",
  ]) {
    expect(metas.get(`plasmic-antd6-${name}`).props).not.toHaveProperty("previewOpen");
    const triggerSlot =
      name === "modal"
        ? "trigger"
        : ["tooltip", "popover", "popconfirm", "dropdown"].includes(name)
          ? "children"
          : undefined;
    expect(metas.get(`plasmic-antd6-${name}`).canvasOverlay).toEqual(
      triggerSlot ? { triggerSlot } : {},
    );
    const open = metas.get(`plasmic-antd6-${name}`).props.open;
    expect(open.editOnly, `${name}.open is a real runtime prop`).toBeUndefined();
    expect(open.uncontrolledProp, `${name}.open keeps its native name`).toBeUndefined();
  }
  for (const name of ["tooltip", "popover", "select"]) {
    expect(metas.get(`plasmic-antd6-${name}`).props.defaultOpen.type).toBe("boolean");
  }
  expect(metas.get("plasmic-antd6-popover").states.open.initialValueProp).toBe("defaultOpen");
  expect(metas.get("plasmic-antd6-dropdown").props.onOpenChange.argTypes.map((arg: any) => arg.name)).toEqual(["open", "info"]);
  expect(metas.get("plasmic-antd6-select").props.onOpenChange.argTypes).toEqual([{ name: "open", type: "boolean" }]);
  expect(metas.get("plasmic-antd6-dropdown").canvasEventBindings).toEqual([
    { slot: "menuItems", event: "onAction", args: { key: { prop: "key" } } },
  ]);
});

test.each([false, true])(
  "Image preview follows canvas interaction mode (interactive=%s)",
  async (interactive) => {
    const { AntdImage, AntdImagePreviewGroup } =
      await import("../src/registerAdditional");
    const { container } = render(
      <Canvas interactive={interactive}>
        <AntdImagePreviewGroup>
          <AntdImage src="/image.png" preview={{ open: true }} />
        </AntdImagePreviewGroup>
      </Canvas>,
    );
    fireEvent.click(container.querySelector("img")!);
    if (interactive) expect(await screen.findByRole("dialog")).toBeTruthy();
    else expect(screen.queryByRole("dialog")).toBeNull();
  },
);
