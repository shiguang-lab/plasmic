import { DocsPortalCtx } from "@/wab/client/components/docs/DocsPortalCtx";
import { formatDocsCode } from "@/wab/client/components/docs/serialize-docs-preview";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { TplMgr, VariantOptionsType } from "@/wab/shared/TplMgr";
import { ensure } from "@/wab/shared/common";
import { ComponentType } from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { mkImageAsset } from "@/wab/shared/core/image-assets";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import { ensureKnownTplTag } from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";
import { parse } from "@babel/parser";
import * as t from "@babel/types";
import { act, cleanup, render } from "@testing-library/react";
import React from "react";
import { mockDeep } from "vitest-mock-extended";
import { useStore } from "zustand";

function fixture() {
  const site = createSite();
  const mgr = new TplMgr({ site });
  const first = mgr.addComponent({ name: "First", type: ComponentType.Plain });
  const second = mgr.addComponent({
    name: "Second",
    type: ComponentType.Plain,
  });
  const param = mkParam({
    name: "caption",
    paramType: "prop",
    type: typeFactory.text(),
  });
  first.params.push(param);
  const studio = mockDeep<StudioCtx>({ site });
  studio.appCtx.api.addStorageItem.mockResolvedValue(undefined);
  const ctx = new DocsPortalCtx(studio);
  return { ctx, first, second, param, studio };
}
afterEach(cleanup);

it("publishes no equal code writes and preserves unrelated resource snapshots", () => {
  const { ctx, first, second } = fixture();
  const current = ctx.getComponentStore(first);
  const other = ctx.getComponentStore(second);
  const before = other.getState();
  const change = vi.fn();
  const unrelated = vi.fn();
  const off = current.subscribe(change),
    offOther = other.subscribe(unrelated);
  ctx.setComponentCustomCode(first, "<First />");
  const saved = current.getState();
  for (let i = 0; i < 100; i++) {
    ctx.setComponentCustomCode(first, "<First />");
  }
  expect(current.getState()).toBe(saved);
  expect(change).toHaveBeenCalledOnce();
  expect(unrelated).not.toHaveBeenCalled();
  expect(other.getState()).toBe(before);
  off();
  offOther();
});

it("keeps selection and controls unsubscribed from code, hover and other-resource updates", () => {
  const { ctx, first, second, param } = fixture();
  const selection = vi.fn(),
    control = vi.fn(),
    code = vi.fn();
  function Selection() {
    return (
      <output>
        {useStore(ctx.store, (state) => state.focusedComponent)?.name}
      </output>
    );
  }
  function Control() {
    return (
      <output>
        {String(
          useStore(ctx.getComponentStore(first), (state) =>
            state.toggles.get(param),
          ),
        )}
      </output>
    );
  }
  function Code() {
    return (
      <output>
        {useStore(ctx.getComponentStore(first), (state) => state.code)}
      </output>
    );
  }
  render(
    <>
      <React.Profiler id="selection" onRender={selection}>
        <Selection />
      </React.Profiler>
      <React.Profiler id="control" onRender={control}>
        <Control />
      </React.Profiler>
      <React.Profiler id="code" onRender={code}>
        <Code />
      </React.Profiler>
    </>,
  );
  selection.mockClear();
  control.mockClear();
  code.mockClear();
  act(() => {
    ctx.setComponentCustomCode(first, "<First />");
  });
  expect(code).toHaveBeenCalledOnce();
  expect(control).not.toHaveBeenCalled();
  expect(selection).not.toHaveBeenCalled();
  code.mockClear();
  act(() => {
    ctx.setFocusedElement(ensureKnownTplTag(first.tplTree));
    ctx.setComponentCustomCode(second, "<Second />");
  });
  expect(code).not.toHaveBeenCalled();
  expect(control).not.toHaveBeenCalled();
  expect(selection).not.toHaveBeenCalled();
});

it("binds preview inputs only to the selected resource and mode, releasing them on cleanup", () => {
  const { ctx, first, second } = fixture();
  const update = vi.fn();
  const off = ctx.subscribePreviewInputs(first, update);
  ctx.setFocusedElement(ensureKnownTplTag(first.tplTree));
  ctx.setComponentCustomCode(second, "<Second />");
  expect(update).not.toHaveBeenCalled();
  ctx.setComponentCustomCode(first, "<First />");
  expect(update).toHaveBeenCalledOnce();
  off();
  update.mockClear();
  ctx.setComponentCustomCode(first, "<First caption='changed' />");
  ctx.setCodegenType("codegen");
  expect(update).not.toHaveBeenCalled();
});

it("persists mode once and does not clear edited code when the mode is unchanged", () => {
  const { ctx, first, studio } = fixture();
  ctx.setComponentCustomCode(first, "<First caption='edited' />");
  const before = ctx.getComponentStore(first).getState();
  for (let i = 0; i < 100; i++) {
    ctx.setCodegenType("loader");
  }
  expect(ctx.getComponentStore(first).getState()).toBe(before);
  expect(studio.appCtx.api.addStorageItem).toHaveBeenCalledTimes(1);
  ctx.setCodegenType("codegen");
  expect(ctx.getComponentCustomCode(first)).toBeUndefined();
  expect(studio.appCtx.api.addStorageItem).toHaveBeenCalledTimes(2);
});

it("does not retain mutable toggle maps when controls are reset", async () => {
  const { ctx, first, param } = fixture();
  ctx.setFocusedComponent(first);
  ctx.setComponentToggle(first, param, "customer");
  const before = ctx.getComponentStore(first).getState();
  expect(before.toggles.get(param)).toBe("customer");
  expect(before.code).toContain("customer");
  ctx.resetComponentToggles(first);
  expect(ctx.getComponentStore(first).getState().toggles.size).toBe(0);
  expect(ctx.getComponentCustomCode(first)).toBeUndefined();
  expect(before.toggles.get(param)).toBe("customer");
  await Promise.resolve();
  expect(ctx.getComponentCustomCode(first)).toBeUndefined();
});

function argument(code: string | undefined, name: string) {
  const statement = parse(ensure(code, "Missing code"), {
    plugins: ["jsx", "typescript"],
  }).program.body[0];
  if (
    !t.isExpressionStatement(statement) ||
    !t.isJSXElement(statement.expression)
  ) {
    throw new Error("Expected JSX expression");
  }
  const attrs = statement.expression.openingElement.attributes;
  const directAttribute = attrs.find(
    (attr) => t.isJSXAttribute(attr) && t.isJSXIdentifier(attr.name, { name }),
  );
  if (
    t.isJSXAttribute(directAttribute) &&
    t.isJSXExpressionContainer(directAttribute.value)
  ) {
    return directAttribute.value.expression;
  }
  if (
    t.isJSXAttribute(directAttribute) &&
    t.isStringLiteral(directAttribute.value)
  ) {
    return directAttribute.value;
  }
  const props = attrs.find(
    (attr) =>
      t.isJSXAttribute(attr) &&
      t.isJSXIdentifier(attr.name, { name: "componentProps" }),
  );
  if (
    t.isJSXAttribute(props) &&
    t.isJSXExpressionContainer(props.value) &&
    t.isObjectExpression(props.value.expression)
  ) {
    const field = props.value.expression.properties.find(
      (prop) =>
        t.isObjectProperty(prop) &&
        (t.isIdentifier(prop.key, { name }) ||
          t.isStringLiteral(prop.key, { value: name })),
    );
    if (t.isObjectProperty(field)) {
      return field.value;
    }
  }
  return undefined;
}

it.each(["loader", "codegen"] as const)(
  "keeps false, zero and empty strings in %s code while publishing controls atomically",
  (mode) => {
    const { ctx, first, param } = fixture();
    ctx.setCodegenType(mode);
    ctx.setFocusedComponent(first);
    const enabled = mkParam({
      name: "enabled",
      paramType: "prop",
      type: typeFactory.bool(),
    });
    const count = mkParam({
      name: "count",
      paramType: "prop",
      type: typeFactory.num(),
    });
    first.params.push(enabled, count);
    const off = ctx.getComponentStore(first).subscribe((state) => {
      for (const [key, value] of state.toggles) {
        const node = argument(state.code, key.variable.name);
        expect(
          t.isStringLiteral(node) ||
            t.isBooleanLiteral(node) ||
            t.isNumericLiteral(node),
        ).toBe(true);
        if (
          t.isStringLiteral(node) ||
          t.isBooleanLiteral(node) ||
          t.isNumericLiteral(node)
        ) {
          expect(node.value).toBe(value);
        }
      }
    });
    ctx.setComponentToggle(first, enabled, false);
    ctx.setComponentToggle(first, count, 0);
    ctx.setComponentToggle(first, param, "");
    expect(
      argument(ctx.getComponentCustomCode(first), "enabled"),
    ).toMatchObject({ type: "BooleanLiteral", value: false });
    expect(argument(ctx.getComponentCustomCode(first), "count")).toMatchObject({
      type: "NumericLiteral",
      value: 0,
    });
    expect(
      argument(ctx.getComponentCustomCode(first), "caption"),
    ).toMatchObject({ type: "StringLiteral", value: "" });
    const before = ctx.getComponentStore(first).getState();
    ctx.setComponentToggle(first, enabled, false);
    expect(ctx.getComponentStore(first).getState()).toBe(before);
    off();
  },
);

it("keeps icon resets, code and other icon subscriptions isolated", () => {
  const { ctx } = fixture();
  const icon = mkImageAsset({
    name: "Alert",
    type: ImageAssetType.Icon,
    dataUri: "data:image/svg+xml,<svg/>",
  });
  const other = mkImageAsset({
    name: "Info",
    type: ImageAssetType.Icon,
    dataUri: "data:image/svg+xml,<svg/>",
  });
  const untouched = ctx.getIconStore(other).getState();
  ctx.setFocusedIcon(icon);
  ctx.setIconToggle(icon, "title", "Warning");
  const before = ctx.getIconStore(icon).getState();
  const change = vi.fn();
  const off = ctx.getIconStore(icon).subscribe(change);
  ctx.setIconToggle(icon, "title", "Warning");
  expect(ctx.getIconStore(icon).getState()).toBe(before);
  expect(change).not.toHaveBeenCalled();
  ctx.setIconCustomCode(icon, "<AlertIcon />");
  expect(ctx.getIconStore(icon).getState().toggles).toBe(before.toggles);
  ctx.resetIconToggles(icon);
  expect(ctx.getIconStore(icon).getState()).toEqual({
    code: undefined,
    toggles: new Map(),
  });
  expect(before.toggles.get("title")).toBe("Warning");
  expect(ctx.getIconStore(other).getState()).toBe(untouched);
  expect(ctx.tryGetFocusedComponent()).toBeUndefined();
  expect(ctx.tryGetFocusedIcon()).toBe(icon);
  off();
});

it.each(["loader", "codegen"] as const)(
  "reconciles equal controls with manually edited %s code, then skips redundant publications",
  async (mode) => {
    const { ctx, first, param } = fixture();
    ctx.setCodegenType(mode);
    ctx.setFocusedComponent(first);
    ctx.setComponentToggle(first, param, "chosen");
    await vi.waitFor(() =>
      expect(ctx.getComponentCustomCode(first)).toContain("chosen"),
    );
    ctx.setComponentCustomCode(
      first,
      ensure(ctx.getComponentCustomCode(first), "generated code").replace(
        "chosen",
        "typed",
      ),
    );
    expect(ctx.getComponentToggle(first, param)).toBe("chosen");
    ctx.setComponentToggle(first, param, "chosen");
    expect(ctx.getComponentCustomCode(first)).toContain("chosen");
    expect(ctx.getComponentCustomCode(first)).not.toContain("typed");
    // Let the asynchronous formatter settle before testing the no-op boundary.
    const expected = await formatDocsCode(
      ensure(ctx.getComponentCustomCode(first), "repaired code"),
    );
    await vi.waitFor(() =>
      expect(ctx.getComponentCustomCode(first)).toBe(expected),
    );
    const store = ctx.getComponentStore(first);
    const before = store.getState();
    const changed = vi.fn();
    const off = store.subscribe(changed);
    for (let i = 0; i < 100; i++)
      {ctx.setComponentToggle(first, param, "chosen");}
    await Promise.resolve();
    expect(store.getState()).toBe(before);
    expect(changed).not.toHaveBeenCalled();
    off();
  },
);

it.each(["loader", "codegen"] as const)(
  "removes a manually inserted %s argument even when its control is already unset",
  (mode) => {
    const { ctx, first, param } = fixture();
    ctx.setCodegenType(mode);
    ctx.setFocusedComponent(first);
    ctx.updateComponentCustomCode(first, ["caption"], "typed", false, param);
    expect(ctx.getComponentToggle(first, param)).toBeUndefined();
    expect(ctx.getComponentCustomCode(first)).toContain("typed");
    ctx.setComponentToggle(first, param, undefined);
    expect(
      argument(ctx.getComponentCustomCode(first), "caption"),
    ).toBeUndefined();
  },
);

it("owns multi-variant selections without retaining the caller's mutable array", async () => {
  const { ctx, first } = fixture();
  const mgr = new TplMgr({ site: ctx.studioCtx.site });
  const group = mgr.createVariantGroup({
    component: first,
    name: "Options",
    optionsType: VariantOptionsType.multiChoice,
  });
  const option = mgr.createVariant(first, group, "Active");
  const other = mgr.createVariant(first, group, "Secondary");
  const selected = [option];
  ctx.setComponentToggle(first, group.param, selected);
  const snapshot = ctx.getComponentStore(first).getState();
  selected.push(other);
  expect(snapshot.toggles.get(group.param)).toEqual([option]);
  ctx.setComponentToggle(first, group.param, selected);
  expect(snapshot.toggles.get(group.param)).toEqual([option]);
  expect(ctx.getComponentToggle(first, group.param)).toEqual([option, other]);
});
