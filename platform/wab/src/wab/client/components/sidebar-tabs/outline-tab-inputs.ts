import type { CanvasViewFieldRecipe } from "@/wab/client/components/canvas/canvas-view-inputs";
import { canvasVariantChromeFields } from "@/wab/client/components/canvas/canvas-variant-chrome-inputs";
import { getArenaFrameDesc, getArenaFrames, getArenaName, isMixedArena, isPageArena, type AnyArena } from "@/wab/shared/Arenas";
import { getComponentArenaRowLabel } from "@/wab/shared/component-arenas";
import { frameSizeGroups } from "@/wab/shared/responsiveness";
import { ensure, switchType } from "@/wab/shared/common";
import { allComponentVariants } from "@/wab/shared/core/components";
import { getDisplayVariants, isCodeComponentVariant } from "@/wab/shared/Variants";
import { ComponentArena, isKnownTplComponent, type Component, type Site } from "@/wab/shared/model/classes";

/** Display data is captured while the finite model snapshot is being read. */
export function outlineTabPresentation(site: Site, arena: AnyArena | null) {
  const page = isPageArena(arena);
  const arenaName = arena ? getArenaName(arena) : "";
  const groups = switchType(arena)
    .when(ComponentArena, (it) => [
      ...it.matrix.rows.map((row) => ({ groupLabel: getComponentArenaRowLabel(it.component, row), frames: row.cols.map((col) => col.frame), alwaysShowGroupLabel: false })),
      { groupLabel: "Combinations", alwaysShowGroupLabel: true, frames: it.customMatrix.rows[0]?.cols.map((col) => col.frame) ?? [] },
    ])
    .elseUnsafe(() => [{ groupLabel: undefined, alwaysShowGroupLabel: false, frames: getArenaFrames(arena) }]);
  return {
    arenaName,
    groups: groups.map((group) => ({ ...group, frames: group.frames.map((frame) => {
      const preset = frameSizeGroups.find((item) => item.sizes.some(({ width, height }) =>
        (width === frame.width && height === frame.height) || (height === frame.width && width === frame.height),
      ))?.groupName;
      const device = preset === "Phone" ? "Mobile" : preset ?? (frame.width <= 640 ? "Mobile" : frame.width < 1024 ? "Tablet" : "Desktop");
      const variants = page ? getDisplayVariants({ site, frame, isPageArena: true }).map((variant) => variant.displayName).join(" + ") : "";
      const label = page ? `${arenaName} · ${frame.width} × ${frame.height}${variants ? ` · ${variants}` : ""}` : getArenaFrameDesc(ensure(arena, "Expected current arena"), frame, site);
      return { frame, uuid: frame.uuid, device, label };
    }) })),
  };
}

/** Only the labels, size/device choices and overview policy read by OutlineTab. */
export function outlineTabFields(site: Site, arena: AnyArena | null, field: Parameters<CanvasViewFieldRecipe>[0]) {
  field(site, "components", "arenas");
  site.components.forEach((component) => field(component, "type"));
  // Existing overview choice is derived from page-reference membership.
  site.arenas.forEach((item) => {
    field(item, "children");
    item.children.forEach((frame) => { field(frame, "container"); field(frame.container, "component"); field(frame.container.component, "type"); });
  });
  if (!arena) { return; }
  if (isMixedArena(arena)) { field(arena, "name", "children"); }
  else {
    field(arena.component, "name", "tplTree");
    field(arena, "matrix", "customMatrix", "_focusedFrame");
    [arena.matrix, arena.customMatrix].forEach((matrix) => {
      field(matrix, "rows"); matrix.rows.forEach((row) => { field(row, "cols", "rowKey"); });
    });
    const root = arena.component.tplTree;
    field(root, "parent");
    if (isKnownTplComponent(root)) {
      field(root, "component"); field(root.component, "type", "codeComponentMeta");
      if (root.component.codeComponentMeta) { field(root.component.codeComponentMeta, "variants"); }
    }
  }
  const components = new Set<Component>();
  if (!isMixedArena(arena)) { components.add(arena.component); }
  getArenaFrames(arena, true).forEach((frame) => {
    field(frame, "name", "width", "height", "container", "targetVariants", "targetGlobalVariants", "pinnedVariants", "pinnedGlobalVariants");
    field(frame.container, "component"); components.add(frame.container.component);
  });
  components.forEach((component) => canvasVariantChromeFields(site, component, undefined, field));
  const variants = [...components].flatMap((component) => allComponentVariants(component, { includeSuperVariants: true }).filter(isCodeComponentVariant));
  if (!variants.length) { return; }
  // Registered variant labels use the same local registry as makeVariantName.
  site.components.forEach((component) => {
    field(component, "variants");
    const relevant = variants.filter((variant) => component.variants.includes(variant));
    if (!relevant.length) { return; }
    field(component, "tplTree"); const root = component.tplTree; field(root, "parent");
    if (!isKnownTplComponent(root)) { return; }
    field(root, "component"); field(root.component, "type", "codeComponentMeta");
    const meta = root.component.codeComponentMeta;
    if (!meta) { return; } field(meta, "variants");
    relevant.forEach((variant) => variant.codeComponentVariantKeys?.forEach((key) => { const value = meta.variants[key]; if (value) { field(value, "displayName"); } }));
  });
}
