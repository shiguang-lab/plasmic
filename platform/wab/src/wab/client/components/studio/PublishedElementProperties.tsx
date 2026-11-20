import { useI18n } from "@/wab/client/i18n";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getRealParams } from "@/wab/shared/core/components";
import { getRawCode, summarizeExpr } from "@/wab/shared/core/exprs";
import {
  isTplComponent,
  isTplVariantable,
  summarizeTpl,
} from "@/wab/shared/core/tpls";
import {
  type Expr,
  type TplNode,
  isKnownCollectionExpr,
  isKnownCompositeExpr,
  isKnownEventHandler,
  isKnownExprText,
  isKnownMapExpr,
  isKnownRawText,
  isKnownRenderExpr,
  isKnownStyleExpr,
} from "@/wab/shared/model/classes";
import { Scrollbar } from "@shiguang2/components/esm/scrollbar";
import { Descriptions } from "antd";
import React from "react";

export function PublishedElementProperties({
  view,
  tpl,
}: {
  view: ViewCtx;
  tpl: TplNode;
}) {
  "use no memo";
  const { t } = useI18n();
  useViewVariants(view, (state) => state);
  if (!isTplVariantable(tpl)) {
    return null;
  }
  const setting = view.variantTplMgr().effectiveVariantSetting(tpl);
  const ctx = {
    component: view.currentComponent(),
    projectFlags: view.studioCtx.projectFlags(),
    inStudio: true,
    projectId: view.studioCtx.siteInfo.id,
  };
  function describe(expr: Expr): string {
    if (isKnownRenderExpr(expr)) {
      return expr.tpl
        .map((node) => {
          const text = isTplVariantable(node)
            ? view.variantTplMgr().effectiveVariantSetting(node).text
            : undefined;
          if (isKnownRawText(text)) {
            return text.text;
          }
          if (isKnownExprText(text)) {
            return describe(text.expr);
          }
          return ("name" in node && node.name) || summarizeTpl(node);
        })
        .join(", ");
    }
    if (isKnownStyleExpr(expr)) {
      return expr.styles
        .map(({ selector, rs }) =>
          [
            selector,
            ...Object.entries(rs.values).map(
              ([key, value]) => `${key}: ${value}`,
            ),
          ]
            .filter(Boolean)
            .join("\n"),
        )
        .join("\n");
    }
    if (isKnownEventHandler(expr)) {
      return expr.interactions
        .map(
          (step) =>
            `${step.interactionName} (${step.actionName})\n${step.args.map((arg) => `${arg.name}: ${describe(arg.expr)}`).join("\n")}`,
        )
        .join("\n");
    }
    if (
      isKnownCompositeExpr(expr) ||
      isKnownCollectionExpr(expr) ||
      isKnownMapExpr(expr)
    ) {
      return getRawCode(expr, ctx);
    }
    return summarizeExpr(expr, ctx);
  }
  const props = Object.entries(setting.attrs).map(([name, expr]) => [
    name,
    describe(expr),
  ]);
  if (isTplComponent(tpl)) {
    const args = new Map(setting.args.map((arg) => [arg.param, arg.expr]));
    for (const param of getRealParams(tpl.component, {
      includeSlots: true,
      includeVariants: true,
    })) {
      const expr = args.get(param) ?? param.defaultExpr;
      if (expr) {
        props.push([param.displayName || param.variable.name, describe(expr)]);
      }
    }
  }
  if (isKnownRawText(setting.text)) {
    props.push([t("Text"), setting.text.text]);
  } else if (isKnownExprText(setting.text)) {
    props.push([t("Text"), describe(setting.text.expr)]);
  }
  if (setting.dataCond) {
    props.push([t("Condition"), describe(setting.dataCond)]);
  }
  if (setting.dataRep) {
    props.push([t("Repeat"), describe(setting.dataRep.collection)]);
  }
  const rules = setting.rsh();
  const sections = [
    { title: t("Props"), rows: props },
    {
      title: t("Design"),
      rows: rules.props().map((name) => [name, rules.get(name)]),
    },
  ];
  return (
    <Scrollbar scrollX={false} style={{ flex: 1, minHeight: 0 }}>
      <div style={{ padding: 12 }}>
        {sections
          .filter((section) => section.rows.length)
          .map(({ title, rows }) => (
            <Descriptions
              key={title}
              title={title}
              size="small"
              column={1}
              styles={{
                content: { whiteSpace: "pre-wrap", overflowWrap: "anywhere" },
              }}
              items={rows.map(([label, value], index) => ({
                key: index,
                label,
                children: value,
              }))}
            />
          ))}
      </div>
    </Scrollbar>
  );
}
