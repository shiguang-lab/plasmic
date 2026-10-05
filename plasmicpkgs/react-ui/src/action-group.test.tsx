import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  ActionGroup,
  actionGroupMeta,
  registerActionGroup,
} from "./registerActionGroup";

test("registers only ActionGroup from React UI with editable items and action keys", () => {
  const names: string[] = [];
  registerActionGroup({
    registerComponent(component, meta) {
      names.push(meta.name);
      assert.equal(component, ActionGroup);
      assert.equal(meta, actionGroupMeta);
    },
  });
  assert.deepEqual(names, ["plasmic-react-ui-action-group"]);
  assert.equal((actionGroupMeta.props.onAction as any).argTypes[0].name, "key");
  assert.deepEqual((actionGroupMeta.props.moreButtonSize as any).options, [
    "small",
    "medium",
    "large",
  ]);
});

const detail = { key: "detail", label: "详情" };
const edit = { key: "edit", label: "编辑" };
const sql = { key: "sql", label: "编辑 SQL" };
const copy = { key: "copy", label: "复制" };

test("filters denied actions before folding and removes More at the exact limit", () => {
  const html = renderToStaticMarkup(
    <ActionGroup max={3} items={[detail, false, null, undefined, edit, sql]} />,
  );
  for (const text of ["详情", "编辑", "编辑 SQL"]) {
    assert(html.includes(text));
  }
  assert(!html.includes("更多"));
  assert.equal(renderToStaticMarkup(<ActionGroup items={[false, null]} />), "");
});

test("More occupies one position when actions exceed max", () => {
  const folded = renderToStaticMarkup(
    <ActionGroup items={[detail, edit, sql, copy]} max={3} />,
  );
  assert(
    folded.includes("详情") &&
      folded.includes("编辑") &&
      folded.includes("更多"),
  );
  assert(!folded.includes("编辑 SQL") && !folded.includes("复制"));
});

test("supports children when items are absent and keeps disabled/danger item props", () => {
  assert(
    renderToStaticMarkup(
      <ActionGroup>
        <button>自定义操作</button>
      </ActionGroup>,
    ).includes("自定义操作"),
  );
  const html = renderToStaticMarkup(
    <ActionGroup
      items={[{ key: "delete", label: "删除", danger: true, disabled: true }]}
    />,
  );
  assert(html.includes("disabled") && html.includes("dangerous"));
});

test("uses Plasmic links for item navigation and keeps disabled links inert", () => {
  const enabled = renderToStaticMarkup(
    <ActionGroup items={[{ ...detail, href: "/groups/1001" }]} />,
  );
  assert(enabled.includes('href="/groups/1001"'));
  const disabled = renderToStaticMarkup(
    <ActionGroup
      items={[{ ...detail, href: "/groups/1001", disabled: true }]}
    />,
  );
  assert(!disabled.includes('href="/groups/1001"'));
});
