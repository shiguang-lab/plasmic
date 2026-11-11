import { fireEvent, render, screen, within } from "@testing-library/react";
import React, { useState } from "react";
import { afterEach, expect, test, vi } from "vitest";
import {
  IntlDepartmentSelect,
  IntlDepartmentView,
  IntlDictSelect,
  IntlDictView,
  IntlUserSelect,
  IntlUserView,
} from "../src";

afterEach(() => vi.unstubAllGlobals());

test("selects demo users, departments and dictionary items and resolves their labels offline", async () => {
  const get = vi.fn();
  vi.stubGlobal("$$request", { get });

  function Demo() {
    const [user, setUser] = useState<string>();
    const [department, setDepartment] = useState<string>();
    const [region, setRegion] = useState<string>();
    const [treeRegion, setTreeRegion] = useState<string>();
    return (
      <>
        <IntlUserSelect aria-label="User" value={user} onChange={setUser} />
        <div data-testid="user-view">
          <IntlUserView value={user} />
        </div>
        <IntlDepartmentSelect
          aria-label="Department"
          value={department}
          onChange={setDepartment}
          treeDefaultExpandAll
        />
        <div data-testid="dept-view">
          <IntlDepartmentView value={department} showFullPath />
        </div>
        <IntlDictSelect
          aria-label="Region"
          dictCode="DEMO_REGION"
          value={region}
          onChange={setRegion}
        />
        <div data-testid="dict-view">
          <IntlDictView dictCode="DEMO_REGION" value={region} />
        </div>
        <IntlDictSelect
          aria-label="Region tree"
          type="tree"
          dictCode="DEMO_REGION"
          value={treeRegion}
          onChange={setTreeRegion}
          treeDefaultExpandAll
        />
        <div data-testid="dict-tree-view">
          <IntlDictView dictCode="DEMO_REGION" value={treeRegion} />
        </div>
      </>
    );
  }

  render(<Demo />);
  const pick = async (
    label: string,
    option: string,
    output: string,
    expected: string,
  ) => {
    fireEvent.mouseDown(screen.getByRole("combobox", { name: label }));
    const choices = await screen.findAllByText(option);
    fireEvent.click(choices[choices.length - 1]);
    expect(within(screen.getByTestId(output)).getByText(expected)).toBeTruthy();
  };
  await pick("User", "林晓 (lin.xiao)", "user-view", "林晓 (lin.xiao)");
  await pick("Department", "运营组", "dept-view", "海外业务部 / 运营组");
  await pick("Region", "新加坡", "dict-view", "新加坡");
  await pick("Region tree", "印度尼西亚", "dict-tree-view", "印度尼西亚");
  expect(get).not.toHaveBeenCalled();
});

test("binds real-shaped local data and respects explicitly empty data and unrelated dictionary codes", () => {
  const get = vi.fn();
  vi.stubGlobal("$$request", { get });
  const { rerender } = render(
    <>
      <IntlUserView
        value="local-user"
        options={[
          { userId: "local-user", username: "local", nickname: "Local user" },
        ]}
      />
      <IntlDepartmentView
        value="local-dept"
        treeData={[{ value: "local-dept", label: "Local department" }]}
      />
      <IntlDictView
        dictCode="CUSTOM"
        value="local-item"
        treeData={[{ dictItemCode: "local-item", dictItemName: "Local item" }]}
      />
    </>,
  );
  expect(screen.getByText("Local user (local)")).toBeTruthy();
  expect(screen.getByText("Local department")).toBeTruthy();
  expect(screen.getByText("Local item")).toBeTruthy();

  rerender(
    <>
      <IntlUserView value="demo-user-1" options={[]} />
      <IntlDepartmentView value="demo-operations" treeData={[]} />
      <IntlDictView dictCode="CUSTOM" value="SG" />
      <IntlDictView dictCode="DEMO_REGION" value="ID" treeData={[]} />
    </>,
  );
  for (const id of ["demo-user-1", "demo-operations", "SG", "ID"]) {
    expect(screen.getByText(id)).toBeTruthy();
  }
  expect(get).not.toHaveBeenCalled();
});

test("uses the bound data for the active dictionary mode", async () => {
  const local = {
    dictCode: "CUSTOM",
    options: [{ value: "LIST", label: "List entry", title: "List entry" }],
    treeData: [
      {
        value: "TREE",
        label: "Tree entry",
        title: "Tree entry",
        fullPath: "Tree entry",
        origin: { dictItemCode: "TREE", dictItemName: "Tree entry" },
      },
    ],
    treeCheckable: true,
    treeDefaultExpandAll: true,
    showFullPath: true,
    open: true,
  };
  const { rerender } = render(<IntlDictSelect {...local} type="list" />);
  expect((await screen.findAllByText("List entry")).length).toBeGreaterThan(0);
  expect(screen.queryByText("Tree entry")).toBeNull();

  rerender(<IntlDictSelect {...local} type="tree" />);
  expect((await screen.findAllByText("Tree entry")).length).toBeGreaterThan(0);
  expect(screen.queryByText("List entry")).toBeNull();
});
