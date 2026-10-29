import { PlasmicCanvasContext } from "@plasmicapp/host";
import * as antd from "antd";
import assert from "node:assert/strict";
import { readdirSync } from "node:fs";
import { dirname } from "node:path";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { componentChildren } from "./componentSections";
import { registerAll } from "./index";
import { Registerable } from "./utils";

const components = new Map<
  string,
  { component: React.ComponentType<any>; meta: any }
>();
const contexts: { component: React.ComponentType<any>; meta: any }[] = [];
registerAll({
  registerComponent(component, meta) {
    assert(!components.has(meta.name), `Duplicate component ${meta.name}`);
    components.set(meta.name, { component, meta });
  },
  registerGlobalContext(component, meta) {
    contexts.push({ component, meta });
  },
  registerToken() {},
} as Registerable);

test("every registered visual component includes a self-contained SVG thumbnail", () => {
  for (const { meta } of components.values()) {
    assert.match(meta.thumbnailUrl ?? "", /^data:image\/svg\+xml;charset=utf-8,/,
      `Missing thumbnail for ${meta.name}`);
    const svg = decodeURIComponent(meta.thumbnailUrl.split(",")[1]);
    assert.match(svg, /^<svg\b/);
    assert.match(svg, /viewBox="0 0 \d+ \d+"/);
    assert.match(svg, /<(rect|circle|path|text)\b/);
    assert.doesNotMatch(svg, /<(script|image|foreignObject)\b/);
  }
});

test("system settings expose every installed Ant Design locale and pass the native pack", () => {
  const provider = contexts.find((c) => c.meta.name === "plasmic-antd6-config-provider")!;
  const locale = provider.meta.props.locale;
  assert.equal(locale.type, "choice");
  assert.equal(locale.defaultValue, undefined);
  assert.equal(locale.defaultValueHint, "en_US");
  const localeDir = dirname(require.resolve("antd/lib/locale/en_US.js"));
  const officialLocales = readdirSync(localeDir)
    .filter((file) => /^[a-z]{2,3}_[A-Z]{2}\.js$/.test(file))
    .map((file) => file.slice(0, -3));
  assert.deepEqual(locale.options, officialLocales);
  for (const value of locale.options) {
    const expected = require(`antd/lib/locale/${value}.js`).default;
    function CheckLocale() {
      assert.deepEqual(React.useContext(antd.ConfigProvider.ConfigContext).locale, expected, value);
      return null;
    }
    renderToStaticMarkup(
      React.createElement(provider.component, {
        themeStyles: {},
        removeLoading: true,
        locale: JSON.parse(JSON.stringify(value)),
        children: React.createElement(CheckLocale),
      }),
    );
  }
});

test("Form.Item label tooltip is editable and simplified fields expose tooltip text", () => {
  const item = components.get("plasmic-antd6-form-item")!;
  const form = components.get("plasmic-antd6-form")!;
  assert.equal(item.meta.props.tooltip.type, "slot");
  assert.equal(form.meta.props.formItems.itemType.fields.tooltip.type, "string");
  assert.equal(form.meta.props.dataFormItems.itemType.fields.tooltip.type, "string");
  assert.equal(item.meta.props.description.type, "slot");
  // Native Ant Design default: collect every failing rule unless validateFirst is set.
  assert.equal(item.meta.props.validateFirst.defaultValue, undefined);
  assert.equal(item.meta.props.validateFirst.defaultValueHint, false);
  for (const prop of ["formItems", "dataFormItems"]) {
    assert.equal(form.meta.props[prop].itemType.fields.description.type, "string");
    assert.equal(form.meta.props[prop].itemType.fields.validateFirst.defaultValue, undefined);
  }
  assert.deepEqual(form.meta.refActions.submit.argTypes, []);
  assert.equal(form.meta.props.styles.type, "object");
  assert.match(form.meta.props.styles.description, /shared by its fields/);
  assert.equal(item.meta.props.tooltip.hidden({ noLabel: true }, null), true);
  assert.equal(item.meta.props.tooltip.hidden({}, null), false);
  assert.equal(form.meta.props.formItems.itemType.fields.tooltip.hidden({}, null, { item: { noLabel: true } }), true);
});

test("table supports a paginated, bounded viewport with fixed columns", () => {
  const table = components.get("plasmic-antd6-table")!;
  const column = components.get("plasmic-antd6-table-column")!;
  const html = renderToStaticMarkup(
    React.createElement(table.component, {
      data: {
        data: Array.from({ length: 41 }, (_, i) => ({
          id: i + 1,
          name: `Audience ${i + 1}`,
        })),
      },
      rowKey: "id",
      size: "large",
      scroll: { x: 1200, y: 640 },
      pagination: {
        defaultPageSize: 20,
        pageSizeOptions: [20, 50, 100],
        showSizeChanger: true,
        showTotal: (total: number, range: [number, number]) => `共 ${total} 条 · ${range[0]}–${range[1]}`,
      },
      children: React.createElement(column.component, {
        title: "Audience",
        dataIndex: "name",
        width: 240,
        fixed: "right",
        ellipsis: true,
      }),
    }),
  );
  assert.equal((html.match(/data-row-key=/g) || []).length, 20);
  assert.match(html, /ant-pagination-total-text/);
  assert.match(html, /共 41 条 · 1–20/);
  assert(html.indexOf("ant-pagination-total-text") < html.indexOf('ant-pagination-prev'), "Native total precedes the pagination buttons");
  assert.match(html, /max-height:640px/);
  assert.match(html, /ant-table-cell-fix-end/);
  assert.match(html, /width:240px/);
  assert(
    table.meta.props.pagination &&
      table.meta.props.scroll &&
      table.meta.props.onChange,
  );
  assert(column.meta.props.width && column.meta.props.ellipsis);
});

test("table title is an optional native render slot with current page data", () => {
  const table = components.get("plasmic-antd6-table")!;
  const column = components.get("plasmic-antd6-table-column")!;
  assert.equal(table.meta.props.title.type, "slot");
  assert.deepEqual(table.meta.props.title.renderPropParams, ["currentPageData"]);
  assert.equal(table.meta.props.title.defaultValue, undefined);

  const rows = Array.from({ length: 3 }, (_, i) => ({
    id: i + 1,
    name: `Audience ${i + 1}`,
  }));
  // Exercise both the editable Column-node path and native columns prop path.
  for (const columns of [
    { children: React.createElement(column.component, { title: "Audience", dataIndex: "name" }) },
    { columns: [{ title: "Audience", dataIndex: "name" }] },
  ]) {
    let currentPageData: readonly unknown[] | undefined;
    const props = {
      data: { data: rows },
      rowKey: "id",
      pagination: { defaultCurrent: 2, defaultPageSize: 2 },
      ...columns,
    };
    const html = renderToStaticMarkup(
      React.createElement(table.component, {
        ...props,
        title: (pageRows: readonly unknown[]) => {
          currentPageData = pageRows;
          return React.createElement(antd.Button, null, `本页 ${pageRows.length} 条`);
        },
      }),
    );
    assert.deepEqual(currentPageData, [rows[2]]);
    assert.match(html, /ant-table-title[^>]*><button/);
    assert.match(html, /本页 1 条/);
    assert(html.indexOf("本页 1 条") < html.indexOf("<thead"), "Title renders above column headers");
    assert.match(html, /Audience 3/);
    assert.doesNotMatch(renderToStaticMarkup(React.createElement(table.component, props)), /ant-table-title/);
  }
});

// The non-deprecated top-level visual components exported by antd 6.6.5.
const families = [
  "affix",
  "alert",
  "anchor",
  "auto-complete",
  "avatar",
  "badge",
  "border-beam",
  "breadcrumb",
  "button",
  "calendar",
  "card",
  "carousel",
  "cascader",
  "checkbox",
  "col",
  "collapse",
  "color-picker",
  "date-picker",
  "descriptions",
  "divider",
  "drawer",
  "dropdown",
  "empty",
  "flex",
  "float-button",
  "form",
  "image",
  "input",
  "input-number",
  "layout",
  "list",
  "listy",
  "masonry",
  "mentions",
  "menu",
  "modal",
  "pagination",
  "popconfirm",
  "popover",
  "progress",
  "qr-code",
  "radio",
  "rate",
  "result",
  "row",
  "segmented",
  "select",
  "skeleton",
  "slider",
  "space",
  "spin",
  "splitter",
  "statistic",
  "steps",
  "switch",
  "table",
  "tabs",
  "tag",
  "time-picker",
  "timeline",
  "tooltip",
  "tour",
  "transfer",
  "tree",
  "tree-select",
  "typography",
  "upload",
  "watermark",
];

test("all Ant Design 6 visual families are registered with usable exports", () => {
  for (const family of families) {
    assert(components.has(`plasmic-antd6-${family}`), `Missing ${family}`);
  }
  assert(contexts.some((c) => c.meta.name === "plasmic-antd6-config-provider"));
  for (const { component, meta } of components.values()) {
    assert(component, meta.name);
    assert(meta.importName, meta.name);
    assert(
      meta.importPath.startsWith("@shiguang-lab/plasmic-antd6/skinny/"),
      meta.name,
    );
    for (const prop of Object.values(meta.props) as any[]) {
      if (prop?.allowedComponents) {
        for (const name of prop.allowedComponents) {
          assert(components.has(name), `Missing slot component ${name}`);
        }
      }
    }
  }
});

test("registrations expose v6 APIs instead of deprecated v5 controls", () => {
  const props = (suffix: string) =>
    components.get(`plasmic-antd6-${suffix}`)!.meta.props;
  for (const suffix of [
    "input",
    "select",
    "date-picker",
    "date-range-picker",
  ]) {
    assert(props(suffix).variant, suffix);
    assert(!props(suffix).bordered, suffix);
  }
  assert.equal(
    props("popover").popoverContentClassName.selectors[0].selector,
    ":popover.ant-popover .ant-popover-container",
  );
  assert.equal(
    props("modal").modalContentClassName.selectors[0].selector,
    ":modal .ant-modal-container",
  );
  assert(props("tabs").tabPlacement);
  assert(!props("tabs").tabPosition);
  assert(props("tabs").destroyOnHidden);
  assert(props("steps").orientation);
  assert(!props("steps").direction);
  assert(!props("steps").progressDot);
  assert(props("avatar-group").max);
  assert(!props("avatar-group").maxCount);
  for (const suffix of ["input", "input-number"]) {
    assert(!props(suffix).addonBefore, suffix);
    assert(!props(suffix).addonAfter, suffix);
  }
  assert(!props("input-number").allowClear);
  for (const suffix of ["card", "steps", "progress"]) {
    assert.deepEqual(
      new Set(props(suffix).size.options),
      new Set(["small", "medium"]),
      suffix,
    );
  }
  assert.deepEqual(
    new Set(props("list").size.options),
    new Set(["small", "default", "large"]),
  );
  assert(props("modal").closeOnOutsideClick);
  assert(!props("modal").maskClosable);
});

test("InputNumber exposes native sizes without overriding size inheritance", () => {
  const input = components.get("plasmic-antd6-input-number");
  assert(input);
  assert.deepEqual(new Set(input.meta.props.size.options), new Set(["small", "medium", "large"]));
  assert.equal(input.meta.props.size.defaultValue, undefined);

  const render = (size?: "small" | "medium" | "large", formSize?: "large") =>
    renderToStaticMarkup(
      <antd.ConfigProvider componentSize="small">
        {formSize ? (
          <antd.Form size={formSize}>
            <input.component size={size} />
          </antd.Form>
        ) : (
          <input.component size={size} />
        )}
      </antd.ConfigProvider>
    );
  assert.match(render(), /ant-input-number-sm\b/);
  assert.match(render(undefined, "large"), /ant-input-number-lg\b/);
  assert.match(render("small", "large"), /ant-input-number-sm\b/);
  assert.match(render("large"), /ant-input-number-lg\b/);
  assert.doesNotMatch(render("medium", "large"), /ant-input-number-(sm|lg)\b/);
  assert.doesNotMatch(renderToStaticMarkup(<input.component />), /ant-input-number-(sm|lg)\b/);
});

test("input and date states remain connected to registered events", () => {
  for (const suffix of [
    "input",
    "select",
    "date-picker",
    "time-picker",
    "time-range-picker",
    "transfer",
  ]) {
    const { meta } = components.get(`plasmic-antd6-${suffix}`)!;
    for (const state of Object.values(meta.states) as any[]) {
      assert(meta.props[state.valueProp], `${suffix} value prop`);
      assert(meta.props[state.onChangeProp], `${suffix} change event`);
    }
  }
});

test("v6 wrappers render native props and ISO dates", () => {
  for (const [suffix, props] of [
    ["button", { children: "Save", size: "medium" }],
    ["input", { value: "Example", variant: "filled" }],
    ["date-picker", { value: "2026-10-02T10:20:00Z" }],
    ["time-picker", { value: "2026-10-02T10:20:00Z" }],
    [
      "time-range-picker",
      { value: ["2026-10-02T10:20:00Z", "2026-10-02T11:20:00Z"] },
    ],
    [
      "steps",
      {
        orientation: "vertical",
        items: [{ title: "Step", content: "Details" }],
      },
    ],
    ["card", { title: "Card", variant: "borderless", children: "Content" }],
    ["timeline", { items: [{ title: "Event", content: "Details" }] }],
  ] as const) {
    const html = renderToStaticMarkup(
      React.createElement(
        components.get(`plasmic-antd6-${suffix}`)!.component,
        props,
      ),
    );
    assert(html.length > 0, suffix);
    assert(!html.includes("Invalid Date"), suffix);
  }
});

test("Tour target selectors do not access the DOM during SSR", () => {
  assert.doesNotThrow(() =>
    renderToStaticMarkup(
      React.createElement(components.get("plasmic-antd6-tour")!.component, {
        open: false,
        steps: [{ title: "Intro", targetSelector: "#tour-anchor" }],
      }),
    ),
  );
});

test("optional decoration slots do not inject empty canvas placeholders", () => {
  const optionalSlots = {
    "form-item": ["tooltip", "description"],
    statistic: ["title", "prefix", "suffix"],
    tag: ["icon", "children"],
    badge: ["children"],
    alert: ["action"],
    card: ["title", "extra", "cover", "actions"],
    table: ["title"],
    "card-meta": ["avatar"],
    empty: ["children"],
    "float-button": ["icon"],
    "back-top": ["icon"],
    list: ["children", "header", "footer"],
    "list-item": ["extra", "actions"],
    "list-item-meta": ["avatar"],
    popconfirm: ["description"],
    result: ["extra", "icon"],
    skeleton: ["children"],
    space: ["separator"],
  };
  for (const [name, slots] of Object.entries(optionalSlots)) {
    const registration = components.get(`plasmic-antd6-${name}`);
    assert(registration, name);
    for (const prop of slots) {
      assert.equal(
        registration.meta.props[prop].type,
        "slot",
        `${name}.${prop}`,
      );
      assert.equal(
        registration.meta.props[prop].hidePlaceholder,
        true,
        `${name}.${prop}`,
      );
    }
  }
  for (const name of ["flex", "card", "splitter-panel", "form-item"]) {
    const registration = components.get(`plasmic-antd6-${name}`);
    assert(registration);
    assert.notEqual(
      registration.meta.props.children.hidePlaceholder,
      true,
      `${name}.children stays editable`,
    );
  }
  const statistic = components.get("plasmic-antd6-statistic");
  assert(statistic);
  const html = renderToStaticMarkup(
    React.createElement(statistic.component, {
      value: 12,
      prefix: React.createElement("span", null, "$"),
      suffix: "users",
    }),
  );
  assert.match(html, /\$/);
  assert.match(html, /12/);
  assert.match(html, /users/);
});

test("visual components have sections and related children retain their parents", () => {
  for (const { meta } of components.values()) {
    assert(meta.section, `Missing section for ${meta.name}`);
    if (meta.parentComponentName) {
      const parent = components.get(meta.parentComponentName);
      assert(parent, `Missing parent for ${meta.name}`);
      assert.equal(meta.section, parent.meta.section, meta.name);
    }
  }
  for (const [child, parent] of Object.entries({
    "avatar-group": "avatar",
    "badge-ribbon": "badge",
    "breadcrumb-item": "breadcrumb",
    "card-grid": "card",
    "card-meta": "card",
  })) {
    assert.equal(
      components.get(`plasmic-antd6-${child}`)?.meta.parentComponentName,
      `plasmic-antd6-${parent}`,
    );
  }
  assert.equal(components.get("plasmic-antd6-button")?.meta.section, "General");
  assert.equal(
    components.get("plasmic-antd6-form")?.meta.section,
    "Data Entry",
  );
  assert.equal(
    components.get("plasmic-antd6-table")?.meta.section,
    "Data Display",
  );
});

test("static child labels resolve to real Antd exports with matching hierarchy", () => {
  for (const [suffix, child] of Object.entries(componentChildren)) {
    const meta = components.get(`plasmic-antd6-${suffix}`)?.meta;
    assert(meta, suffix);
    assert.equal(meta.displayName, child.displayName);
    assert.equal(meta.parentComponentName, `plasmic-antd6-${child.parent}`);
    assert(
      child.displayName
        .split(".")
        .reduce((value, key) => value?.[key], antd as any),
      child.displayName,
    );
  }
  for (const suffix of ["radio", "input-number"]) {
    assert.equal(
      components.get(`plasmic-antd6-${suffix}`)?.meta.parentComponentName,
      undefined,
    );
  }
});

test("Collapse follows Antd items, keys and accordion mode", () => {
  const { component, meta } = components.get("plasmic-antd6-collapse")!;
  assert.equal(meta.props.accordion.defaultValueHint, false);
  const items = [
    { key: "1", label: "First", children: "First body" },
    { key: "2", label: "Second", children: "Second body" },
  ];
  const multiple = renderToStaticMarkup(
    React.createElement(component, { items, activeKey: ["1", "2"] }),
  );
  assert.equal((multiple.match(/aria-expanded="true"/g) ?? []).length, 2);
  const accordion = renderToStaticMarkup(
    React.createElement(component, {
      items,
      activeKey: ["1", "2"],
      accordion: true,
    }),
  );
  assert.equal((accordion.match(/aria-expanded="true"/g) ?? []).length, 1);
  const single = renderToStaticMarkup(
    React.createElement(component, {
      items: items.slice(0, 1),
      activeKey: "1",
    }),
  );
  assert.match(single, /First body/);
  assert(!components.has("plasmic-antd6-single-collapse"));
});

test("mode variants and editor-only option components use native props", () => {
  for (const suffix of [
    "range-slider",
    "date-picker-multiple",
    "segmented-option",
    "slider-mark",
  ]) {
    assert(!components.has(`plasmic-antd6-${suffix}`), suffix);
  }
  const slider = components.get("plasmic-antd6-slider")!;
  assert(slider.meta.props.range);
  const html = renderToStaticMarkup(
    React.createElement(slider.component, {
      range: true,
      value: [20, 80],
      marks: { 50: "Middle" },
    }),
  );
  assert.equal((html.match(/role="slider"/g) ?? []).length, 2);
  assert.match(html, /Middle/);
  const single = renderToStaticMarkup(
    React.createElement(slider.component, { value: 20 }),
  );
  assert.equal((single.match(/role="slider"/g) ?? []).length, 1);
  const segmented = components.get("plasmic-antd6-segmented")!;
  assert(!segmented.meta.props.optionsSlot);
  const segments = renderToStaticMarkup(
    React.createElement(segmented.component, {
      options: [0, "A", { value: "B", label: "Bee", disabled: true }],
      value: 0,
    }),
  );
  assert.match(segments, /Bee/);
  assert.match(segments, /disabled/);
  const date = components.get("plasmic-antd6-date-picker")!;
  assert(date.meta.props.multiple);
  const dates = renderToStaticMarkup(
    React.createElement(date.component, {
      multiple: true,
      value: ["2026-10-01", "2026-10-02"],
    }),
  );
  assert.match(dates, /2026-10-01/);
  assert.match(dates, /2026-10-02/);
});

test("icon-bearing components expose native slots", () => {
  for (const [name, props] of Object.entries({
    button: ["icon"],
    avatar: ["icon"],
    alert: ["icon"],
    "menu-item": ["icon"],
    submenu: ["icon"],
    tag: ["icon", "closeIcon"],
    spin: ["indicator"],
    tabs: ["addIcon", "removeIcon"],
    "tab-item": ["icon", "closeIcon"],
    tree: ["icon", "switcherIcon"],
    input: ["prefix", "suffix"],
    select: ["suffixIcon"],
    modal: ["closeIcon"],
    drawer: ["closeIcon"],
    "float-button": ["icon"],
    popconfirm: ["icon"],
  })) {
    const meta = components.get(`plasmic-antd6-${name}`)?.meta;
    for (const prop of props) {
      assert.equal(meta?.props[prop]?.type, "slot", `${name}.${prop}`);
    }
  }
});

test("Button keeps its icon-only shape without an empty label container", () => {
  const { component } = components.get("plasmic-antd6-button")!;
  const html = renderToStaticMarkup(
    React.createElement(component, {
      icon: React.createElement("svg", { "data-test-icon": "plus" }),
      shape: "circle",
    }),
  );
  assert.match(html, /ant-btn-icon-only/);
  assert.match(html, /data-test-icon="plus"/);
  assert(!html.includes("<div"));
  const labelled = renderToStaticMarkup(
    React.createElement(component, {
      icon: React.createElement("svg", { "data-test-icon": "search" }),
      children: "Search",
      iconPlacement: "end",
    }),
  );
  assert.match(labelled, /Search/);
  assert.match(labelled, /ant-btn-icon-end/);
});

test("content editing expands native and virtual table viewports only in Studio, retaining pagination and saved props", () => {
  const table = components.get("plasmic-antd6-table")!;
  const column = components.get("plasmic-antd6-table-column")!;
  for (const nativeColumns of [false, true]) {
    const props = {
      data: {
        data: Array.from({ length: 41 }, (_, i) => ({
          id: i + 1,
          name: `Record ${i + 1}`,
        })),
      },
      rowKey: "id",
      scroll: { x: 1200, y: 240 },
      virtual: true,
      pagination: { defaultPageSize: 20 },
      __plasmic_selection_prop__: { isEditingContents: true },
      ...(nativeColumns
        ? {
            columns: [
              { title: "Name", dataIndex: "name", width: 240, fixed: "left" },
            ],
          }
        : {
            children: React.createElement(column.component, {
              title: "Name",
              dataIndex: "name",
              width: 240,
              fixed: "left",
            }),
          }),
    };
    const savedScroll = { ...props.scroll };
    const render = (interactive: boolean) =>
      renderToStaticMarkup(
        React.createElement(
          PlasmicCanvasContext.Provider,
          { value: { componentName: "Test", globalVariants: {}, interactive } },
          React.createElement(table.component, props),
        ),
      );
    const editing = render(false);
    assert.doesNotMatch(editing, /ant-table-tbody-virtual/);
    assert.doesNotMatch(editing, /max-height:240px/);
    assert.doesNotMatch(editing, /ant-table-cell-fix-start/);
    assert.match(editing, /Record 20/);
    assert.doesNotMatch(editing, /Record 21/);
    const preview = render(true);
    assert.match(preview, /ant-table-tbody-virtual/);
    assert.deepEqual(props.scroll, savedScroll);
    assert.equal(props.virtual, true);
    assert.equal(props.pagination.defaultPageSize, 20);
  }
});

test("full page height view renders every row in Studio, keeping horizontal scroll, fixed columns and saved props", () => {
  const table = components.get("plasmic-antd6-table")!;
  const props = {
    data: {
      data: Array.from({ length: 41 }, (_, i) => ({
        id: i + 1,
        name: `Record ${i + 1}`,
      })),
    },
    rowKey: "id",
    columns: [{ title: "Name", dataIndex: "name", width: 240, fixed: "left" }],
    scroll: { x: 1200, y: 240 },
    virtual: true,
    pagination: false,
    __plasmic_selection_prop__: { isFullContentView: true },
  };
  const savedScroll = { ...props.scroll };
  const render = (interactive: boolean, extra: object = {}) =>
    renderToStaticMarkup(
      React.createElement(
        PlasmicCanvasContext.Provider,
        { value: { componentName: "Test", globalVariants: {}, interactive } },
        React.createElement(table.component, { ...props, ...extra }),
      ),
    );
  const full = render(false);
  assert.doesNotMatch(full, /ant-table-tbody-virtual/);
  assert.doesNotMatch(full, /max-height:240px/);
  assert.match(full, /Record 41/);
  assert.match(full, /ant-table-cell-fix-start/);
  assert.match(full, /width:1200px/);
  // Interactive mode and the ordinary viewport view keep the runtime behavior.
  assert.match(render(true), /ant-table-tbody-virtual/);
  assert.match(
    render(false, { __plasmic_selection_prop__: { isFullContentView: false } }),
    /ant-table-tbody-virtual/,
  );
  assert.deepEqual(props.scroll, savedScroll);
  assert.equal(props.virtual, true);
});
