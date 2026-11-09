import { ModelFieldSelector } from "@/wab/client/stores/model-field-selector";
import type { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { isBaseVariantName } from "@/wab/shared/Variants";
import { summarizeTpl } from "@/wab/shared/core/tpls";
import { Component, Expr, TplNode, isKnownCompositeExpr, isKnownCustomCode, isKnownTemplatedString, isKnownTplComponent, isKnownTplSlot, isKnownTplTag } from "@/wab/shared/model/classes";
import * as React from "react";

/** The inspector title reads labels, never a component's full structure key. */
export function createInspectorTitleInputs(studio: StudioCtx, tpl: TplNode | null | undefined, component: Component | undefined) {
  const models = studio.modelSnapshots;
  return new ModelFieldSelector(studio, (read) => {
    if (!tpl) { return component ? read(component, "name") : undefined; }
    if (isKnownTplComponent(tpl) || isKnownTplTag(tpl)) {
      const name = read(tpl, "name");
      if (name) { return name; }
    }
    if (isKnownTplComponent(tpl)) {
      const target = models.resolve(read(tpl, "component"));
      read(target, "name");
      const meta = read(target, "codeComponentMeta");
      if (meta) { read(models.resolve(meta), "displayName"); }
    } else if (isKnownTplSlot(tpl)) {
      const param = models.resolve(read(tpl, "param"));
      read(models.resolve(read(param, "variable")), "name");
    } else if (isKnownTplTag(tpl)) {
      read(tpl, "type");
      if (read(tpl, "tag") === "input") {
        const literal = (expr: Expr) => {
          if (isKnownCustomCode(expr)) { read(expr, "code"); }
          else if (isKnownTemplatedString(expr)) { read(expr, "text"); }
          else if (isKnownCompositeExpr(expr)) {
            read(expr, "hostLiteral");
            Object.values(read(expr, "substitutions")).forEach((ref) => literal(models.resolve(ref)));
          }
        };
        for (const ref of read(tpl, "vsettings")) {
          const setting = models.resolve(ref);
          const variants = read(setting, "variants");
          if (variants.length === 1 && isBaseVariantName(read(models.resolve(variants[0]), "name"))) {
            const type = read(setting, "attrs").type;
            if (type) { literal(models.resolve(type)); }
            break;
          }
        }
      }
    }
    return summarizeTpl(tpl);
  });
}

export function useInspectorTitle(studio: StudioCtx, tpl: TplNode | null | undefined, component: Component | undefined) {
  const source = React.useMemo(() => createInspectorTitleInputs(studio, tpl, component), [studio, tpl, component]);
  return React.useSyncExternalStore(source.subscribe, source.getSnapshot, source.getSnapshot);
}
