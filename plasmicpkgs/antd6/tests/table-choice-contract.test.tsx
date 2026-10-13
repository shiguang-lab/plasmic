import React from "react";
import { expect, test } from "vitest";
import { registerTable } from "../src/registerTable";
import { AntdTabItem, registerTabs } from "../src/registerTabs";
import type { Registerable } from "../src/utils";

function tableProps() {
  let props: any;
  registerTable({
    registerComponent: (_component, meta) => {
      if (meta.name === "plasmic-antd6-table") {
        props = meta.props;
      }
    },
  } as Registerable);
  return props;
}

test("unrendered tab slots are unknown choices, while rendered empty slots remain empty", () => {
  let props: any;
  registerTabs({
    registerComponent: (_component, meta) => {
      if (meta.name === "plasmic-antd6-tabs") {
        props = meta.props;
      }
    },
  } as Registerable);
  expect(props.activeKey.options({})).toBeUndefined();
  expect(props.activeKey.options({ items: [] })).toEqual([]);
  expect(
    props.activeKey.options({
      items: (
        <>
          <AntdTabItem key="overview" label="Overview" />
          <AntdTabItem key="members" label="Members" />
        </>
      ),
    }),
  ).toEqual(["overview", "members"]);
});

test("row key choices follow actual data props even when the canvas instance is not rendered", () => {
  const props = tableProps();
  const values = {
    data: { data: [{ id: "row-1", title: "First" }] },
    rowKey: "id",
  };
  expect(props.rowKey.options(values, undefined)).toEqual(["id", "title"]);
  expect(props.rowKey.options(values, { data: [{ obsolete: true }] })).toEqual([
    "id",
    "title",
  ]);
  expect(props.selectedRowKeys.options(values, undefined)).toEqual(["row-1"]);
  expect(values.rowKey).toBe("id");
});

test("schema remains authoritative and unavailable data is not an empty allowlist", () => {
  const props = tableProps();
  expect(
    props.rowKey.options({
      data: {
        data: [],
        schema: { fields: [{ id: "id", label: "Record ID" }] },
      },
    }),
  ).toEqual([{ value: "id", label: "Record ID" }]);
  expect(props.rowKey.options({})).toBeUndefined();
  expect(
    props.rowKey.options({ data: { isLoading: true, data: [] } }),
  ).toBeUndefined();
  expect(props.rowKey.options({ data: { data: [] } })).toBeUndefined();
});
