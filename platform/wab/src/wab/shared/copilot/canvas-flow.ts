import { getActivatedVariantsForFrame } from "@/wab/shared/Arenas";
import { DEFAULT_MARGIN_FOR_NEW_FRAMES } from "@/wab/shared/canvas-constants";
import { assert, ensure } from "@/wab/shared/common";
import { isPageComponent } from "@/wab/shared/core/components";
import { tryExtractString } from "@/wab/shared/core/exprs";
import { collectPageNavigations } from "@/wab/shared/core/page-navigation";
import { isTplNamable, summarizeTpl } from "@/wab/shared/core/tpls";
import { Arena, Site } from "@/wab/shared/model/classes";
import {
  makeVariantComboSorter,
  sortedVariantSettingStack,
} from "@/wab/shared/variant-sort";

export function reorderArtboards(arena: Arena, frameUuids: string[]) {
  const byId = new Map(arena.children.map((frame) => [frame.uuid, frame]));
  assert(
    frameUuids.length === byId.size && new Set(frameUuids).size === byId.size,
    "Supply every frame in the group exactly once",
  );
  const ordered = frameUuids.map((id) =>
    ensure(byId.get(id), `Frame ${id} is outside group ${arena.name}`),
  );
  // Keep the group's top-left corner and use Studio's native spacing.
  let x = Math.min(...ordered.map((frame) => frame.left ?? 0));
  const y = Math.min(...ordered.map((frame) => frame.top ?? 0));
  for (const frame of ordered) {
    frame.left = x;
    frame.top = y;
    x += frame.width + DEFAULT_MARGIN_FOR_NEW_FRAMES;
  }
  if (ordered.some((frame, index) => frame !== arena.children[index])) {
    arena.children = ordered;
  }
}

export function readCanvasFlow(site: Site, arena: Arena) {
  const pages = site.components.filter(isPageComponent);
  const groupPages = new Set(
    arena.children
      .map((frame) => frame.container.component)
      .filter(isPageComponent),
  );
  const inbound = new Set<string>();
  const frames = arena.children.map((frame) => {
    const source = frame.container.component;
    return {
      frameUuid: frame.uuid,
      componentUuid: source.uuid,
      name: source.name || frame.name,
      path: source.pageMeta?.path ?? null,
    };
  });
  const links = arena.children.flatMap((frame) => {
    const source = frame.container.component;
    if (!isPageComponent(source)) {
      return [];
    }
    const variants = [...getActivatedVariantsForFrame(site, frame)];
    const sorter = makeVariantComboSorter(site, source);
    const navigations = collectPageNavigations(source, pages, (tpl) =>
      sortedVariantSettingStack(tpl.vsettings, variants, sorter),
    );
    return navigations.map((link) => {
      const target = link.target;
      const inGroup =
        !!target && isPageComponent(target) && groupPages.has(target);
      if (target && inGroup && source !== target) {
        inbound.add(target.uuid);
      }
      return {
        sourceFrameUuid: frame.uuid,
        sourcePageUuid: source.uuid,
        sourcePageName: source.name,
        elementUuid: link.tpl.uuid,
        elementName:
          (isTplNamable(link.tpl) && link.tpl.name) || summarizeTpl(link.tpl),
        event: link.event,
        property: link.prop,
        conditional: link.conditional,
        kind: link.kind,
        destination:
          tryExtractString(link.destination) ?? target?.pageMeta?.path ?? null,
        target: target
          ? { pageUuid: target.uuid, name: target.name, inGroup }
          : null,
      };
    });
  });
  return {
    canvasName: arena.name,
    frames,
    links,
    pagesWithoutInbound: [...groupPages]
      .filter((page) => !inbound.has(page.uuid))
      .map((page) => ({ pageUuid: page.uuid, name: page.name })),
  };
}
