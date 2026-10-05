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
      selectedSlotName?: string,
      isSelected = true,
      previewOpen?: boolean,
    ) => (
      <Canvas>
        <Overlay
          {...props}
          open={false}
          previewOpen={previewOpen}
          {...(name === "Select" ? {} : { destroyOnHidden: true })}
          plasmicNotifyAutoOpenedContent={notify}
          onOpenChange={onOpenChange}
          __plasmic_selection_prop__={{ isSelected, selectedSlotName }}
        />
      </Canvas>
    );
    const view = render(element(slot));
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    const node = screen.getByTestId("content");
    expect(view.container.contains(node)).toBe(false);
    node.focus();
    expect(document.activeElement).toBe(node);
    expect(notify).toHaveBeenCalledTimes(1);
    expect(onOpenChange).not.toHaveBeenCalled();
    view.rerender(element(undefined, false));
    await waitFor(() => expect(document.querySelector(selector)).toBeFalsy());
    view.rerender(element(slot, true, false));
    expect(document.querySelector(selector)).toBeFalsy();
    if (triggerSlot) {
      view.rerender(element(triggerSlot));
      expect(document.querySelector(selector)).toBeFalsy();
    }
    view.rerender(element(undefined, false, true));
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(onOpenChange).not.toHaveBeenCalled();
  });

  test(`${name}: interactive preview and published runtime ignore editing overrides`, async () => {
    const notify = vi.fn();
    const element = (
      <Overlay
        {...props}
        open={false}
        previewOpen
        plasmicNotifyAutoOpenedContent={notify}
        __plasmic_selection_prop__={{
          isSelected: true,
          selectedSlotName: slot,
        }}
      />
    );
    const view = render(<Canvas interactive>{element}</Canvas>);
    expect(document.querySelector(selector)).toBeFalsy();
    view.rerender(element);
    expect(document.querySelector(selector)).toBeFalsy();
    view.rerender(<Overlay {...props} open previewOpen={false} />);
    await waitFor(() => expect(document.querySelector(selector)).toBeTruthy());
    expect(notify).not.toHaveBeenCalled();
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
        <Overlay {...props} previewOpen afterOpenChange={afterOpenChange} />
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
        __plasmic_selection_prop__={{
          isSelected: true,
          selectedSlotName: "children",
        }}
      >
        <AntdSelect
          open={false}
          useChildren
          __plasmic_selection_prop__={{
            isSelected: true,
            selectedSlotName: "children",
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
        previewOpen
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
    const element = (isSelected: boolean) => (
      <Canvas>
        <Overlay
          {...entry.props}
          {...childProps}
          __plasmic_selection_prop__={{
            isSelected,
            selectedSlotName: entry.slot,
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
        previewOpen
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
        previewOpen
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
        previewOpen
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
        previewOpen
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
        previewOpen
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
    const prop = metas.get(`plasmic-antd6-${name}`).props.previewOpen;
    expect(prop.editOnly).toBe(true);
    expect(prop.uncontrolledProp).toBeUndefined();
  }
});
