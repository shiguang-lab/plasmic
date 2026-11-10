import { parseProjectLocation } from "@/wab/client/cli-routes";
import { createPreviewCompiler } from "@/wab/client/components/live/preview-compiler";
import { showCanvasPageNavigationNotification } from "@/wab/client/components/canvas/studio-canvas-util";
import {
  DEVICE_VIEWPORTS,
  PreviewViewportMode,
  isViewportDimension,
  parseViewportMode,
} from "@/wab/client/components/live/preview-viewport";
import { ClientPinManager } from "@/wab/client/components/variants/ClientPinManager";
import { HostFrameCtx } from "@/wab/client/frame-ctx/host-frame-ctx";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import type { ModelRef, ModelSnapshots } from "@/wab/client/studio-ctx/model-snapshots";
import { withProvider } from "@/wab/commons/components/ContextUtil";
import { MainBranchId, ProjectId } from "@/wab/shared/ApiSchema";
import { getFrameHeight } from "@/wab/shared/Arenas";
import {
  VariantCombo,
  getReferencedVariantGroups,
  isGlobalVariant,
  getAllVariantsForTpl,
  isBaseVariant,
  isPrivateStyleVariant,
  isScreenVariant,
  isStyleOrCodeComponentVariant,
} from "@/wab/shared/Variants";
import { toVarName } from "@/wab/shared/codegen/util";
import { ensure, hackyCast, spawn, tuple } from "@/wab/shared/common";
import {
  allComponentNonStyleVariants,
  allComponentVariants,
  isCodeComponent,
  isFrameComponent,
  isPageComponent,
  isReusableComponent,
} from "@/wab/shared/core/components";
import { allGlobalVariants } from "@/wab/shared/core/sites";
import { Component, Variant, isKnownComponent } from "@/wab/shared/model/classes";
import {
  APP_ROUTES,
  SEARCH_PARAM_BRANCH,
  mkProjectLocation,
} from "@/wab/shared/route/app-routes";
import { getPublicUrl } from "@/wab/shared/urls";
import {
  findPreviewPage,
  formatBusinessHref,
  readBusinessLocation,
  readBusinessQuery,
  resolveBusinessHref,
  type BusinessQuery,
} from "@plasmic-shared/preview";
import * as Sentry from "@sentry/browser";
import { Location, createPath, parsePath } from "history";
import _ from "lodash";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import React from "react";

const DEFAULT_VIEWPORT_WIDTH = 320;
const DEFAULT_VIEWPORT_HEIGHT = 480;

/** All the input data required to make a preview route. */
interface PreviewInputData {
  full: boolean;
  presentationCode?: string;
  viewport: PreviewViewportMode;
  /**
   * Can be either:
   * 1) a valid component and page params, or
   * 2) an invalid component, represented by a raw string
   *    (this happens when a user types a bad URL or clicks a bad link)
   */
  componentPath:
    | {
        /** Component/page. */
        component: Component;
        /** Page params that will be substituted into the page's path, e.g. { id: 123 } for "my-page/123" */
        pageParams?: Record<string, string | string[]>;
      }
    | string;
  /** Query params in the URL, e.g. { q: foo } for "my-page?q=foo" */
  pageQuery: BusinessQuery;
  /** Hash in the URL, e.g. #bar for "my-page#bar" */
  pageHash: string;
  allVariants: VariantCombo;
  width: number;
  height: number;
  branchName: string | null;
}

/** Preview input data plus extra output data, parsed from the route. */
interface PreviewDataOutput extends PreviewInputData {
  /** The resolved business pathname, independently of the enclosing preview URL. */
  previewPath: string;
  variants: Record<string, string | string[]>;
  global: Record<string, string | string[]>;
}

export interface PreviewTarget {
  readonly uuid: string;
  readonly name: string;
  readonly kind: "page" | "component" | "artboard";
}

export interface PreviewDataSnapshot extends Omit<PreviewDataOutput, "componentPath" | "allVariants"> {
  readonly componentPath: string | { readonly component: ModelRef<Component>; readonly pageParams?: Record<string, string | string[]> };
  readonly allVariants: readonly ModelRef<Variant>[];
}

export interface PreviewState {
  readonly previewData: PreviewDataSnapshot | undefined;
  readonly isLive: boolean;
  readonly navigationEntries: readonly Partial<Location>[];
  readonly navigationIndex: number;
  readonly navigating: boolean;
  readonly refreshKey: number;
  readonly targets: readonly PreviewTarget[];
  readonly hasVariants: boolean;
  readonly componentUuid?: string;
}

export function usePreviewSelector<T>(
  previewCtx: PreviewCtx,
  selector: (state: PreviewState) => T,
): T {
  return useStore(previewCtx.store, selector);
}

export class PreviewCtx {
  private compiler: ReturnType<typeof createPreviewCompiler> | undefined;
  get previewCompiler() {
    if (!this.compiler || this.compiler.disposed) { this.compiler = createPreviewCompiler(); }
    return this.compiler;
  }
  private disposals: (() => void)[] = [];
  private disposed = false;
  readonly store = createStore<PreviewState>(() => ({
    previewData: undefined,
    isLive: false,
    navigationEntries: [],
    navigationIndex: -1,
    navigating: false,
    refreshKey: 0,
    targets: [],
    hasVariants: false,
  }));
  private previousLocation: Partial<Location> | undefined = undefined;
  private commandPreviewData: PreviewDataOutput | undefined = undefined;
  private routeSnapshotsOwner: ModelSnapshots | undefined;

  private update(next: Partial<PreviewState>) {
    if (this.disposed) {
      return;
    }
    const current = this.store.getState();
    if ((Object.keys(next) as (keyof PreviewState)[]).some((key) => !Object.is(current[key], next[key]))) {
      if (
        next.isLive !== undefined &&
        next.isLive !== current.isLive &&
        this.studioCtx.previewCtx === this
      ) {
        this.studioCtx.withPreviewLivePolicy(next.isLive, () => {
          this.store.setState(next);
        });
      } else {
        this.store.setState(next);
      }
    }
  }

  get previewData() { return this.commandPreviewData; }
  set previewData(value: PreviewDataOutput | undefined) {
    const previous = this.previewData;
    const snapshots = this.studioCtx.modelSnapshots;
    const sameOwner = this.routeSnapshotsOwner === snapshots;
    const component = (data: PreviewDataOutput | undefined) =>
      data && typeof data.componentPath !== "string" ? data.componentPath.component : undefined;
    if (sameOwner && component(previous) === component(value) && _.isEqual(
      previous && { ...previous, componentPath: typeof previous.componentPath === "string" ? previous.componentPath : previous.componentPath.pageParams, allVariants: previous.allVariants.map((variant) => variant.uid) },
      value && { ...value, componentPath: typeof value.componentPath === "string" ? value.componentPath : value.componentPath.pageParams, allVariants: value.allVariants.map((variant) => variant.uid) },
    )) { return; }
    if (this.disposed) { return; }
    const freezeRecord = <T,>(record: Record<string, T | T[]>, before?: Record<string, T | T[]>) => {
      if (before && _.isEqual(before, record)) { return before; }
      const frozen = Object.fromEntries(Object.entries(record).map(([key, item]) => [key, Array.isArray(item) ? Object.freeze(item.slice()) : item])) as Record<string, T | T[]>;
      return Object.freeze(frozen);
    };
    const allVariants = value && previous && value.allVariants.length === previous.allVariants.length && value.allVariants.every((variant, index) => variant === previous.allVariants[index]) ? previous.allVariants : value?.allVariants.slice();
    if (allVariants) { Object.freeze(allVariants); }
    const previousPath = previous && typeof previous.componentPath !== "string" ? previous.componentPath : undefined;
    const nextPath = value && typeof value.componentPath !== "string" ? { ...value.componentPath, pageParams: value.componentPath.pageParams && freezeRecord(value.componentPath.pageParams, previousPath?.pageParams) } : value?.componentPath;
    const componentPath = nextPath && typeof nextPath !== "string" && previousPath && nextPath.component === previousPath.component && nextPath.pageParams === previousPath.pageParams ? previousPath : nextPath;
    const command = value && Object.freeze({
      ...value,
      componentPath: typeof componentPath === "string" ? componentPath : Object.freeze(ensure(componentPath, "Preview component path missing")),
      pageQuery: freezeRecord(value.pageQuery, previous?.pageQuery),
      variants: freezeRecord(value.variants, previous?.variants),
      global: freezeRecord(value.global, previous?.global),
      allVariants: ensure(allVariants, "Preview variants missing"),
    });
    this.commandPreviewData = command;
    this.routeSnapshotsOwner = snapshots;
    const before = sameOwner ? this.store.getState().previewData : undefined;
    const previewData = command && Object.freeze({
      ...command,
      componentPath: command.componentPath === previous?.componentPath && before ? before.componentPath : typeof command.componentPath === "string" ? command.componentPath : Object.freeze({ ...command.componentPath, component: snapshots.ref(command.componentPath.component) }),
      allVariants: command.allVariants === previous?.allVariants && before ? before.allVariants : Object.freeze(command.allVariants.map((variant) => snapshots.ref(variant))),
    });
    this.update({ previewData, componentUuid: component(command)?.uuid, hasVariants: this.hasSelectableVariants(component(command)) });
  }
  get isLive() { return this.store.getState().isLive; }
  set isLive(value: boolean) { this.update({ isLive: value }); }
  get refreshKey() { return this.store.getState().refreshKey; }
  set refreshKey(value: number) { this.update({ refreshKey: value }); }
  private get navigationEntries() { return this.store.getState().navigationEntries; }
  private get navigationIndex() { return this.store.getState().navigationIndex; }
  private get navigating() { return this.store.getState().navigating; }

  private syncTargets() {
    const targets = this.studioCtx.site.components.flatMap((component): PreviewTarget[] => {
      const kind = isPageComponent(component) ? "page" : isFrameComponent(component) ? "artboard" : isReusableComponent(component) && !isCodeComponent(component) ? "component" : undefined;
      return kind ? [{ uuid: component.uuid, name: component.name, kind }] : [];
    });
    const previous = this.store.getState().targets;
    if (!_.isEqual(previous, targets)) {
      const previousByUuid = new Map(previous.map((target) => [target.uuid, target]));
      this.update({ targets: Object.freeze(targets.map((target) => {
        const before = previousByUuid.get(target.uuid);
        return _.isEqual(target, before) ? ensure(before, "Missing previous Preview target") : Object.freeze(target);
      })) });
    }
  }

  private hasSelectableVariants(component: Component | undefined) {
    return !!component && getAllVariantsForTpl({ component, tpl: null, site: this.studioCtx.site }).some((variant) => !isStyleOrCodeComponentVariant(variant) && !isScreenVariant(variant) && !isPrivateStyleVariant(variant) && !isBaseVariant(variant));
  }

  private syncVariantAvailability() {
    this.update({ hasVariants: this.hasSelectableVariants(this.component) });
  }

  get canGoBack() {
    return this.isLive && !this.navigating && this.navigationIndex > 0;
  }

  get canGoForward() {
    return (
      this.isLive &&
      !this.navigating &&
      this.navigationIndex < this.navigationEntries.length - 1
    );
  }

  private recordNavigation(location: Location) {
    if (!this.isLive) {
      if (this.navigationEntries.length) {
        this.update({ navigationEntries: [], navigationIndex: -1 });
      }
      return;
    }
    const current = this.navigationEntries[this.navigationIndex];
    // Device sizes and variant controls are presentation settings, not pages.
    const pageKey = (entry: Partial<Location>) =>
      JSON.stringify([
        entry.pathname,
        entry.hash,
        new URLSearchParams(entry.search).get("component"),
      ]);
    if (!current || pageKey(current) !== pageKey(location)) {
      this.update({
        navigationEntries: [...this.navigationEntries.slice(0, this.navigationIndex + 1), location],
        navigationIndex: this.navigationIndex + 1,
      });
    } else if (!_.isEqual(current, location)) {
      const entries = this.navigationEntries.slice();
      entries[this.navigationIndex] = location;
      this.update({ navigationEntries: entries });
    }
  }

  async goBack() {
    if (this.canGoBack) {
      await this.goToNavigationEntry(this.navigationIndex - 1);
    }
  }

  async goForward() {
    if (this.canGoForward) {
      await this.goToNavigationEntry(this.navigationIndex + 1);
    }
  }

  private async goToNavigationEntry(index: number) {
    const location = ensure(
      this.navigationEntries[index],
      "Missing Preview history entry",
    );
    const settings = new URLSearchParams(location.search);
    const currentSettings = new URLSearchParams(
      this.hostFrameCtx.history.location.search,
    );
    for (const key of ["viewport", "width", "height"]) {
      const value = currentSettings.get(key);
      if (value === null) {
        settings.delete(key);
      } else {
        settings.set(key, value);
      }
    }
    const previousIndex = this.navigationIndex;
    this.update({ navigating: true, navigationIndex: index });
    try {
      // Replace the Studio route; never traverse the editor's browser history.
      await this.pushRouteToHistory(
        { ...location, search: settings.size ? `?${settings}` : "" },
        true,
      );
    } catch (error) {
      this.update({ navigationIndex: previousIndex });
      throw error;
    } finally {
      this.update({ navigating: false });
    }
  }

  refresh() {
    if (this.isLive) {
      this.refreshKey++;
    }
  }

  get previewPath() {
    return this.previewData?.previewPath || "";
  }
  get component() {
    if (
      !this.previewData ||
      typeof this.previewData.componentPath === "string"
    ) {
      return undefined;
    } else {
      return this.previewData.componentPath.component;
    }
  }
  get pageParams() {
    if (
      !this.previewData ||
      typeof this.previewData.componentPath === "string"
    ) {
      return undefined;
    } else {
      return this.previewData.componentPath.pageParams;
    }
  }
  get pageQuery() {
    return this.previewData?.pageQuery || {};
  }
  get pageHash() {
    return this.previewData?.pageHash || "";
  }
  get variants() {
    return this.previewData?.variants || {};
  }
  get global() {
    return this.previewData?.global || {};
  }

  // Viewport settings.
  get width() {
    return this.previewData?.width || DEFAULT_VIEWPORT_WIDTH;
  }
  get height() {
    return this.previewData?.height || DEFAULT_VIEWPORT_HEIGHT;
  }
  get full() {
    return this.previewData?.full || false;
  }
  get viewport() {
    return this.previewData?.viewport || "desktop";
  }

  constructor(
    public hostFrameCtx: HostFrameCtx,
    public studioCtx: StudioCtx,
  ) {
    studioCtx.previewCtx = this;
    this.syncTargets();
    this.disposals.push(studioCtx.subscribeModelChanges((event) => {
      if (event.type === "site-replaced") {
        this.compiler?.dispose(); this.compiler = undefined;
        this.syncTargets();
        this.syncVariantAvailability();
        spawn(this.parseRoute());
        return;
      }
      if (event.summary.changes.some(({ changeNode: { inst, field } }) =>
        (inst === studioCtx.site && field === "components") ||
        (isKnownComponent(inst) && studioCtx.site.components.includes(inst) && ["name", "uuid", "type", "pageMeta", "codeComponentMeta"].includes(field))
      )) { this.syncTargets(); }
      if (event.summary.changes.length) { this.syncVariantAvailability(); }
    }));

    // Add history listener
    const historyListener = (location: Location) => {
      const wasLive = this.isLive;
      this.isLive = isLiveMode(location.pathname);
      if (!this.isLive && wasLive) {
        this.previousLocation = undefined;
      }
      this.recordNavigation(location);
      spawn(this.parseRoute());
    };
    const disposeHistoryListener = hostFrameCtx.history.listen(({ location }) =>
      historyListener(location),
    );
    this.disposals.push(disposeHistoryListener);

    // Trigger initial history listener
    historyListener(hostFrameCtx.history.location);

    const match = parseProjectLocation(this.studioCtx.appCtx.history.location);
    if (match && match.isPreview) {
      // If we started from live mode, go back to the same component when
      // navigating to dev mode.
      this.previousLocation = {
        ...this.studioCtx.appCtx.history.location,
        ...mkProjectLocation({
          ...match,
        }),
      };
    }
  }

  dispose() {
    this.disposed = true;
    this.compiler?.dispose(); this.compiler = undefined;
    this.disposals.splice(0).forEach((d) => d());
  }

  async toggleLiveMode() {
    if (this.isLive) {
      await this._stopLiveMode();
    } else {
      await this._startLiveMode();
    }
  }

  async stopLiveMode() {
    if (this.isLive) {
      await this._stopLiveMode();
    }
  }

  private async _startLiveMode() {
    const history = this.studioCtx.appCtx.history;

    this.previousLocation = history.location;

    const location = await getUrlsForLiveMode(this.studioCtx, false);
    await this.pushRouteToHistory(location);
  }

  private async _stopLiveMode() {
    await this.pushRouteToHistory(
      this.previousLocation ||
        APP_ROUTES.project.fill({ projectId: this.studioCtx.siteInfo.id }),
    );
  }

  async getLocation(): Promise<Location> {
    return this.hostFrameCtx.history.location;
  }

  async parseRoute() {
    const location = await this.getLocation();
    this.isLive = isLiveMode(this.hostFrameCtx.history.location.pathname);
    if (!isLiveMode(location.pathname)) {
      this.previewData = undefined;
      return;
    }

    const presentation = APP_ROUTES.projectPresentation.parse(
      location.pathname,
    );
    const full = !!presentation;
    const business = readBusinessLocation(location.hash);
    const settings = new URLSearchParams(location.search);
    const previewPath = business.pathname;
    const componentTarget = settings.get("component");
    const componentPath = componentTarget
      ? (() => {
          const component = this.studioCtx.site.components.find(
            (c) => c.uuid === componentTarget && !c.pageMeta,
          );
          return component ? { component, pageParams: {} } : null;
        })()
      : getComponentByPath(this.studioCtx, previewPath);
    const pageQuery = readBusinessQuery(business.search);
    const hashParams = settings;
    const pageHash = business.hash;
    const viewport = parseViewportMode(hashParams.get("viewport"));
    const defaults =
      viewport === "phone" || viewport === "tablet"
        ? DEVICE_VIEWPORTS[viewport]
        : { width: DEFAULT_VIEWPORT_WIDTH, height: DEFAULT_VIEWPORT_HEIGHT };
    const parsedWidth = Number(hashParams.get("width"));
    const parsedHeight = Number(hashParams.get("height"));
    const width = isViewportDimension(parsedWidth)
      ? parsedWidth
      : defaults.width;
    const height = isViewportDimension(parsedHeight)
      ? parsedHeight
      : defaults.height;
    const branchName = hashParams.get(SEARCH_PARAM_BRANCH) || MainBranchId;

    let allVariants: VariantCombo = [];
    let variants: Record<string, string | string[]> = {};
    let global: Record<string, string | string[]> = {};
    if (componentPath) {
      try {
        variants = hackyCast(JSON.parse(hashParams.get("variants") || "{}"));
      } catch (e) {
        Sentry.captureException("Can't parse component variants", {
          extra: {
            variants: hashParams.get("variants"),
          },
        });
      }
      try {
        global = hackyCast(JSON.parse(hashParams.get("global") || "{}"));
      } catch (e) {
        Sentry.captureException("Can't parse global variants", {
          extra: {
            global: hashParams.get("global"),
          },
        });
      }
      allVariants = getAllVariants(
        this.studioCtx,
        componentPath.component,
        variants,
        global,
      );
    }

    this.previewData = {
      full,
      presentationCode: presentation?.code,
      viewport,
      previewPath,
      componentPath: componentPath || previewPath,
      pageQuery,
      pageHash,
      allVariants,
      variants,
      global,
      width,
      height,
      branchName,
    };
  }

  /**
   * Update the component with default page params and query params.
   * Optionally, specify the variants to show.
   */
  async pushComponent(component: Component, allVariants: VariantCombo = []) {
    return this.pushRoute({
      componentPath: {
        component,
        pageParams: component.pageMeta?.params || {},
      },
      pageQuery: component.pageMeta?.query || {},
      pageHash: "",
      allVariants,
    });
  }

  private resolveNavigation(href: string) {
    const current = ensure(this.previewData, "Preview route missing");
    return resolveBusinessHref(
      href,
      {
        pathname: current.previewPath,
        search: mkPreviewSearch(current.pageQuery),
        hash: current.pageHash,
      },
      new URL(getPublicUrl()).origin,
      this.hostFrameCtx.history.location.pathname,
    );
  }

  hrefForNavigation(href: string) {
    const destination = this.resolveNavigation(href);
    if (!destination) {
      return undefined;
    }
    const current = ensure(this.previewData, "Preview route missing");
    const route = mkPreviewRoute(this.studioCtx.siteInfo.id, {
      ...current,
      componentPath: this.componentForNavigation(destination.pathname),
      pageQuery: readBusinessQuery(destination.search),
      pageHash: destination.hash,
      allVariants:
        destination.pathname === current.previewPath ? current.allVariants : [],
    });
    return new URL(createPath(route), getPublicUrl()).href;
  }

  private componentForNavigation(pathname: string) {
    const current = ensure(this.previewData, "Preview route missing");
    if (
      pathname === current.previewPath &&
      typeof current.componentPath !== "string" &&
      !current.componentPath.component.pageMeta
    ) {
      return current.componentPath;
    }
    return getComponentByPath(this.studioCtx, pathname) || pathname;
  }

  /** Handle navigation, whether via a link or an interaction. */
  async handleNavigation(href: string) {
    const current = ensure(this.previewData, "Preview route missing");
    const destination = this.resolveNavigation(href);
    if (!destination) {
      showCanvasPageNavigationNotification(this.studioCtx, href);
      return;
    }
    return this.pushRoute({
      componentPath: this.componentForNavigation(destination.pathname),
      pageQuery: readBusinessQuery(destination.search),
      pageHash: destination.hash,
      allVariants:
        destination.pathname === current.previewPath ? current.allVariants : [],
    });
  }

  /** Update the preview viewport. */
  async pushViewport(
    previewData: Pick<PreviewInputData, "viewport" | "width" | "height">,
  ) {
    return this.pushRoute(previewData);
  }

  private async pushRoute({
    componentPath,
    pageQuery,
    pageHash,
    viewport,
    width,
    height,
    allVariants,
    branchName,
  }: Partial<PreviewInputData>) {
    if (!this.previewData) {
      await this.parseRoute();
    }

    const prev = ensure(this.previewData, "missing previous previewData");
    const location = mkPreviewRoute(this.studioCtx.siteInfo.id, {
      full: prev.full,
      presentationCode: prev.presentationCode,
      viewport: viewport ?? prev.viewport,
      componentPath: componentPath || prev.componentPath,
      pageQuery: pageQuery || prev.pageQuery,
      pageHash: pageHash !== undefined ? pageHash : prev.pageHash,
      width: width || prev.width,
      height: height || prev.height,
      allVariants: allVariants || prev.allVariants,
      branchName: branchName === undefined ? prev.branchName : branchName,
    });
    return this.pushRouteToHistory(location);
  }

  private async pushRouteToHistory(
    location: string | Partial<Location>,
    replace = false,
  ): Promise<void> {
    const target =
      typeof location === "string" ? parsePath(location) : location;
    const history = this.hostFrameCtx.history;
    const expected = {
      pathname: target.pathname ?? history.location.pathname,
      search: target.search ?? "",
      hash: target.hash ?? "",
    };
    const matches = (current: Location) =>
      (["pathname", "search", "hash"] as const).every(
        (key) => (current[key] || "") === (expected[key] || ""),
      );
    await new Promise<void>((resolve, reject) => {
      const dispose = history.listen(({ location: current }) => {
        if (matches(current)) {
          clearTimeout(timer);
          dispose();
          resolve();
        }
      });
      const timer = setTimeout(() => {
        dispose();
        reject(new Error("Native Preview history synchronization timed out"));
      }, 5000);
      try {
        this.studioCtx.appCtx.history[replace ? "replace" : "push"](target);
        if (matches(history.location)) {
          clearTimeout(timer);
          dispose();
          resolve();
        }
      } catch (error) {
        clearTimeout(timer);
        dispose();
        reject(error);
      }
    });
    await this.parseRoute();
  }

  getVariants(): VariantCombo {
    return getAllVariants(
      this.studioCtx,
      this.component,
      this.variants,
      this.global,
    );
  }
}

function getAllVariants(
  studioCtx: StudioCtx,
  component: Component | undefined,
  variants: Record<string, string | string[]>,
  global: Record<string, string | string[]>,
) {
  const componentVariants = component
    ? allComponentVariants(component).filter((v) =>
        isVariantActive(v, variants),
      )
    : [];

  const globalVariants = allGlobalVariants(studioCtx.site, {
    includeDeps: "all",
    excludeMediaQuery: true,
  }).filter((v) => isVariantActive(v, global));

  return [...componentVariants, ...globalVariants];
}

export function mkVariantsRecord(variants: VariantCombo) {
  return Object.fromEntries(
    [...getReferencedVariantGroups(variants)].map((vg) => {
      const vars = vg.variants.filter((v) => variants.includes(v));
      return tuple(
        toVarName(vg.param.variable.name),
        vars.length === 1
          ? toVarName(vars[0].name)
          : vars.map((v) => toVarName(v.name)),
      );
    }),
  );
}

function isVariantActive(
  variant: Variant,
  active: Record<string, string | string[]>,
): boolean {
  const key = toVarName(variant.parent?.param.variable.name || variant.name);
  return (
    active[key] === toVarName(variant.name) ||
    (_.isArray(active[key]) && active[key].includes(toVarName(variant.name)))
  );
}

export function isLiveMode(pathname: string) {
  return !!(
    APP_ROUTES.projectPreview.parse(pathname) ||
    APP_ROUTES.projectPresentation.parse(pathname)
  );
}

function mkPreviewRoute(
  projectId: ProjectId,
  previewData: PreviewInputData,
): Partial<Location> {
  const { full, componentPath, pageQuery } = previewData;
  const pathname = full
    ? APP_ROUTES.projectPresentation.fill({
        code: ensure(previewData.presentationCode, "Presentation code missing"),
      })
    : APP_ROUTES.projectPreview.fill({ projectId });
  const settings = new URLSearchParams(mkPreviewSettings(previewData));
  if (typeof componentPath !== "string" && !componentPath.component.pageMeta) {
    settings.set("component", componentPath.component.uuid);
  }
  const path =
    typeof componentPath === "string"
      ? componentPath
      : componentPath.component.pageMeta
        ? mkPreviewPath(componentPath.component, componentPath.pageParams)
        : "/";
  return {
    pathname,
    search: settings.size ? `?${settings}` : "",
    hash: `#${path.startsWith("/") ? path : `/${path}`}${mkPreviewSearch(pageQuery)}${previewData.pageHash}`,
  };
}

/**
 * Makes a path for a component.
 * If page params are not supplied, the default preview page params will be used.
 */
function mkPreviewPath(
  component: Component,
  pageParams?: Record<string, string | string[]>,
) {
  let path = component.pageMeta?.path || component.uuid;
  if (component.pageMeta) {
    path = formatBusinessHref({
      pathname: path,
      query: pageParams || component.pageMeta.params,
    });
  }
  return path;
}

/**
 * Makes a query string for a component.
 * If query params are not supplied, the default preview query params will be used.
 */
function mkPreviewSearch(pageQuery: BusinessQuery | undefined) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(pageQuery || {})) {
    for (const item of Array.isArray(value) ? value : [value]) {
      query.append(key, item);
    }
  }
  return query.size ? `?${query}` : "";
}

function mkPreviewSettings({
  full,
  viewport,
  width,
  height,
  allVariants,
  branchName,
}: PreviewInputData) {
  const hashParams = new URLSearchParams();

  if (!full && viewport !== "desktop") {
    hashParams.set("viewport", viewport);
    hashParams.set("width", `${width}`);
    hashParams.set("height", `${height}`);
  }
  const variants = mkVariantsRecord(
    allVariants.filter((v) => !isGlobalVariant(v)),
  );
  const global = mkVariantsRecord(
    allVariants.filter((v) => isGlobalVariant(v)),
  );
  if (Object.keys(variants).length > 0) {
    hashParams.set("variants", JSON.stringify(variants));
  }
  if (Object.keys(global).length > 0) {
    hashParams.set("global", JSON.stringify(global));
  }
  if (branchName && branchName !== MainBranchId) {
    hashParams.set(SEARCH_PARAM_BRANCH, branchName);
  }

  return hashParams.toString();
}

export async function getUrlsForLiveMode(
  studioCtx: StudioCtx,
  full: boolean,
): Promise<Partial<Location>> {
  const presentationCode = full
    ? (await studioCtx.appCtx.api.createPresentation(studioCtx.siteInfo.id))
        .code
    : undefined;
  if (
    full &&
    studioCtx.previewCtx?.isLive &&
    studioCtx.previewCtx.previewData
  ) {
    return mkPreviewRoute(studioCtx.siteInfo.id, {
      ...studioCtx.previewCtx.previewData,
      full: true,
      presentationCode,
    });
  }
  const viewCtx = await studioCtx.getPreviewInitialViewCtx();
  const arenaFrame = viewCtx.arenaFrame();
  const component = viewCtx.component;
  const pinManager = new ClientPinManager(
    viewCtx.componentStackFrames()[0],
    viewCtx.globalFrame,
    new Map(),
  );
  const variants = allComponentNonStyleVariants(component).filter((v) =>
    pinManager.isActive(v),
  );
  const global = allGlobalVariants(viewCtx.site, {
    includeDeps: "all",
    excludeMediaQuery: true,
  }).filter((v) => pinManager.isActive(v));

  return mkPreviewRoute(studioCtx.siteInfo.id, {
    full,
    presentationCode,
    viewport: "desktop",
    componentPath: {
      component: viewCtx.component,
      pageParams: viewCtx.component.pageMeta?.params || {},
    },
    pageQuery: viewCtx.component.pageMeta?.query || {},
    pageHash: "",
    allVariants: [...variants, ...global],
    width: full ? DEFAULT_VIEWPORT_WIDTH : arenaFrame.width,
    height: full ? DEFAULT_VIEWPORT_HEIGHT : getFrameHeight(arenaFrame),
    branchName: studioCtx.branchInfo()?.name ?? null,
  });
}

export function getComponentByPath(
  studioCtx: StudioCtx,
  componentPath: string,
) {
  const pages = studioCtx.site.components
    .filter((c) => !!c.pageMeta)
    .map((c) => ({
      id: c.uuid,
      name: c.name,
      path: ensure(c.pageMeta, "Page metadata missing").path,
    }));
  const match = findPreviewPage(pages, componentPath);
  if (!match) {
    return null;
  }
  return {
    component: ensure(
      studioCtx.site.components.find((c) => c.uuid === match.page.id),
      "Matched page missing",
    ),
    pageParams: match.params,
  };
}

const PreviewCtxContext = React.createContext<PreviewCtx | undefined>(
  undefined,
);
export const providesPreviewCtx = withProvider(PreviewCtxContext.Provider);
export const usePreviewCtx = () =>
  ensure(React.useContext(PreviewCtxContext), "Expected PreviewCtx to exist");
