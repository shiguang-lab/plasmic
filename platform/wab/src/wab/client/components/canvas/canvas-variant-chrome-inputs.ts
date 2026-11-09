import type { CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { isCodeComponentVariant } from "@/wab/shared/Variants";
import { isKnownGlobalVariantSplitContent, isKnownTplComponent, isKnownTplTag, isKnownCustomCode, isKnownTemplatedString, isKnownCompositeExpr, type Component, type Site, type TplNode, type Variant, type VariantGroup, type Expr } from "@/wab/shared/model/classes";

/** Membership, labels and classification read by the variants canvas chrome. */
export function canvasVariantChromeFields(site: Site, component: Component | undefined, tpl: TplNode | null | undefined, field: Parameters<CanvasViewFieldRecipe>[0], drawer = false) {
  const variants = new Set<Variant>(), groups = new Set<VariantGroup>(), components = new Set<Component>();
  const variant = (value: Variant) => {
    if (variants.has(value)) { return; } variants.add(value);
    field(value, "name", "selectors", "parent", "forTpl", "mediaQuery", "codeComponentName", "codeComponentVariantKeys");
    if (value.parent) { group(value.parent); }
  };
  const group = (value: VariantGroup) => {
    if (groups.has(value)) { return; } groups.add(value);
    field(value, "variants", "multi", "param", "type"); field(value.param, "variable"); field(value.param.variable, "name");
    value.variants.forEach(variant);
  };
  const ownComponent = (value: Component) => {
    if (components.has(value)) { return; } components.add(value);
    field(value, "variants", "variantGroups", "superComp", "name", "type", "tplTree");
    value.variants.forEach(variant); value.variantGroups.forEach(group);
    if (value.superComp) { ownComponent(value.superComp); }
  };
  field(site, "globalVariantGroups", "activeScreenVariantGroup", "projectDependencies");
  site.globalVariantGroups.forEach(group);
  site.projectDependencies.forEach((dependency) => { field(dependency, "site"); field(dependency.site, "globalVariantGroups"); dependency.site.globalVariantGroups.forEach(group); });
  if (component) { ownComponent(component); }
  if (tpl) {
    field(tpl, "parent");
    if (isKnownTplTag(tpl)) {
      field(tpl, "name", "tag", "type", "vsettings");
      if (tpl.tag === "input") {
        const expression = (expr: Expr) => {
          if (isKnownCustomCode(expr)) { field(expr, "code"); }
          else if (isKnownTemplatedString(expr)) { field(expr, "text"); }
          else if (isKnownCompositeExpr(expr)) { field(expr, "hostLiteral", "substitutions"); Object.values(expr.substitutions).forEach(expression); }
        };
        tpl.vsettings.forEach((setting) => { field(setting, "variants", "attrs"); if (setting.attrs.type) { expression(setting.attrs.type); } });
      }
    }
  }
  if (!drawer) { return; }
  field(site, "splits");
  site.splits.forEach((split) => { field(split, "slices"); split.slices.forEach((slice) => { field(slice, "contents"); slice.contents.forEach((content) => { if (isKnownGlobalVariantSplitContent(content)) { field(content, "group"); } }); }); });
  const codeVariants = [...variants].filter(isCodeComponentVariant);
  if (!codeVariants.length) { return; }
  field(site, "components");
  site.components.forEach((value) => {
    field(value, "variants");
    const relevant = codeVariants.filter((candidate) => value.variants.includes(candidate));
    if (!relevant.length) { return; }
    field(value, "tplTree"); const root = value.tplTree;
    if (!isKnownTplComponent(root)) { return; }
    field(root, "component"); field(root.component, "type", "codeComponentMeta");
    const meta = root.component.codeComponentMeta;
    if (!meta) { return; } field(meta, "variants");
    relevant.forEach((candidate) => candidate.codeComponentVariantKeys?.forEach((key) => { if (meta.variants[key]) { field(meta.variants[key], "displayName"); } }));
  });
}

export function canvasVariantFrameFields(view: import("@/wab/client/studio-ctx/view-ctx").ViewCtx, field: Parameters<CanvasViewFieldRecipe>[0]) {
  const frame = view.arenaFrame();
  field(frame, "container", "width", "targetVariants", "pinnedVariants", "targetGlobalVariants", "pinnedGlobalVariants");
  field(frame.container, "component");
  const arena = view.studioCtx.currentArena;
  if (arena && ("matrix" in arena)) {
    field(arena, "matrix", "customMatrix");
    [arena.matrix, arena.customMatrix].forEach((matrix) => { field(matrix, "rows"); matrix.rows.forEach((row) => { field(row, "cols", "rowKey"); row.cols.forEach((cell) => field(cell, "cellKey")); }); });
  }
}
