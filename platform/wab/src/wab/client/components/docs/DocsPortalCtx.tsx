import { DocsModelResources } from "@/wab/client/components/docs/DocsModelResources";
import { codegenTypeKey } from "@/wab/client/LocalStorageKey";
import {
  formatDocsCode,
  resolveCollisionsForComponentProp,
  serializeToggledComponent,
  updateComponentCode,
} from "@/wab/client/components/docs/serialize-docs-preview";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { withProvider } from "@/wab/commons/components/ContextUtil";
import { toClassName, toVarName } from "@/wab/shared/codegen/util";
import { ensure, spawn, switchType } from "@/wab/shared/common";
import {
  isCodeComponent,
  isFrameComponent,
  isSubComponent,
} from "@/wab/shared/core/components";
import { ImageAssetType } from "@/wab/shared/core/image-asset-type";
import { TplNamable } from "@/wab/shared/core/tpls";
import { Component, ImageAsset, Param } from "@/wab/shared/model/classes";
import { APP_ROUTES } from "@/wab/shared/route/app-routes";
import { History } from "history";
import React from "react";
import { shallow } from "zustand/shallow";
import { createStore, StoreApi } from "zustand/vanilla";

export type DocsTabKey = "intro" | "components" | "images";

export type IconToggleProp = "title" | "color" | "width" | "height";

export interface DocsNavigationState {
  readonly focusedComponent: Component | undefined;
  readonly focusedElement: TplNamable | undefined;
  readonly focusedIcon: ImageAsset | undefined;
  readonly tab: DocsTabKey | undefined;
  readonly codegenType: "loader" | "codegen";
}
export interface ComponentDocsState {
  readonly code: string | undefined;
  readonly toggles: ReadonlyMap<Param, any>;
}
export interface IconDocsState {
  readonly code: string | undefined;
  readonly toggles: ReadonlyMap<IconToggleProp, string>;
}
type ReadonlyStore<T> = Pick<
  StoreApi<T>,
  "getState" | "getInitialState" | "subscribe"
>;

export class DocsPortalCtx {
  private readonly navigation = createStore<DocsNavigationState>(() => ({
    focusedComponent: undefined,
    focusedElement: undefined,
    focusedIcon: undefined,
    tab: undefined,
    codegenType: "loader",
  }));
  readonly store: ReadonlyStore<DocsNavigationState> = this.navigation;
  private readonly components = new Map<
    Component,
    StoreApi<ComponentDocsState>
  >();
  private readonly icons = new Map<ImageAsset, StoreApi<IconDocsState>>();
  private readonly inactiveIcon = createStore<IconDocsState>(() => ({
    code: undefined,
    toggles: new Map(),
  }));
  private persistedCodegenType = false;
  private modelResources: DocsModelResources | undefined;
  private disposed = false;
  get models() { return this.modelResources ??= new DocsModelResources(this); }
  retainModelResources() {
    this.disposed = false;
    const release = this.models.retain();
    return () => {
      this.disposed = true;
      release();
    };
  }
  dispose() {
    this.disposed = true;
    this.modelResources?.dispose();
    this.modelResources = undefined;
    this.components.clear();
    this.icons.clear();
  }
  constructor(public studioCtx: StudioCtx) {}

  private updateNavigation(patch: Partial<DocsNavigationState>) {
    this.navigation.setState((previous) => {
      const next = { ...previous, ...patch };
      return shallow(previous, next) ? previous : next;
    }, true);
  }
  private componentState(component: Component) {
    let store = this.components.get(component);
    if (!store) {
      store = createStore<ComponentDocsState>(() => ({
        code: undefined,
        toggles: new Map(),
      }));
      this.components.set(component, store);
    }
    return store;
  }
  private iconState(icon: ImageAsset) {
    let store = this.icons.get(icon);
    if (!store) {
      store = createStore<IconDocsState>(() => ({
        code: undefined,
        toggles: new Map(),
      }));
      this.icons.set(icon, store);
    }
    return store;
  }
  getComponentStore(component: Component): ReadonlyStore<ComponentDocsState> {
    return this.componentState(component);
  }
  getIconStore(icon: ImageAsset | undefined): ReadonlyStore<IconDocsState> {
    return icon ? this.iconState(icon) : this.inactiveIcon;
  }

  // Consumers bind to their selected resource, so editing one example never
  // rebuilds other resources or responds to hover-only navigation updates.
  subscribePreviewInputs(
    resource: Component | ImageAsset | undefined,
    listener: () => void,
  ) {
    const disposeMode = this.store.subscribe((next, previous) => {
      if (next.codegenType !== previous.codegenType) {
        listener();
      }
    });
    const disposeResource =
      resource &&
      switchType(resource)
        .when(Component, (component) =>
          this.componentState(component).subscribe(listener),
        )
        .when(ImageAsset, (icon) => this.iconState(icon).subscribe(listener))
        .result();
    return () => {
      disposeMode();
      disposeResource?.();
    };
  }

  tryGetFocusedComponent() {
    return this.store.getState().focusedComponent;
  }
  getFocusedComponent() {
    return ensure(this.tryGetFocusedComponent(), "missing focusedComponent");
  }
  getCodegenType() {
    return this.store.getState().codegenType;
  }
  isUsingLoader() {
    return this.getCodegenType() === "loader";
  }
  setCodegenType(type: "loader" | "codegen") {
    const changed = type !== this.getCodegenType();
    if (!changed && this.persistedCodegenType) {
      return;
    }
    this.persistedCodegenType = true;
    if (changed) {
      this.updateNavigation({ codegenType: type });
      this.resetComponentCustomCode();
    }
    spawn(this.studioCtx.appCtx.api.addStorageItem(codegenTypeKey, type));
  }
  setFocusedComponent(component: Component) {
    this.updateNavigation({
      focusedComponent: component,
      focusedElement: undefined,
      focusedIcon: undefined,
    });
    if (!this.getComponentCustomCode(component)) {
      this.setComponentCustomCode(
        component,
        "// Try directly editing this code to pass in different props and overrides\n" +
          serializeToggledComponent(
            component,
            this.getComponentToggles(component),
            this.isUsingLoader(),
          ),
        true,
      );
    }
  }
  getFocusedNode() {
    return this.store.getState().focusedElement;
  }
  setFocusedElement(node: TplNamable | undefined) {
    this.updateNavigation({ focusedElement: node });
  }
  getComponentCustomCode(component: Component) {
    return this.componentState(component).getState().code;
  }

  private formatComponentCode(
    store: StoreApi<ComponentDocsState>,
    code: string,
  ) {
    spawn(
      formatDocsCode(code).then((formatted) => {
        if (this.disposed) { return; }
        // Preserve user edits and resets made while formatting was running.
        store.setState(
          (previous) =>
            previous.code !== code || previous.code === formatted
              ? previous
              : { ...previous, code: formatted },
          true,
        );
      }),
    );
  }
  setComponentCustomCode(
    component: Component,
    code: string | null,
    format = false,
  ) {
    const store = this.componentState(component);
    const value = code ?? undefined;
    if (store.getState().code === value) {
      return;
    }
    store.setState((previous) => ({ ...previous, code: value }), true);
    if (format && value !== undefined) {
      this.formatComponentCode(store, value);
    }
  }
  resetComponentCustomCode() {
    this.components.forEach((store) =>
      store.setState(
        (previous) =>
          previous.code === undefined
            ? previous
            : { ...previous, code: undefined },
        true,
      ),
    );
  }
  setComponentToggle(component: Component, param: Param, value: any) {
    const store = this.componentState(component);
    const previous = store.getState();
    const unchangedToggle =
      value == null
        ? !previous.toggles.has(param)
        : Object.is(previous.toggles.get(param), value) ||
          (Array.isArray(value) &&
            Array.isArray(previous.toggles.get(param)) &&
            shallow(previous.toggles.get(param), value));
    let toggles = previous.toggles;
    if (!unchangedToggle) {
      const updated = new Map(previous.toggles);
      // Own the selected array; callers must not mutate an existing snapshot.
      if (value == null) {
        updated.delete(param);
      } else {
        updated.set(param, Array.isArray(value) ? value.slice() : value);
      }
      toggles = updated;
    }
    const isVariant = !!component.variantGroups.find(
      (group) => group.param === param,
    );
    const code =
      updateComponentCode(
        {
          component,
          code: previous.code,
          toggles,
          useLoader: this.isUsingLoader(),
        },
        resolveCollisionsForComponentProp(
          component,
          toVarName(param.variable.name),
          isVariant ? "variant" : "arg",
        ),
        value,
        false,
        param,
      ) ?? undefined;
    // An equal control can still repair a manually edited code argument.
    // Compare both outputs before publishing, retaining the Map on code-only edits.
    if (unchangedToggle && code === previous.code) {
      return;
    }
    store.setState({ toggles, code }, true);
    if (code !== undefined && code !== previous.code) {
      this.formatComponentCode(store, code);
    }
  }
  setComponentOverride(
    component: Component,
    key: string,
    innerPath: string[],
    value: string,
    isRootProp: boolean,
  ) {
    this.updateComponentCustomCode(
      component,
      [
        ...resolveCollisionsForComponentProp(
          component,
          key,
          isRootProp ? "rootProp" : "override",
        ),
        ...innerPath,
      ],
      value,
      true,
    );
  }
  updateComponentCustomCode(
    component: Component,
    path: string[],
    value: any,
    isValueSerialized: boolean,
    param?: Param,
  ) {
    const previous = this.componentState(component).getState();
    const code = updateComponentCode(
      {
        component,
        code: previous.code,
        toggles: previous.toggles,
        useLoader: this.isUsingLoader(),
      },
      path,
      value,
      isValueSerialized,
      param,
    );
    this.setComponentCustomCode(component, code, true);
  }
  getComponentToggles(component: Component) {
    return this.componentState(component).getState().toggles;
  }
  getComponentToggle(component: Component, param: Param) {
    return this.getComponentToggles(component).get(param);
  }
  resetComponentToggles(component: Component) {
    this.componentState(component).setState(
      (previous) =>
        !previous.toggles.size && previous.code === undefined
          ? previous
          : { code: undefined, toggles: new Map() },
      true,
    );
  }
  tryGetFocusedIcon() {
    return this.store.getState().focusedIcon;
  }
  getFocusedIcon() {
    return ensure(this.tryGetFocusedIcon(), "missing focusedIcon");
  }
  setFocusedIcon(icon: ImageAsset) {
    this.updateNavigation({
      focusedIcon: icon,
      focusedElement: undefined,
      focusedComponent: undefined,
    });
  }
  resetFocus() {
    this.updateNavigation({
      focusedComponent: undefined,
      focusedElement: undefined,
      focusedIcon: undefined,
    });
  }
  getIconToggles(icon: ImageAsset) {
    return this.iconState(icon).getState().toggles;
  }
  getIconToggle(icon: ImageAsset, prop: IconToggleProp) {
    return this.getIconToggles(icon).get(prop);
  }
  setIconToggle(
    icon: ImageAsset,
    prop: IconToggleProp,
    value: string | null | undefined,
  ) {
    const store = this.iconState(icon),
      previous = store.getState();
    if (
      value == null
        ? !previous.toggles.has(prop)
        : previous.toggles.get(prop) === value
    ) {
      return;
    }
    const toggles = new Map(previous.toggles);
    if (value == null) {
      toggles.delete(prop);
    } else {
      toggles.set(prop, value);
    }
    store.setState({ code: undefined, toggles }, true);
  }
  resetIconToggles(icon: ImageAsset) {
    this.iconState(icon).setState(
      (previous) =>
        !previous.toggles.size && previous.code === undefined
          ? previous
          : { code: undefined, toggles: new Map() },
      true,
    );
  }
  getIconCustomCode(icon: ImageAsset) {
    return this.iconState(icon).getState().code;
  }
  setIconCustomCode(icon: ImageAsset, code: string | null) {
    this.iconState(icon).setState(
      (previous) =>
        previous.code === (code ?? undefined)
          ? previous
          : { ...previous, code: code ?? undefined },
      true,
    );
  }

  updateStateFromRoute(history: History, path: string) {
    const projectId = this.studioCtx.siteInfo.id;
    const components = this.studioCtx.site.components.filter(
      (c) => !isFrameComponent(c) && !isCodeComponent(c) && !isSubComponent(c),
    );
    const icons = this.studioCtx.site.imageAssets.filter(
      (icon) => icon.type === ImageAssetType.Icon && !!icon.dataUri,
    );
    const matchDocs = APP_ROUTES.projectDocs.parse(path, false);
    if (!matchDocs) {
      // Not a Docs Portal URL
      return;
    }

    const matchComponent = APP_ROUTES.projectDocsComponent.parse(path);
    const matchIcon = APP_ROUTES.projectDocsIcon.parse(path);
    const matchComponents = APP_ROUTES.projectDocsComponents.parse(path);
    const matchIcons = APP_ROUTES.projectDocsIcons.parse(path);
    const matchCodegenType = APP_ROUTES.projectDocsCodegenType.parse(path);
    const codegenType = [
      matchComponent,
      matchIcon,
      matchComponents,
      matchIcons,
      matchCodegenType,
    ].find((match) => match?.codegenType)?.codegenType;

    // No codegen type selected, show the intro tab.
    if (!codegenType) {
      this.updateNavigation({ tab: "intro" });
      this.resetFocus();
      return;
    }

    this.setCodegenType(codegenType);

    const replace = (pathname: string) => {
      this.studioCtx.appCtx.history.replace(pathname);
    };

    const accessComponents = () => {
      if (components.length !== 0) {
        // Redirects to first component
        replace(
          APP_ROUTES.projectDocsComponent.fill({
            projectId: projectId,
            componentIdOrClassName:
              toClassName(components[0].name) || components[0].uuid,
            codegenType,
          }),
        );
      } else {
        if (matchComponents) {
          this.updateNavigation({ tab: "components" });
          this.resetFocus();
        } else {
          // Redirects to docs/components
          replace(
            APP_ROUTES.projectDocsComponents.fill({
              projectId: projectId,
              codegenType,
            }),
          );
        }
      }
    };
    const accessIcons = () => {
      if (icons.length !== 0) {
        // Redirects to first icon
        replace(
          APP_ROUTES.projectDocsIcon.fill({
            projectId: projectId,
            iconIdOrClassName: toClassName(icons[0].name) || icons[0].uuid,
            codegenType,
          }),
        );
      } else {
        if (matchIcons) {
          this.updateNavigation({ tab: "images" });
          this.resetFocus();
        } else {
          // Redirects to docs/icons
          replace(
            APP_ROUTES.projectDocsIcons.fill({
              projectId: projectId,
              codegenType,
            }),
          );
        }
      }
    };

    if (matchComponent) {
      const componentIdOrClassName = matchComponent.componentIdOrClassName;
      const component = components.find(
        (value) =>
          value.uuid === componentIdOrClassName ||
          toClassName(value.name) === componentIdOrClassName,
      );
      if (!component) {
        accessComponents();
      } else {
        this.setFocusedComponent(component);
        this.updateNavigation({ tab: "components" });
      }
    } else if (matchIcon) {
      const iconIdOrClassName = matchIcon.iconIdOrClassName;
      const icon = icons.find(
        (value) =>
          value.uuid === iconIdOrClassName ||
          toClassName(value.name) === iconIdOrClassName,
      );
      if (!icon) {
        replace(
          APP_ROUTES.projectDocs.fill({
            projectId: projectId,
          }),
        );
      } else {
        this.setFocusedIcon(icon);
        this.updateNavigation({ tab: "images" });
      }
    } else if (matchComponents) {
      // docs/components -> docs/component/firstComponent
      accessComponents();
    } else if (matchIcons) {
      // docs/icons -> docs/icon/firstIcon
      accessIcons();
    } else {
      this.resetFocus();
      this.docsTabKey = "intro";
    }
  }

  get docsTabKey() {
    return this.store.getState().tab;
  }

  set docsTabKey(key: DocsTabKey | undefined) {
    this.updateNavigation({ tab: key });
  }
}

const DocsPortalCtxContext = React.createContext<DocsPortalCtx | undefined>(
  undefined,
);
export const providesDocsPortalCtx = withProvider(
  DocsPortalCtxContext.Provider,
);
export const useDocsPortalCtx = () =>
  ensure(
    React.useContext(DocsPortalCtxContext),
    "missing DocsPortalCtxContext",
  );

export function codegenTypeToRoute(
  codegenType: "cms" | "codegen",
): "codegen" | "loader" {
  return codegenType === "cms" ? "loader" : codegenType;
}
