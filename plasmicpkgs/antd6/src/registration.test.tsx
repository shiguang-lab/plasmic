import assert from "node:assert/strict";
import { test } from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
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
        for (const name of prop.allowedComponents)
          assert(components.has(name), `Missing slot component ${name}`);
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
