import { CanvasViewFieldRecipe, useCanvasViewValue } from "@/wab/client/components/canvas/canvas-view-inputs";
import { computeElementVisibility } from "@/wab/client/components/canvas/HoverBox/visible-bounds";
import { routeNavigation, NavigationRoute } from "@/wab/client/components/canvas/navigation-routing";
import { useCurrentModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useI18n } from "@/wab/client/i18n";
import { useStudioArena, useViewRegistry, useViewReady } from "@/wab/client/studio-ctx/arena-state";
import { useActiveContentEditor } from "@/wab/client/studio-ctx/canvas-content-editor";
import { useStudioOverlayState } from "@/wab/client/studio-ctx/studio-overlay-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewRegistryEntry } from "@/wab/client/studio-ctx/studio-view-registry";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useCanvasZoom, subscribeViewport } from "@/wab/client/studio-ctx/viewport-state";
import { getFrameHeight } from "@/wab/shared/Arenas";
import { isCodeComponent, isPageComponent } from "@/wab/shared/core/components";
import { collectPageNavigations, PageNavigation } from "@/wab/shared/core/page-navigation";
import { Box, Rect } from "@/wab/shared/geom";
import { ArenaFrame, isKnownTplComponent } from "@/wab/shared/model/classes";
import { DeleteOutlined } from "@ant-design/icons";
import { Button } from "antd";
import { createStyles } from "antd-style";
import $ from "jquery";
import { ok } from "neverthrow";
import * as React from "react";
import ResizeObserver from "resize-observer-polyfill";
import { useShallow } from "zustand/react/shallow";

const useStyles = createStyles(({ token }) => ({
  layer: { position: "absolute", left: 0, top: 0, width: 0, height: 0, pointerEvents: "none", zIndex: 8, color: token.colorPrimary },
  svg: { position: "absolute", overflow: "visible", width: 1, height: 1 },
  hit: { pointerEvents: "stroke", cursor: "pointer", outline: "none", "&:focus-visible": { stroke: token.colorPrimary, strokeOpacity: 0.2 } },
  label: { position: "absolute", transformOrigin: "left center", pointerEvents: "auto", whiteSpace: "nowrap", background: token.colorBgElevated, color: token.colorText, border: `1px solid ${token.colorBorderSecondary}`, borderRadius: token.borderRadius, display: "flex", alignItems: "center", gap: 8, padding: "4px 8px", boxShadow: token.boxShadowSecondary, cursor: "pointer" },
  labelText: { background: "none", border: 0, padding: 0, color: "inherit", cursor: "pointer", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" },
}));

interface FrameTarget { frame: ArenaFrame; view?: ViewCtx; }
interface MeasuredLink { link: PageNavigation; source: Rect; target?: FrameTarget; targetRect?: Rect; route?: NavigationRoute; }

/** Use live DOM geometry: frame drag transforms need not have reached the model yet. */
function frameBounds(studio: StudioCtx, target: FrameTarget, includeShell = false): Rect {
  const element = target.view?.canvasCtx.$viewport()[0];
  if (element?.isConnected && studio.viewportCtx) {
    const shell = includeShell ? element.parentElement?.querySelector('[data-test-id="device-frame"]') : undefined;
    const box = shell?.getBoundingClientRect() ?? element.getBoundingClientRect();
    return studio.viewportCtx.clientToScaler(Box.fromRect(box)).rect();
  }
  return { left: target.frame.left ?? 0, top: target.frame.top ?? 0, width: target.frame.width, height: getFrameHeight(target.frame) };
}

function frameHeaderBounds(studio: StudioCtx, target: FrameTarget): Rect[] {
  const header = target.view?.canvasCtx.$viewport()[0]?.parentElement?.querySelector(".CanvasFrame__Label");
  if (!header || !studio.viewportCtx) { return []; }
  const bounds = header.getBoundingClientRect();
  return bounds.width > 0 && bounds.height > 0 ? [studio.viewportCtx.clientToScaler(Box.fromRect(bounds)).rect()] : [];
}

function measureSource(view: ViewCtx, link: PageNavigation, frame: Rect): Rect | undefined {
  const [, doms] = view.maybeDomsForTpl(link.tpl, { ignoreFocusedCloneKey: true });
  let elements = doms ?? [];
  // Registered component parts can locate an action inside a compound widget.
  if (isKnownTplComponent(link.tpl) && isCodeComponent(link.tpl.component)) {
    const parts = view.getCodeComponentMeta(link.tpl.component)?.canvasParts;
    const part = Object.values(parts ?? {}).find((candidate) => candidate.props.includes(link.prop));
    if (part) {
      const matches = elements.flatMap((element) => Array.from(element.querySelectorAll<HTMLElement>(part.selector)));
      if (matches.length) { elements = matches; }
    }
  }
  const bounds = Box.mergeBBs(elements.filter((element) => element.isConnected).map((element) => element.getBoundingClientRect()));
  if (!bounds) { return undefined; }
  const visible = computeElementVisibility($(elements), bounds).visible;
  if (!visible) { return undefined; }
  return { left: frame.left + visible.left(), top: frame.top + visible.top(), width: visible.width(), height: visible.height() };
}

export const CanvasNavigationLinks = React.memo(function CanvasNavigationLinks({ studioCtx }: { studioCtx: StudioCtx }) {
  const world = useCurrentModelWorld(studioCtx);
  const kind = useStudioArena(studioCtx, (state) => state.kind);
  const refs = useStudioArena(studioCtx, (state) => state.frames);
  const entries = useViewRegistry(studioCtx, (state) => state);
  const hidden = useStudioOverlayState(studioCtx, (state) => state.screenshotting);
  const contentEditor = useActiveContentEditor(studioCtx);
  const [selected, setSelected] = React.useState<string>();
  const frames = React.useMemo(() => refs.map((ref) => ({ frame: world.models.resolve(ref), view: entries.find((entry) => entry.frame === ref)?.view })), [refs, entries, world]);
  React.useEffect(() => {
    if (selected && !frames.some(({ frame }) => selected.startsWith(`${frame.uuid}:`))) { setSelected(undefined); }
  }, [frames, selected]);
  React.useEffect(() => {
    if (!selected) { return; }
    const dismiss = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.closest('[data-test-id="canvas-navigation-links"]')) { setSelected(undefined); }
    };
    const escape = (event: KeyboardEvent) => { if (event.key === "Escape") { setSelected(undefined); } };
    const docs = [document, ...frames.flatMap(({ view }) => view ? [view.canvasCtx.$doc()[0]] : [])];
    docs.forEach((doc) => { doc.addEventListener("pointerdown", dismiss); doc.addEventListener("keydown", escape); });
    return () => docs.forEach((doc) => { doc.removeEventListener("pointerdown", dismiss); doc.removeEventListener("keydown", escape); });
  }, [selected, frames]);
  if (kind !== "mixed" || hidden || contentEditor || !world.isCurrent()) { return null; }
  return <>{entries.filter((entry) => refs.includes(entry.frame)).map((entry) => <ReadyNavigationFrame key={entry.frame.uid} entry={entry} frames={frames} selected={selected} onSelect={setSelected} />)}</>;
});

function ReadyNavigationFrame(props: { entry: ViewRegistryEntry; frames: FrameTarget[]; selected?: string; onSelect: (id?: string) => void }) {
  const ready = useViewReady(props.entry);
  return ready ? <NavigationFrame {...props} view={props.entry.view} /> : null;
}

function NavigationFrame({ view, frames, selected, onSelect }: { view: ViewCtx; frames: FrameTarget[]; selected?: string; onSelect: (id?: string) => void }) {
  const studio = view.studioCtx;
  const { t } = useI18n();
  const { styles } = useStyles();
  const zoom = useCanvasZoom(studio);
  const renderCount = useCanvasRenderCount(view);
  const variants = useViewVariants(view, useShallow((state) => [state.frames, state.global]));
  const recipe = React.useCallback<CanvasViewFieldRecipe>((field) => {
    field(view.site, "components");
    const pages = view.site.components.filter(isPageComponent);
    pages.forEach((page) => { field(page, "name", "pageMeta"); if (page.pageMeta) { field(page.pageMeta, "path"); } });
    frames.forEach(({ frame }) => { field(frame, "left", "top", "width", "height", "container"); field(frame.container, "component"); });
    collectPageNavigations(view.arenaFrame().container.component, pages, (tpl) => view.effectiveCurrentVariantSetting(tpl).variantSettings, field);
  }, [view, frames, variants, renderCount]);
  const selectLinks = React.useCallback(() => collectPageNavigations(view.arenaFrame().container.component, view.site.components.filter(isPageComponent), (tpl) => view.effectiveCurrentVariantSetting(tpl).variantSettings), [view]);
  const links = useCanvasViewValue(view, recipe, selectLinks);
  const [measured, setMeasured] = React.useState<MeasuredLink[]>([]);
  const [hovered, setHovered] = React.useState<string>();
  const markerId = `navigation-${React.useId().replace(/:/g, "")}`;
  React.useEffect(() => {
    const prefix = `${view.arenaFrame().uuid}:`;
    if (selected?.startsWith(prefix) && !links?.some((link) => `${prefix}${link.id}` === selected)) { onSelect(undefined); }
  }, [view, links, selected, onSelect]);

  React.useLayoutEffect(() => {
    if (!links?.length) { setMeasured([]); return; }
    let active = true, pending: number | undefined, signature = "";
    let measuredScale = studio.viewportCtx?.scale();
    const frame = view.arenaFrame();
    const own = frames.find((item) => item.frame === frame);
    if (!own) { return; }
    const update = () => {
      pending = undefined;
      if (!active || view.disposeSignal.aborted || view.modelLifetime.aborted) { return; }
      // During a smooth zoom, DOM rectangles still use the animated scale while
      // ViewportCtx already holds its destination. Keep the route in canvas space
      // until both agree; the scaler itself moves the existing SVG with the pages.
      const viewport = studio.viewportCtx;
      const scaler = view.canvasCtx.$viewport()[0]?.closest(".canvas-editor__scaler");
      const matrix = scaler ? getComputedStyle(scaler).transform : "none";
      const renderedScale = matrix && matrix !== "none" ? new DOMMatrixReadOnly(matrix).a : viewport?.scale();
      if ((viewport?.isTransforming() && viewport.scale() !== measuredScale) || (renderedScale !== undefined && viewport && Math.abs(renderedScale - viewport.scale()) > 0.0001)) { schedule(); return; }
      const rects = frames.map((target) => ({ target, rect: frameBounds(studio, target), outer: frameBounds(studio, target, true), headers: frameHeaderBounds(studio, target) }));
      const ownBounds = rects.find((item) => item.target === own);
      if (!ownBounds) { return; }
      measuredScale = viewport?.scale();
      const ownRect = ownBounds.rect;
      const next = links.flatMap((link): MeasuredLink[] => {
        const source = measureSource(view, link, ownRect);
        const targets = rects.filter((item) => item.target.frame.container.component === link.target && item.target.frame !== frame);
        targets.sort((a, b) => Math.abs(a.target.frame.width - frame.width) - Math.abs(b.target.frame.width - frame.width) || Math.hypot(a.rect.left - ownRect.left, a.rect.top - ownRect.top) - Math.hypot(b.rect.left - ownRect.left, b.rect.top - ownRect.top));
        const destination = targets[0];
        if (!source || !destination) { return []; }
        return [{ link, source, target: destination.target, targetRect: destination.outer }];
      });
      const nextSignature = JSON.stringify([rects.map((r) => [r.outer, r.headers]), next.map((item) => [item.link.id, item.source, item.target?.frame.uuid, item.targetRect])]);
      if (nextSignature !== signature) {
        signature = nextSignature;
        for (const item of next) {
          if (item.targetRect && item.source.width > 0) {
            item.route = routeNavigation(item.source, ownBounds.outer, item.targetRect, rects.map((r) => r.outer), rects.flatMap((r) => r.headers));
          }
        }
        setMeasured(next);
      }
      // Native drag/resize manipulations update geometry between model commits.
      if (studio.draggingObjectStore.getState() || studio.transformingObjectStore.getState()) { schedule(); }
    };
    const schedule = () => { if (active && pending === undefined) { pending = requestAnimationFrame(update); } };
    const doc = view.canvasCtx.$doc()[0];
    const observer = new MutationObserver(schedule);
    observer.observe(doc.body, { subtree: true, childList: true, attributes: true, characterData: true });
    const frameObserver = new MutationObserver(schedule);
    const resize = new ResizeObserver(schedule);
    resize.observe(doc.body);
    for (const link of links) {
      const [, elements] = view.maybeDomsForTpl(link.tpl, { ignoreFocusedCloneKey: true });
      for (const element of elements ?? []) {
        for (let parent: Element | null = element; parent && parent !== doc.body; parent = parent.parentElement) {
          resize.observe(parent);
        }
      }
    }
    for (const item of frames) {
      const viewport = item.view?.canvasCtx.$viewport()[0];
      if (viewport) {
        resize.observe(viewport);
        const header = viewport.parentElement?.querySelector(".CanvasFrame__Label");
        if (header) {
          resize.observe(header);
          frameObserver.observe(header, { subtree: true, childList: true, characterData: true, attributes: true });
        }
        const shell = viewport.parentElement?.querySelector('[data-test-id="device-frame"]');
        if (shell) { resize.observe(shell); frameObserver.observe(shell, { attributes: true }); }
        for (let parent: Element | null = viewport; parent && !parent.classList.contains("canvas-editor__scaler"); parent = parent.parentElement) {
          frameObserver.observe(parent, { childList: true, attributes: true, attributeFilter: ["style", "class"] });
        }
      }
    }
    const stopViewport = subscribeViewport(studio, (state) => state, schedule);
    const stopDrag = studio.draggingObjectStore.subscribe(schedule);
    const stopTransform = studio.transformingObjectStore.subscribe(schedule);
    const stylesChanged = studio.styleChanged.add(schedule);
    const framesChanged = studio.framesChanged.add(schedule);
    doc.addEventListener("scroll", schedule, true);
    doc.addEventListener("load", schedule, true);
    doc.fonts?.addEventListener("loadingdone", schedule);
    const stop = () => {
      active = false;
      if (pending !== undefined) { cancelAnimationFrame(pending); }
      observer.disconnect(); frameObserver.disconnect(); resize.disconnect();
      stopViewport(); stopDrag(); stopTransform(); stylesChanged.detach(); framesChanged.detach();
      doc.removeEventListener("scroll", schedule, true); view.disposeSignal.removeEventListener("abort", stop);
      doc.removeEventListener("load", schedule, true); doc.fonts?.removeEventListener("loadingdone", schedule);
      view.modelLifetime.removeEventListener("abort", stop);
    };
    view.disposeSignal.addEventListener("abort", stop, { once: true });
    view.modelLifetime.addEventListener("abort", stop, { once: true });
    schedule();
    return stop;
  }, [view, studio, frames, links]);

  const title = (link: PageNavigation) => link.target?.name ?? t(link.kind === "external" ? "External link" : link.kind === "anchor" ? "In-page link" : "Dynamic navigation");
  const trigger = (link: PageNavigation) => link.event === "href" || link.event === "onClick" ? t("Click") : link.event === "onFinish" ? t("Submit successfully") : link.event;
  if (!links || view.disposeSignal.aborted || view.modelLifetime.aborted) { return null; }
  return <div className={styles.layer} data-test-id="canvas-navigation-links" onPointerDownCapture={(event) => event.stopPropagation()} onMouseDownCapture={(event) => event.stopPropagation()} onClick={(event) => event.stopPropagation()}>
    <svg className={styles.svg} aria-label={t("Page navigation connections")}>
      <defs><marker id={markerId} viewBox="0 0 10 10" refX={9} refY={5} markerUnits="userSpaceOnUse" markerWidth={7 / zoom} markerHeight={7 / zoom} orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor" /></marker></defs>
      {measured.map((item) => {
        const id = `${view.arenaFrame().uuid}:${item.link.id}`;
        const emphasis = selected === id || hovered === id;
        const faded = selected && selected !== id;
        return item.route && <g key={id}>
          <path d={item.route.path} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" strokeWidth={emphasis ? 1.5 : 1} opacity={faded ? 0.18 : emphasis ? 1 : 0.55} markerEnd={`url(#${markerId})`} />
          <path className={styles.hit} d={item.route.path} fill="none" stroke="transparent" vectorEffect="non-scaling-stroke" strokeWidth={12} role="button" tabIndex={0} aria-label={`${trigger(item.link)} → ${title(item.link)}`} onPointerDown={(event) => event.stopPropagation()} onClick={(event) => { event.stopPropagation(); onSelect(selected === id ? undefined : id); }} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); onSelect(id); } if (event.key === "Escape") { onSelect(undefined); } }} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(undefined)} />
        </g>;
      })}
    </svg>
    {measured.map((item) => {
      const id = `${view.arenaFrame().uuid}:${item.link.id}`;
      const active = selected === id;
      if (!item.route || !active) { return null; }
      const point = item.route.label;
      return <div key={id} className={styles.label} style={{ left: point.x, top: point.y, transform: `translate(8px, -50%) scale(${1 / zoom})` }} onPointerDown={(event) => event.stopPropagation()} onMouseEnter={() => setHovered(id)} onMouseLeave={() => setHovered(undefined)} onKeyDown={(event) => { if (event.key === "Escape") { onSelect(undefined); } }}>
        <button className={styles.labelText} title={`${trigger(item.link)} → ${title(item.link)}`} onClick={() => onSelect(active ? undefined : id)}>
          {trigger(item.link)} → {title(item.link)}{item.link.conditional ? ` · ${t("Conditional navigation")}` : ""}
        </button>
        {active && !studio.isPublishedTemplate && <Button type="text" danger size="small" icon={<DeleteOutlined />} aria-label={t("Remove navigation")} title={t("Remove navigation")} disabled={!studio.canEditProject()} onClick={() => {
          void studio.change(() => { if (links && !view.disposeSignal.aborted && !view.modelLifetime.aborted) { item.link.remove(); } return ok(); }); onSelect(undefined);
        }} />}
      </div>;
    })}
  </div>;
}
