import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ConfigProvider } from "antd";
import React from "react";
import { expect, test, vi } from "vitest";
import { AntdTreeSelect, registerAdditional } from "../src/registerAdditional";
import { AntdDatePicker } from "../src/registerDatePicker";
import { AntdDateRangePicker } from "../src/registerDateRangePicker";
import { AntdDrawer } from "../src/registerDrawer";
import { AntdMenu, registerMenu } from "../src/registerMenu";
import { AntdModal, registerModal } from "../src/registerModal";
import { AntdPopover } from "../src/registerPopover";
import { AntdProgress } from "../src/registerProgress";
import { AntdRate, registerRate } from "../src/registerRate";
import { AntdSelect, registerSelect } from "../src/registerSelect";
import { AntdTabItem, AntdTabs } from "../src/registerTabs";
import { AntdTooltip } from "../src/registerTooltip";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}

test("Modal default footer keeps native labels and loading/disabled button behavior", async () => {
  let meta: any;
  registerModal({ registerComponent: (_component: any, value: any) => { meta = value; } } as any);
  expect(meta.props.confirmLoading.type).toBe("boolean");
  expect(meta.props.okButtonProps.type).toBe("object");
  expect(meta.props.cancelButtonProps.type).toBe("object");
  const onOk = vi.fn(), onCancel = vi.fn();
  const props = { open: true, modalScopeClassName: "", wrapClassName: "", onOk, onCancel };
  const view = render(<AntdModal {...props} confirmLoading okButtonProps={{ disabled: true }} cancelButtonProps={{ disabled: true }} />);
  const ok = screen.getByRole("button", { name: /OK/ }) as HTMLButtonElement;
  const cancel = screen.getByRole("button", { name: "Cancel" }) as HTMLButtonElement;
  expect(ok.disabled).toBe(true);
  expect(ok.classList.contains("ant-btn-loading")).toBe(true);
  expect(cancel.disabled).toBe(true);
  fireEvent.click(ok);
  fireEvent.click(cancel);
  expect(onOk).not.toHaveBeenCalled();
  expect(onCancel).not.toHaveBeenCalled();
  view.rerender(<AntdModal {...props} confirmLoading={false} okButtonProps={{ disabled: false }} cancelButtonProps={{ disabled: false }} />);
  await waitFor(() => expect(screen.getByRole("button", { name: /OK/ }).classList.contains("ant-btn-loading")).toBe(false));
  fireEvent.click(screen.getByRole("button", { name: /OK/ }));
  expect(onOk).toHaveBeenCalledTimes(1);
  expect(screen.getByRole("button", { name: /OK/ })).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test("Modal preserves null footer and explicit zero width", () => {
  render(
    <AntdModal
      open
      footer={null}
      width={0}
      defaultStylesClassName="studio-reset"
      modalScopeClassName=""
      wrapClassName=""
    />,
  );
  expect(document.querySelector(".ant-modal-footer")).toBeNull();
  expect(
    (document.querySelector(".ant-modal") as HTMLElement).style.width,
  ).toBe("0px");
  expect(document.querySelector("[defaultstylesclassname]")).toBeNull();
});

test("Modal preserves responsive width configuration", () => {
  render(
    <AntdModal
      open
      width={{ xs: 300, sm: 500 }}
      modalScopeClassName=""
      wrapClassName=""
    />,
  );
  const modal = document.querySelector(".ant-modal") as HTMLElement;
  expect(modal.style.getPropertyValue("--ant-modal-xs-width")).toBe("300px");
  expect(modal.style.getPropertyValue("--ant-modal-sm-width")).toBe("500px");
});

test("Modal outside-click override works with a boolean mask", () => {
  const onCancel = vi.fn();
  const view = render(
    <AntdModal
      open
      mask
      closeOnOutsideClick={false}
      onCancel={onCancel}
      modalScopeClassName=""
      wrapClassName=""
    />,
  );
  fireEvent.mouseDown(document.querySelector(".ant-modal-wrap")!);
  fireEvent.click(document.querySelector(".ant-modal-wrap")!);
  expect(onCancel).not.toHaveBeenCalled();
  view.rerender(
    <AntdModal
      open
      mask
      closeOnOutsideClick
      onCancel={onCancel}
      modalScopeClassName=""
      wrapClassName=""
    />,
  );
  fireEvent.mouseDown(document.querySelector(".ant-modal-wrap")!);
  fireEvent.click(document.querySelector(".ant-modal-wrap")!);
  expect(onCancel).toHaveBeenCalledTimes(1);
});

test("Drawer keeps native root classes, panel classes and Studio scope together", () => {
  render(
    <AntdDrawer
      open
      rootClassName="native-root"
      drawerScopeClassName="studio-scope"
      className="native-panel"
      defaultStylesClassName="reset-panel"
    />,
  );
  const root = document.querySelector(".ant-drawer")!;
  expect(root.classList.contains("native-root")).toBe(true);
  expect(root.classList.contains("studio-scope")).toBe(true);
  expect(document.querySelector(".native-panel.reset-panel")).toBeTruthy();
  expect(document.querySelector("[defaultstylesclassname]")).toBeNull();
});

test.each([
  [
    "Tooltip",
    <AntdTooltip
      open
      title="Tip"
      popupRootClassName="studio-popup"
      classNames={{ root: "native-popup", container: "native-container" }}
    >
      <button>Tip trigger</button>
    </AntdTooltip>,
    ".ant-tooltip",
  ],
  [
    "Popover",
    <AntdPopover
      open
      content="Body"
      popoverScopeClassName="studio-popup"
      classNames={() => ({
        root: "native-popup",
        container: "native-container",
      })}
    >
      <button>Popover trigger</button>
    </AntdPopover>,
    ".ant-popover",
  ],
  [
    "Select",
    <AntdSelect
      open
      popupScopeClassName="studio-popup"
      classNames={() => ({
        root: "native-control",
        popup: { root: "native-popup", list: "native-list" },
      })}
      options={[{ value: "a", label: "A" }]}
    />,
    ".ant-select-dropdown",
  ],
  [
    "DatePicker",
    <AntdDatePicker
      open
      popupScopeClassName="studio-popup"
      classNames={{
        root: "native-control",
        popup: { root: "native-popup", body: "native-body" },
      }}
    />,
    ".ant-picker-dropdown",
  ],
  [
    "RangePicker",
    <AntdDateRangePicker
      {...({
        open: true,
        popupScopeClassName: "studio-popup",
        classNames: () => ({
          root: "native-control",
          popup: { root: "native-popup", body: "native-body" },
        }),
      } as any)}
    />,
    ".ant-picker-dropdown",
  ],
])(
  "%s combines semantic popup classes with Studio styling scope",
  async (_name, element, selector) => {
    render(element as React.ReactElement);
    await vi.waitFor(() =>
      expect(document.querySelector(selector as string)).toBeTruthy(),
    );
    const popup = document.querySelector(selector as string)!;
    expect(popup.classList.contains("native-popup")).toBe(true);
    expect(popup.classList.contains("studio-popup")).toBe(true);
    expect(
      document.querySelector(
        ".native-body, .native-container, .native-list, .native-control",
      ),
    ).toBeTruthy();
  },
);

test("Tabs preserves both native semantic classes and Studio scope", () => {
  render(
    <AntdTabs
      {...({
        items: (
          <AntdTabItem key="a" label="A">
            A content
          </AntdTabItem>
        ),
        className: "native-tabs",
        tabsScopeClassName: "studio-tabs",
        tabsDropdownScopeClassName: "studio-popup",
        classNames: { root: "native-semantic" },
      } as any)}
    />,
  );
  expect(
    document.querySelector(".native-tabs.studio-tabs.native-semantic"),
  ).toBeTruthy();
});

test("Rate multi-symbol slots accept arrays, text and a single node", () => {
  const view = render(
    <AntdRate
      multiCharacter
      symbols={["Low", <b key="high">High</b>] as any}
    />,
  );
  expect(screen.getAllByRole("radio")).toHaveLength(2);
  expect(screen.getAllByText("Low")).toHaveLength(2);
  expect(screen.getAllByText("High")).toHaveLength(2);
  view.rerender(<AntdRate multiCharacter symbols={<span>Only</span>} />);
  expect(screen.getAllByRole("radio")).toHaveLength(1);
  view.rerender(<AntdRate character={0} />);
  expect(screen.getAllByText("0")).toHaveLength(10);
  const meta = metadata(registerRate).get("plasmic-antd6-rate");
  expect(meta.props.onHoverChange.argTypes).toEqual([
    { name: "value", type: "number" },
  ]);
  expect(meta.props.tooltips.hidden({})).toBe(false);
  expect(meta.props.tooltips.validator([{ label: "One" }], {})).toBe(
    "You need 4 more labels",
  );
  expect(
    meta.props.tooltips.validator([{ label: "One" }, { label: "Two" }], {
      multiCharacter: true,
      symbols: ["1", "2"],
    }),
  ).toBe(true);
});

test("Progress step colors work with the default line type", () => {
  render(
    <AntdProgress
      {...({
        percent: 50,
        steps: 2,
        stepColors: [{ color: "red" }, { color: "blue" }],
      } as any)}
    />,
  );
  const steps = document.querySelectorAll<HTMLElement>(
    ".ant-progress-steps-item",
  );
  expect(steps).toHaveLength(2);
  expect(steps[0].style.backgroundColor).toBe("red");
});

test("Select tags registration accepts multiple defaults and non-text state", () => {
  const meta = metadata(registerSelect).get("plasmic-antd6-select");
  expect(meta.props.value.multiSelect({ mode: "tags" })).toBe(true);
  expect(meta.states.value.variableType).toBe("object");
  expect(meta.props.onChange.argTypes[0].type).toBe("object");
});

test("TreeSelect registration can bind scalar, multiple or labeled values", () => {
  const meta = metadata(registerAdditional).get("plasmic-antd6-tree-select");
  expect(meta.props.value.type).toBe("object");
  expect(meta.states.value.variableType).toBe("object");
});

test.each(["Select", "TreeSelect"])(
  "%s multiple selections retain arrays and can clear",
  (kind) => {
    const onChange = vi.fn();
    function Example() {
      const [value, setValue] = React.useState<string[]>([]);
      const change = (next: string[]) => {
        onChange(next);
        setValue(next);
      };
      return kind === "Select" ? (
        <AntdSelect
          open
          mode="tags"
          allowClear
          value={value}
          onChange={change}
          options={[
            { value: "a", label: "Alpha" },
            { value: "b", label: "Beta" },
          ]}
        />
      ) : (
        <AntdTreeSelect
          open
          multiple
          allowClear
          value={value}
          onChange={change}
          treeData={[
            { value: "a", title: "Alpha" },
            { value: "b", title: "Beta" },
          ]}
        />
      );
    }
    render(<Example />);
    fireEvent.click(screen.getByText("Alpha"));
    fireEvent.click(screen.getByText("Beta"));
    expect(onChange).toHaveBeenLastCalledWith(["a", "b"]);
    fireEvent.click(document.querySelector(".ant-select-clear")!);
    expect(onChange).toHaveBeenLastCalledWith([]);
  },
);

test("Progress zero success segment is preserved", () => {
  render(<AntdProgress percent={50} successPercent={0} />);
  expect(
    (document.querySelector(".ant-progress-track-success") as HTMLElement).style
      .width,
  ).toBe("0%");
});

test("Menu event metadata matches its native selection info", () => {
  const onSelect = vi.fn();
  render(<AntdMenu items={[{ key: "a", label: "A" }]} onSelect={onSelect} />);
  fireEvent.click(screen.getByRole("menuitem", { name: "A" }));
  expect(onSelect.mock.lastCall?.[0]).toMatchObject({
    key: "a",
    selectedKeys: ["a"],
  });
  const meta = metadata(registerMenu).get("plasmic-antd6-menu");
  expect(meta.props.onSelect.argTypes).toEqual([
    { name: "info", type: "object" },
  ]);
});

test("RangePicker inherits disabled and respects explicit false over split flags", () => {
  const view = render(
    <ConfigProvider componentDisabled>
      <AntdDateRangePicker {...({} as any)} />
    </ConfigProvider>,
  );
  expect(
    screen
      .getAllByRole("textbox")
      .every((input) => (input as HTMLInputElement).disabled),
  ).toBe(true);
  view.rerender(
    <ConfigProvider componentDisabled>
      <AntdDateRangePicker
        {...({ disabled: false, disableStartDate: true } as any)}
      />
    </ConfigProvider>,
  );
  expect(
    screen
      .getAllByRole("textbox")
      .some((input) => (input as HTMLInputElement).disabled),
  ).toBe(false);
  view.rerender(
    <AntdDateRangePicker {...({ disableStartDate: true } as any)} />,
  );
  expect((screen.getAllByRole("textbox")[0] as HTMLInputElement).disabled).toBe(
    true,
  );
  expect((screen.getAllByRole("textbox")[1] as HTMLInputElement).disabled).toBe(
    false,
  );
});
