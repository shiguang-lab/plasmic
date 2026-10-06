import { buildValTree, TEST_GLOBAL_VARIANT } from "@/wab/__testonly__/tpls";
import {
  editTableColumnTemplate,
  getTableColumnSelectionTarget,
} from "@/wab/client/components/canvas/table-column-editing";
import {
  createTplMgr,
  createVariantTplMgr,
} from "@/wab/shared/__testonly__/site-tests-utils";
import { mkCodeComponent } from "@/wab/shared/code-components/code-components";
import { ensure, ensureInstance } from "@/wab/shared/common";
import { ComponentType, mkComponent } from "@/wab/shared/core/components";
import { mkParam } from "@/wab/shared/core/lang";
import { createSite } from "@/wab/shared/core/sites";
import {
  flattenTpls,
  mkSlot,
  mkTplComponent,
  mkTplTagX,
} from "@/wab/shared/core/tpls";
import { ValComponent, ValTag } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import {
  CustomCode,
  ensureKnownCustomCode,
  ensureKnownSlotParam,
  isKnownExprText,
  RenderExpr,
} from "@/wab/shared/model/classes";
import { typeFactory } from "@/wab/shared/model/model-util";

function setup() {
  const site = createSite();
  const codeComponent = (
    name: string,
    propNames: string[],
    slots: string[] = [],
  ) => {
    const component = mkCodeComponent(
      name,
      { name, importPath: "@shiguang-lab/plasmic-antd6", props: {} },
      {},
    );
    component.params.push(
      ...propNames.map((propName) =>
        mkParam({
          name: propName,
          paramType: "prop",
          type: typeFactory.text(),
        }),
      ),
      ...slots.map((slotName) =>
        mkParam({
          name: slotName,
          paramType: "slot",
          type: typeFactory.renderable(),
        }),
      ),
    );
    site.components.push(component);
    return component;
  };
  const columnComponent = codeComponent(
    "plasmic-antd6-table-column",
    ["displayType"],
    ["render"],
  );
  codeComponent("plasmic-antd6-tag", ["color"], ["children"]);
  codeComponent("plasmic-antd6-button", ["size"], ["children"]);
  codeComponent("plasmic-antd6-avatar", ["src", "alt", "size"]);
  codeComponent("plasmic-antd6-image", ["src", "alt", "width", "height"]);
  const owner = mkComponent({
    name: "Test",
    type: ComponentType.Plain,
    tplTree: (baseVariant) => mkTplTagX("div", { baseVariant }),
  });
  site.components.push(owner);
  const vtm = createVariantTplMgr(site, createTplMgr(site), owner);
  const column = vtm.mkTplComponentWithDefaults(columnComponent);
  owner.tplTree = column;
  return { site, vtm, column };
}

function evaluate(expr: CustomCode, cell: unknown, tagValue?: unknown) {
  return new Function("cell", "tagValue", `return ${expr.code}`)(
    cell,
    tagValue,
  );
}

test.each(["text", "tag", "link", "avatar", "image", "button", "custom"])(
  "%s converts to an authored template that reopens without duplication",
  (displayType) => {
    const { site, vtm, column } = setup();
    const node = editTableColumnTemplate(vtm, site, column, { displayType });
    const render = ensure(
      vtm
        .ensureBaseVariantSetting(column)
        .args.find((arg) => arg.param.variable.name === "render"),
      "render argument",
    ).expr;
    expect(render).toBeInstanceOf(RenderExpr);
    expect(
      editTableColumnTemplate(vtm, site, column, { displayType: "custom" }),
    ).toBe(node);
    expect(node.parent).toBe(column);
    expect(
      ensureKnownCustomCode(
        ensure(
          vtm
            .ensureBaseVariantSetting(column)
            .args.find((arg) => arg.param.variable.name === "displayType"),
          "display type",
        ).expr,
      ).code,
    ).toBe('"custom"');
  },
);

test("Tag templates retain value mappings, arrays and stable automatic colors", () => {
  const { site, vtm, column } = setup();
  const node = editTableColumnTemplate(vtm, site, column, {
    displayType: "tag",
    tagOptions: [{ value: "pending", label: "待处理", color: "orange" }],
  });
  const setting = vtm.ensureBaseVariantSetting(node);
  const color = ensureKnownCustomCode(
    ensure(
      setting.args.find((arg) => arg.param.variable.name === "color"),
      "color",
    ).expr,
  );
  expect(evaluate(color, "pending", "pending")).toBe("orange");
  expect(evaluate(color, "done", "done")).toBe(
    evaluate(color, ["pending", "done"], "done"),
  );
  expect(
    evaluate(
      ensureKnownCustomCode(
        ensure(setting.dataRep, "tag repetition").collection,
      ),
      [0, false, null],
    ),
  ).toEqual([0, false]);
  const label = flattenTpls(node)
    .flatMap((tpl) => tpl.vsettings.map((vs) => vs.text))
    .find(isKnownExprText);
  expect(
    evaluate(
      ensureKnownCustomCode(ensure(label, "label").expr),
      "pending",
      "pending",
    ),
  ).toBe("待处理");
});

test("a newly selected preset replaces the previous custom template on entry", () => {
  const { site, vtm, column } = setup();
  const text = editTableColumnTemplate(vtm, site, column, {
    displayType: "text",
  });
  const tag = editTableColumnTemplate(vtm, site, column, {
    displayType: "tag",
  });
  expect(tag).not.toBe(text);
  expect(tag.parent).toBe(column);
});

test.each(["link", "avatar", "image"])(
  "%s templates keep empty cells blank",
  (displayType) => {
    const { site, vtm, column } = setup();
    const node = editTableColumnTemplate(vtm, site, column, { displayType });
    const condition = ensureKnownCustomCode(
      ensure(vtm.ensureBaseVariantSetting(node).dataCond, "condition"),
    );
    expect(evaluate(condition, null)).toBe(false);
    expect(evaluate(condition, "")).toBe(false);
    expect(evaluate(condition, "https://example.com/image.png")).toBe(true);
  },
);

test("Avatar templates preserve numeric size and alternative text", () => {
  const { site, vtm, column } = setup();
  const node = editTableColumnTemplate(vtm, site, column, {
    displayType: "avatar",
    contentSize: 48,
    displayLabel: "用户头像",
  });
  const args = vtm.ensureBaseVariantSetting(node).args;
  const value = (name: string) =>
    ensureKnownCustomCode(
      ensure(
        args.find((arg) => arg.param.variable.name === name),
        name,
      ).expr,
    );
  expect(evaluate(value("size"), "avatar.png")).toBe(48);
  expect(evaluate(value("alt"), "avatar.png")).toBe("用户头像");
});

test("hover and click target the column until its template is entered", () => {
  const { column, vtm, site } = setup();
  const render = ensure(
    column.component.params.find((p) => p.variable.name === "render"),
    "render slot",
  );
  column.component.tplTree = mkSlot(ensureKnownSlotParam(render), []);
  editTableColumnTemplate(vtm, site, column, { displayType: "text" });
  const otherColumn = vtm.mkTplComponentWithDefaults(column.component);
  editTableColumnTemplate(vtm, site, otherColumn, { displayType: "text" });
  const page = mkComponent({
    name: "Page",
    type: ComponentType.Plain,
    tplTree: () => mkTplTagX("div", {}, [column, otherColumn]),
  });
  const root = buildValTree(mkTplComponent(page, TEST_GLOBAL_VARIANT));
  const valState = new ValState({ sysRoot: root, globalRoot: root });
  const body = ensureInstance(
    ensure(root.contents, "page contents")[0],
    ValTag,
  );
  const first = ensureInstance(body.children[0], ValComponent);
  const second = ensureInstance(body.children[1], ValComponent);
  const content = ensure(first.slotArgs.get(render)?.[0], "first template");
  const otherContent = ensure(
    second.slotArgs.get(render)?.[0],
    "other template",
  );

  expect(getTableColumnSelectionTarget(content, valState, undefined)).toBe(
    first,
  );
  expect(getTableColumnSelectionTarget(content, valState, column)).toBe(
    content,
  );
  expect(getTableColumnSelectionTarget(otherContent, valState, column)).toBe(
    second,
  );
  expect(getTableColumnSelectionTarget(first, valState, column)).toBe(first);
  expect(getTableColumnSelectionTarget(body, valState, column)).toBe(body);
});
