import { VariantTplMgr } from "@/wab/shared/VariantTplMgr";
import { ensure } from "@/wab/shared/common";
import { getParamByVarName } from "@/wab/shared/core/components";
import { codeLit } from "@/wab/shared/core/exprs";
import { SQ, Selectable } from "@/wab/shared/core/selection";
import { allComponents } from "@/wab/shared/core/sites";
import { mkRep } from "@/wab/shared/core/tpls";
import { ValComponent } from "@/wab/shared/core/val-nodes";
import { ValState } from "@/wab/shared/eval/val-state";
import {
  CustomCode,
  ExprText,
  RenderExpr,
  Site,
  TplComponent,
  TplNode,
  isKnownRenderExpr,
  isKnownTplComponent,
} from "@/wab/shared/model/classes";

export function isTableColumn(tpl: TplNode | undefined): boolean {
  return (
    isKnownTplComponent(tpl) &&
    tpl.component.name === "plasmic-antd6-table-column"
  );
}

export function getTableColumnContaining(
  selectable: Selectable,
  valState: ValState,
) {
  return SQ(selectable, valState)
    .ancestors()
    .toArray()
    .find(
      (ancestor): ancestor is ValComponent =>
        ancestor instanceof ValComponent && isTableColumn(ancestor.tpl),
    );
}

/** Hover and click must resolve to the same column or authored template node. */
export function getTableColumnSelectionTarget(
  selectable: Selectable,
  valState: ValState,
  editingColumn: TplComponent | undefined,
) {
  const column = getTableColumnContaining(selectable, valState);
  return column && column.tpl !== editingColumn ? column : selectable;
}

/** Turn a display preset into ordinary authored nodes in the column's render slot. */
export function editTableColumnTemplate(
  vtm: VariantTplMgr,
  site: Site,
  column: TplComponent,
  props: Record<string, any>,
) {
  const render = ensure(
    getParamByVarName(column.component, "render"),
    "Table column must have a render slot",
  );
  const existing = vtm
    .effectiveVariantSetting(column)
    .args.find((arg) => arg.param === render)?.expr;
  if (
    (props.displayType === "custom" || props.displayType === undefined) &&
    isKnownRenderExpr(existing) &&
    existing.tpl.length
  ) {
    vtm.setArg(
      column,
      ensure(
        getParamByVarName(column.component, "displayType"),
        "Table column must have a display type",
      ).variable,
      codeLit("custom"),
    );
    return existing.tpl[0];
  }
  const expression = (code: string) =>
    new CustomCode({ code: `(${code})`, fallback: codeLit(undefined) });
  const text = (code = 'cell == null ? "" : String(cell)') => {
    const node = vtm.mkTplInlinedText("", "span");
    vtm.ensureBaseVariantSetting(node).text = new ExprText({
      expr: expression(code),
      html: false,
    });
    return node;
  };
  const component = (
    name: string,
    args: Parameters<VariantTplMgr["mkTplComponentX"]>[0]["args"],
  ) =>
    vtm.mkTplComponentX({
      component: ensure(
        allComponents(site, { includeDeps: "all" }).find(
          (c) => c.name === name,
        ),
        `Missing table template component ${name}`,
      ),
      args,
    });
  const label =
    props.displayLabel == null
      ? 'cell == null ? "" : String(cell)'
      : JSON.stringify(props.displayLabel);
  const size = props.contentSize ?? 32;
  let node: TplNode;
  switch (props.displayType) {
    case "tag": {
      const options = JSON.stringify(props.tagOptions ?? []);
      const item = "String(tagValue)";
      const option = `${options}.find(option => option.value === ${item})`;
      const colors =
        '["blue","green","orange","purple","cyan","magenta","red","gold"]';
      node = component("plasmic-antd6-tag", {
        children: new RenderExpr({
          tpl: [text(`(${option})?.label ?? ${item}`)],
        }),
        color: expression(
          `(${option})?.color || ${JSON.stringify(props.tagColor ?? "")} || ${colors}[Array.from(${item}).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 0) % 8]`,
        ),
      });
      vtm.ensureBaseVariantSetting(node).dataRep = mkRep(
        "tagValue",
        expression(
          "(Array.isArray(cell) ? cell : [cell]).filter(value => value != null)",
        ),
      );
      break;
    }
    case "avatar":
      node = component("plasmic-antd6-avatar", {
        src: expression('cell == null ? "" : String(cell)'),
        alt: expression(label),
        size: codeLit(size),
      });
      break;
    case "button":
      node = component("plasmic-antd6-button", {
        size: codeLit("small"),
        children: new RenderExpr({ tpl: [text(label)] }),
      });
      break;
    case "image":
      node = component("plasmic-antd6-image", {
        src: expression('cell == null ? "" : String(cell)'),
        alt: expression(label),
        width: codeLit(size),
        height: codeLit(size),
      });
      break;
    case "link":
      node = vtm.mkTplTagX(
        "a",
        {
          attrs: {
            href: expression('cell == null ? "" : String(cell)'),
            ...(props.openInNewTab
              ? {
                  target: codeLit("_blank"),
                  rel: codeLit("noopener noreferrer"),
                }
              : {}),
          },
        },
        [text(label)],
      );
      break;
    default:
      node = text();
  }
  if (["link", "avatar", "image"].includes(props.displayType)) {
    vtm.ensureBaseVariantSetting(node).dataCond = expression(
      'cell != null && String(cell) !== ""',
    );
  }
  node.parent = column;
  vtm.setArg(column, render.variable, new RenderExpr({ tpl: [node] }));
  vtm.setArg(
    column,
    ensure(
      getParamByVarName(column.component, "displayType"),
      "Table column must have a display type",
    ).variable,
    codeLit("custom"),
  );
  return node;
}
