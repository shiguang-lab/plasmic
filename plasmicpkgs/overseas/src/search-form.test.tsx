import { PlasmicCanvasContext } from "@plasmicapp/host";
import { Input } from "antd";
import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SearchForm,
  SearchFormItem,
  collectSearchItems,
  searchDefaults,
  searchGrid,
  searchLayout,
} from "./SearchForm";
import { registerAll } from "./index";

test("Overseas registers an editable field tree, slots, events and actions", () => {
  const registry = new Map<string, any>();
  registerAll({
    registerComponent(component, meta) {
      registry.set(meta.name, { component, meta });
    },
  });
  const form = registry.get("plasmic-overseas-search-form");
  const item = registry.get("plasmic-overseas-search-form-item");
  assert.equal(form.component, SearchForm);
  assert.equal(item.component, SearchFormItem);
  assert.deepEqual(form.meta.props.children.allowedComponents, [
    item.meta.name,
  ]);
  assert.equal(item.meta.parentComponentName, form.meta.name);
  for (const slot of ["children", "labelContent", "help"]) {
    assert.equal(item.meta.props[slot].type, "slot");
  }
  assert.equal(form.meta.props.extraActions.type, "slot");
  assert.equal(form.meta.props.colSpan.defaultValue, 6);
  assert.equal(form.meta.props.labelWidth.type, "number");
  assert.equal(form.meta.props.labelWidth.defaultValue, undefined);
  for (const prop of [
    "name",
    "label",
    "span",
    "initialValue",
    "clearValue",
    "required",
    "rules",
    "valuePropName",
    "trigger",
  ]) {
    assert(item.meta.props[prop], prop);
  }
  for (const action of ["submit", "reset", "setFieldsValue"]) {
    assert(form.meta.refActions[action], action);
  }
  assert.equal(form.meta.states.values.onChangeProp, "onValuesChange");
  assert.equal(form.meta.props.onSearch.argTypes[0].type, "object");
});

test("grid reserves actions, respects variable spans and keeps a full-width first item", () => {
  assert.deepEqual(searchLayout([6, 6, 6], 1, true), {
    showExpand: false,
    visibleCount: 3,
    actionSpan: 6,
  });
  assert.deepEqual(searchLayout([6, 6, 6, 6], 1, true), {
    showExpand: true,
    visibleCount: 3,
    actionSpan: 6,
  });
  assert.deepEqual(searchLayout([8, 8, 8, 8], 1, false), {
    showExpand: true,
    visibleCount: 4,
    actionSpan: 16,
  });
  assert.deepEqual(searchLayout([24, 6], 1, true), {
    showExpand: true,
    visibleCount: 1,
    actionSpan: 24,
  });
  assert.deepEqual(searchLayout([6, 6, 6, 6], 2, true), {
    showExpand: false,
    visibleCount: 4,
    actionSpan: 24,
  });
  assert.deepEqual(searchLayout([], 1, true), {
    showExpand: false,
    visibleCount: 0,
    actionSpan: 24,
  });
  assert.equal(searchGrid([12, 18, 6]).rows, 2);
  assert.equal(searchGrid([0, 30, -1]).rows, 3);
});

test("default four-column form keeps three fields and actions on one row; explicit three-column layout remains supported", () => {
  const fields = ["触发方式", "状态", "时间范围"].map((label, i) => (
    <SearchFormItem key={i} name={`field${i}`} label={label}>
      <Input />
    </SearchFormItem>
  ));
  const normal = renderToStaticMarkup(<SearchForm>{fields}</SearchForm>);
  assert.equal((normal.match(/ant-col-md-6/g) ?? []).length, 4);
  assert(!normal.includes('aria-expanded='));
  const threeColumn = renderToStaticMarkup(<SearchForm colSpan={8} collapsed={false}>{fields}</SearchForm>);
  assert.equal((threeColumn.match(/ant-col-md-8/g) ?? []).length, 3);
  assert(threeColumn.includes('ant-col-md-24'));
  assert(threeColumn.includes('aria-expanded="true"'));
});

test("defaults preserve falsy values and reset business clear values separately", () => {
  assert.deepEqual(
    searchDefaults(
      [
        { name: "count", initialValue: 0, clearValue: -1 },
        { name: "active", initialValue: false },
        { name: "keyword", initialValue: "" },
        { name: "status", clearValue: "all" },
        { name: "scope", clearValue: "all" },
      ],
      { count: 99, scope: "mine" },
    ),
    {
      initialValues: {
        count: 0,
        active: false,
        keyword: "",
        status: "all",
        scope: "mine",
      },
      clearValues: { count: -1, status: "all", scope: "all" },
    },
  );
});

test("slot traversal supports fragments, wrappers and repeats without entering control children", () => {
  const children = (
    <>
      <div>
        {[1, 2].map((i) => (
          <SearchFormItem key={i} name={`field${i}`}>
            <Input />
          </SearchFormItem>
        ))}
      </div>
      <SearchFormItem name="last">
        <div>
          <SearchFormItem name="not-a-field" />
        </div>
      </SearchFormItem>
    </>
  );
  assert.deepEqual(
    collectSearchItems(children).map((item) => item.props.name),
    ["field1", "field2", "last"],
  );
});

test("collapsed fields stay mounted, and custom labels/actions remain real slot content", () => {
  const html = renderToStaticMarkup(
    <SearchForm colSpan={6} extraActions={<button>Export</button>}>
      {[1, 2, 3, 4].map((i) => (
        <SearchFormItem
          key={i}
          name={`field${i}`}
          label={`Label ${i}`}
          labelContent={i === 1 ? <strong>Custom label</strong> : undefined}
        >
          <Input placeholder={`Input ${i}`} />
        </SearchFormItem>
      ))}
    </SearchForm>,
  );
  for (const i of [1, 2, 3, 4]) {
    assert(html.includes(`Input ${i}`), `Input ${i}`);
  }
  assert.match(html, /display:none/);
  assert.match(html, /Custom label/);
  assert.match(html, /Export/);
  assert.match(html, /aria-expanded="false"/);
});

test("editor exposes all fields while interactive preview preserves runtime collapse", () => {
  const fields = [1, 2, 3, 4].map((i) => (
    <SearchFormItem key={i} name={`field${i}`}>
      <Input />
    </SearchFormItem>
  ));
  for (const interactive of [false, true]) {
    const html = renderToStaticMarkup(
      <PlasmicCanvasContext.Provider
        value={{ componentName: "Page", globalVariants: {}, interactive }}
      >
        <SearchForm colSpan={6} collapsed>
          {fields}
        </SearchForm>
      </PlasmicCanvasContext.Provider>,
    );
    assert.equal(html.includes("display:none"), interactive);
  }
});
