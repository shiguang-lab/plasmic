import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import React from "react";
import { expect, test, vi } from "vitest";
import { registerAdditional } from "../src/registerAdditional";
import {
  AntdAvatar,
  registerAvatar,
  registerAvatarGroup,
} from "../src/registerAvatar";
import { AntdBreadcrumb, AntdBreadcrumbItem } from "../src/registerBreadcrumb";
import { AntdButton } from "../src/registerButton";
import { registerCheckbox } from "../src/registerCheckbox";
import { AntdColorPicker } from "../src/registerColorPicker";
import { AntdDatePicker } from "../src/registerDatePicker";
import { AntdDateRangePicker } from "../src/registerDateRangePicker";
import { AntdInputNumber, registerNumberInput } from "../src/registerInput";
import { AntdModal } from "../src/registerModal";
import { AntdPagination, paginationHelpers } from "../src/registerPagination";
import { AntdPopover, registerPopover } from "../src/registerPopover";
import { AntdSelect, registerSelect } from "../src/registerSelect";
import { registerSteps } from "../src/registerSteps";
import { AntdTable, TableRef } from "../src/registerTable";
import { AntdTabItem, AntdTabs } from "../src/registerTabs";
import { AntdTooltip } from "../src/registerTooltip";
import { AntdTree, registerTree } from "../src/registerTree";
import { UploadWrapper } from "../src/registerUpload";
import type { Registerable } from "../src/utils";

function metadata(register: (loader: Registerable) => void) {
  const metas = new Map<string, any>();
  register({
    registerComponent: (_component, meta) => metas.set(meta.name, meta),
  } as Registerable);
  return metas;
}
const sleep = (ms: number) =>
  act(() => new Promise((resolve) => setTimeout(resolve, ms)));

test("Modal OK invokes business action without prematurely changing open", () => {
  const onOpenChange = vi.fn(),
    onOk = vi.fn();
  render(
    <AntdModal
      open
      onOpenChange={onOpenChange}
      onOk={onOk}
      modalScopeClassName=""
      wrapClassName=""
    />,
  );
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(onOk).toHaveBeenCalledTimes(1);
  expect(onOpenChange).not.toHaveBeenCalled();
  expect(screen.getByRole("dialog")).toBeTruthy();
  fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
  expect(onOpenChange).toHaveBeenCalledWith(false);
});

test("controlled Modal can stay open during save and close only after success", async () => {
  let finish!: () => void;
  const saving = new Promise<void>((resolve) => {
    finish = resolve;
  });
  function Example() {
    const [open, setOpen] = React.useState(true);
    return (
      <>
        <output>{open ? "open" : "closed"}</output>
        <AntdModal
          open={open}
          onOpenChange={setOpen}
          onOk={async () => {
            await saving;
            setOpen(false);
          }}
          modalScopeClassName=""
          wrapClassName=""
        />
      </>
    );
  }
  render(<Example />);
  fireEvent.click(screen.getByRole("button", { name: "OK" }));
  expect(screen.getByRole("dialog")).toBeTruthy();
  expect(screen.getByText("open")).toBeTruthy();
  await act(async () => {
    finish();
    await saving;
  });
  expect(screen.getByText("closed")).toBeTruthy();
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
});

test("Pagination mount emits no business change; clicking a new page emits one", () => {
  const onChange = vi.fn();
  render(
    <AntdPagination
      current={1}
      pageSize={10}
      total={100}
      onChange={onChange}
    />,
  );
  expect(onChange).not.toHaveBeenCalled();
  fireEvent.click(screen.getByTitle("2"));
  expect(onChange).toHaveBeenCalledExactlyOnceWith(2, 10);
});

test("pagination index states initialize from current or default page props without firing events", () => {
  expect(
    paginationHelpers.states.startIndex.initFunc({ current: 3, pageSize: 20 }),
  ).toBe(40);
  expect(
    paginationHelpers.states.endIndex.initFunc({
      defaultCurrent: 3,
      defaultPageSize: 20,
    }),
  ).toBe(59);
  expect(paginationHelpers.states.startIndex.initFunc({})).toBe(0);
  expect(paginationHelpers.states.endIndex.initFunc({})).toBe(9);
});

const tableProps = {
  rowKey: "id",
  columns: [{ title: "Name", dataIndex: "name" }],
  data: {
    data: [
      { id: "1", name: "one" },
      { id: "2", name: "two" },
    ],
  },
  pagination: false as const,
};
test("uncontrolled Table selections persist and clearSelection updates checkboxes", () => {
  const ref = React.createRef<TableRef>(),
    onChange = vi.fn();
  render(
    <AntdTable
      {...tableProps}
      ref={ref}
      isSelectable="multiple"
      onSelectedRowKeysChange={onChange}
    />,
  );
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  expect((screen.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(
    true,
  );
  expect(onChange).toHaveBeenLastCalledWith(["1"]);
  fireEvent.click(screen.getAllByRole("checkbox")[2]);
  expect(onChange).toHaveBeenLastCalledWith(["1", "2"]);
  act(() => {
    ref.current!.clearSelection();
  });
  expect(
    screen
      .getAllByRole("checkbox")
      .every((c) => !(c as HTMLInputElement).checked),
  ).toBe(true);
});

test("controlled Table selection follows supplied keys rather than internal clicks", () => {
  const onChange = vi.fn();
  const view = render(
    <AntdTable
      {...tableProps}
      isSelectable="multiple"
      selectedRowKeys={[]}
      onSelectedRowKeysChange={onChange}
    />,
  );
  fireEvent.click(screen.getAllByRole("checkbox")[1]);
  expect(onChange).toHaveBeenCalledWith(["1"]);
  expect((screen.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(
    false,
  );
  view.rerender(
    <AntdTable
      {...tableProps}
      isSelectable="multiple"
      selectedRowKeys={["1"]}
      onSelectedRowKeysChange={onChange}
    />,
  );
  expect((screen.getAllByRole("checkbox")[1] as HTMLInputElement).checked).toBe(
    true,
  );
});

test("uncontrolled single Table selection behaves as radio selection", () => {
  render(<AntdTable {...tableProps} isSelectable="single" />);
  fireEvent.click(screen.getAllByRole("radio")[0]);
  expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(
    true,
  );
  fireEvent.click(screen.getAllByRole("radio")[1]);
  expect((screen.getAllByRole("radio")[0] as HTMLInputElement).checked).toBe(
    false,
  );
  expect((screen.getAllByRole("radio")[1] as HTMLInputElement).checked).toBe(
    true,
  );
});

test("Select respects filterOption=false for server results", async () => {
  render(
    <AntdSelect
      open
      showSearch
      filterOption={false}
      options={[{ value: "apple", label: "Apple" }]}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "banana" },
  });
  await sleep(30);
  expect(
    document.querySelector(".ant-select-item-option-content")?.textContent,
  ).toBe("Apple");
});

test("Select search hints follow single and multiple mode defaults", () => {
  const hint = metadata(registerSelect).get("plasmic-antd6-select").props
    .showSearch.defaultValueHint;
  expect(hint({})).toBe(false);
  expect(hint({ mode: "multiple" })).toBe(true);
  expect(hint({ mode: "tags" })).toBe(true);
});

test("Select respects explicit optionFilterProp and null suffixIcon", async () => {
  render(
    <AntdSelect
      open
      showSearch
      optionFilterProp="value"
      suffixIcon={null}
      options={[{ value: "id-123", label: "Visible name" }]}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), {
    target: { value: "id-123" },
  });
  await sleep(30);
  expect(
    document.querySelector(".ant-select-item-option-content")?.textContent,
  ).toBe("Visible name");
  expect(document.querySelector(".ant-select-arrow")).toBeNull();
});

test("Select label filtering accepts React nodes and numeric labels", async () => {
  render(
    <AntdSelect
      open
      showSearch
      options={[
        { value: "one", label: <b>Rich label</b> },
        { value: "two", label: 2026 },
      ]}
    />,
  );
  fireEvent.change(screen.getByRole("combobox"), { target: { value: "2026" } });
  await vi.waitFor(() =>
    expect(
      document.querySelectorAll(".ant-select-item-option-content"),
    ).toHaveLength(1),
  );
  expect(
    document.querySelector(".ant-select-item-option-content")?.textContent,
  ).toBe("2026");
});

test("Popover insertion preserves native hover delay, preventing fly-by opening", async () => {
  const props = metadata(registerPopover).get("plasmic-antd6-popover").props;
  const onOpenChange = vi.fn();
  render(
    <AntdPopover
      content="content"
      mouseEnterDelay={props.mouseEnterDelay.defaultValue}
      mouseLeaveDelay={props.mouseLeaveDelay.defaultValue}
      onOpenChange={onOpenChange}
    >
      <button>Hover</button>
    </AntdPopover>,
  );
  fireEvent.mouseEnter(screen.getByRole("button"));
  await sleep(25);
  fireEvent.mouseLeave(screen.getByRole("button"));
  await sleep(125);
  expect(onOpenChange).not.toHaveBeenCalledWith(true);
});

test("Tooltip explicit empty title disables fallback content", async () => {
  render(
    <AntdTooltip title="" titleText="fallback">
      <button>Hover</button>
    </AntdTooltip>,
  );
  fireEvent.mouseEnter(screen.getByRole("button"));
  await sleep(140);
  expect(screen.queryByRole("tooltip")).toBeNull();
});

test("Tooltip and Popover preserve an explicit zero instead of fallback text", () => {
  render(
    <>
      <AntdTooltip open title={0} titleText="fallback">
        <button>Tooltip</button>
      </AntdTooltip>
      <AntdPopover open content={0} contentText="fallback">
        <button>Popover</button>
      </AntdPopover>
    </>,
  );
  expect(screen.queryByText("fallback")).toBeNull();
  expect(screen.getAllByText("0")).toHaveLength(2);
});

test("Tabs native animation applies when props are omitted and can be disabled explicitly", () => {
  const items = (
    <>
      {[
        <AntdTabItem key="a" label="A">
          First
        </AntdTabItem>,
        <AntdTabItem key="b" label="B">
          Second
        </AntdTabItem>,
      ]}
    </>
  );
  const onChange = vi.fn();
  const view = render(<AntdTabs {...({ items, onChange } as any)} />);
  expect(document.querySelector(".ant-tabs-ink-bar-animated")).toBeTruthy();
  fireEvent.click(screen.getByRole("tab", { name: "B" }));
  expect(onChange).toHaveBeenCalledWith("b");
  expect(screen.getByText("Second")).toBeTruthy();
  view.rerender(<AntdTabs {...({ items, animated: false } as any)} />);
  expect(document.querySelector(".ant-tabs-ink-bar-animated")).toBeNull();
});

test("Tabs accepts a single tab in a slot and an empty slot", () => {
  const view = render(
    <AntdTabs
      {...({
        items: (
          <>
            <AntdTabItem key="a" label="A">
              First
            </AntdTabItem>
          </>
        ),
      } as any)}
    />,
  );
  expect(screen.getByRole("tab", { name: "A" })).toBeTruthy();
  view.rerender(<AntdTabs {...({} as any)} />);
  expect(screen.queryAllByRole("tab")).toHaveLength(0);
});

test("Tree honors later autoExpandParent prop updates", () => {
  const treeData = [
    {
      key: "parent",
      title: "Parent",
      children: [{ key: "child", title: "Child" }],
    },
  ];
  const view = render(
    <AntdTree
      treeData={treeData}
      expandedKeys={["child"]}
      autoExpandParent={false}
      defaultExpandParent={false}
    />,
  );
  expect(screen.queryByText("Child")).toBeNull();
  view.rerender(
    <AntdTree
      treeData={treeData}
      expandedKeys={["child"]}
      autoExpandParent
      defaultExpandParent={false}
    />,
  );
  expect(screen.getByText("Child")).toBeTruthy();
});

test("Tree insertion stays collapsed unless expansion is requested", () => {
  const props = metadata(registerTree).get("plasmic-antd6-tree").props;
  render(
    <AntdTree
      treeData={[
        { key: "p", title: "Parent", children: [{ key: "c", title: "Child" }] },
      ]}
      defaultExpandAll={props.defaultExpandAll.defaultValue}
      autoExpandParent={props.autoExpandParent.defaultValue}
    />,
  );
  expect(screen.queryByText("Child")).toBeNull();
});

test("RangePicker honors default dates and supports typing and clearing", async () => {
  const onChange = vi.fn();
  const user = userEvent.setup();
  render(
    <>
      <AntdDateRangePicker
        {...({
          defaultStartDate: "2026-10-01",
          defaultEndDate: "2026-10-03",
          onChange,
        } as any)}
      />
      <button>Outside</button>
    </>,
  );
  const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
  expect(inputs.map((input) => input.value)).toEqual([
    "2026-10-01",
    "2026-10-03",
  ]);
  expect(inputs.every((input) => !input.readOnly)).toBe(true);
  await user.click(inputs[0]);
  await user.clear(inputs[0]);
  await user.type(inputs[0], "2026-10-02");
  await user.tab();
  await user.click(screen.getByRole("button", { name: "Outside" }));
  await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(inputs[0].value).toBe("2026-10-02");
  fireEvent.click(document.querySelector(".ant-picker-clear")!);
  expect(inputs.map((input) => input.value)).toEqual(["", ""]);
});

test("RangePicker explicit readOnly and controlled dates are respected", () => {
  render(
    <AntdDateRangePicker
      {...({
        inputReadOnly: true,
        startDate: "2026-10-01",
        endDate: "2026-10-03",
      } as any)}
    />,
  );
  const inputs = screen.getAllByRole("textbox") as HTMLInputElement[];
  expect(inputs.every((input) => input.readOnly)).toBe(true);
  expect(inputs.map((input) => input.value)).toEqual([
    "2026-10-01",
    "2026-10-03",
  ]);
});

test("Date pickers do not inject global CSS affecting unrelated popups", () => {
  const { container } = render(
    <>
      <AntdDatePicker />
      <AntdDateRangePicker {...({} as any)} />
    </>,
  );
  expect(container.querySelector("style")).toBeNull();
});

test("ColorPicker updates controlled color during change and retains completion callback", async () => {
  const onChange = vi.fn(),
    onComplete = vi.fn();
  function Example() {
    const [value, setValue] = React.useState("#1677ff");
    return (
      <AntdColorPicker
        open
        value={value}
        onChange={(color) => {
          onChange(color);
          setValue(color);
        }}
        onChangeComplete={onComplete}
      />
    );
  }
  render(<Example />);
  const input = document.querySelector(
    ".ant-color-picker-hex-input input",
  ) as HTMLInputElement;
  expect(input).toBeTruthy();
  fireEvent.change(input, { target: { value: "ff0000" } });
  await vi.waitFor(() => expect(onChange).toHaveBeenCalled());
  expect(onChange).toHaveBeenLastCalledWith("#ff0000");
  expect(input.value.toLowerCase()).toBe("ff0000");
  fireEvent.blur(input);
  await vi.waitFor(() => expect(onComplete).toHaveBeenCalled());
});

test("Button respects explicit htmlType", () => {
  render(<AntdButton htmlType="reset">Reset</AntdButton>);
  expect((screen.getByRole("button") as HTMLButtonElement).type).toBe("reset");
});

test("Avatar preserves zero children and registers valid square shape without forced overflow", () => {
  render(<AntdAvatar letters="fallback">{0}</AntdAvatar>);
  expect(screen.getByText("0")).toBeTruthy();
  expect(screen.queryByText("fallback")).toBeNull();
  expect(
    metadata(registerAvatar).get("plasmic-antd6-avatar").props.shape.options,
  ).toContain("square");
  expect(
    metadata(registerAvatarGroup).get("plasmic-antd6-avatar-group").props.max
      .defaultValue,
  ).toBeUndefined();
});

test("Checkbox Group state records an array, Steps starts at first step, Badge has no example count or child", () => {
  expect(
    metadata(registerCheckbox).get("plasmic-antd6-checkbox-group").states.value
      .variableType,
  ).toBe("array");
  expect(
    metadata(registerSteps).get("plasmic-antd6-steps").props.current
      .defaultValue,
  ).toBeUndefined();
  const props = metadata(registerAdditional).get("plasmic-antd6-badge").props;
  expect(props.count.defaultValue).toBeUndefined();
  expect(props.children.defaultValue).toBeUndefined();
});

test("Breadcrumb supports empty and single item slots and explicit native items", () => {
  const view = render(<AntdBreadcrumb itemsRaw={<>{false}</>} />);
  expect(screen.queryByText("Single")).toBeNull();
  view.rerender(
    <AntdBreadcrumb
      itemsRaw={<AntdBreadcrumbItem>Single</AntdBreadcrumbItem>}
    />,
  );
  expect(screen.getByText("Single")).toBeTruthy();
  view.rerender(<AntdBreadcrumb items={[{ title: "Native item" }]} />);
  expect(screen.getByText("Native item")).toBeTruthy();
});

test("InputNumber registration preserves numeric state without forcing native number input", () => {
  const meta = metadata(registerNumberInput).get("plasmic-antd6-input-number");
  const onChange = vi.fn();
  render(
    <AntdInputNumber onChange={onChange} type={meta.props.type.defaultValue} />,
  );
  const input = screen.getByRole("spinbutton") as HTMLInputElement;
  expect(input.type).toBe("text");
  fireEvent.change(input, { target: { value: "12" } });
  expect(onChange).toHaveBeenLastCalledWith(12);
  expect(meta.states.value.variableType).toBe("number");
});

test("local Upload retains multiple files in selection order and maxCount keeps the newest", async () => {
  const user = userEvent.setup();
  const onFilesChange = vi.fn();
  function Example({ maxCount }: { maxCount?: number }) {
    const [files, setFiles] = React.useState<any[]>([]);
    return (
      <UploadWrapper
        files={files}
        onFilesChange={(next) => {
          setFiles(next);
          onFilesChange(next);
        }}
        multiple
        maxCount={maxCount}
        dragAndDropFiles={false}
      >
        <button>Choose</button>
      </UploadWrapper>
    );
  }
  const view = render(<Example />);
  const files = ["a.txt", "b.txt", "c.txt"].map(
    (name) => new File([name], name, { type: "text/plain" }),
  );
  await user.upload(view.container.querySelector('input[type="file"]')!, files);
  await vi.waitFor(() =>
    expect(
      onFilesChange.mock.lastCall?.[0].every((f: any) => f.status === "done"),
    ).toBe(true),
  );
  expect(onFilesChange.mock.lastCall?.[0].map((f: any) => f.name)).toEqual([
    "a.txt",
    "b.txt",
    "c.txt",
  ]);
  view.unmount();
  const limited = render(<Example maxCount={2} />);
  for (const file of files) {
    await user.upload(
      limited.container.querySelector('input[type="file"]')!,
      file,
    );
  }
  await vi.waitFor(() =>
    expect(
      onFilesChange.mock.lastCall?.[0].every((f: any) => f.status === "done"),
    ).toBe(true),
  );
  expect(onFilesChange.mock.lastCall?.[0].map((f: any) => f.name)).toEqual([
    "b.txt",
    "c.txt",
  ]);
});

test("Select keeps the native arrow when its icon is omitted and accepts a custom icon", () => {
  const { container, rerender } = render(
    <AntdSelect options={[{ value: "mx", label: "MX" }]} />,
  );
  expect(container.querySelector('[aria-label="down"]')).toBeTruthy();
  rerender(
    <AntdSelect
      suffixIcon={<span data-testid="custom-select-icon">custom</span>}
    />,
  );
  expect(screen.getByTestId("custom-select-icon")).toBeTruthy();
  expect(container.querySelector('[aria-label="down"]')).toBeNull();
});
