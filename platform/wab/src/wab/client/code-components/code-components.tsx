import { showError, reportError } from "@/wab/client/ErrorNotifications";
import { confirmRemovedCodeComponentVariants, confirmRemovedTokens, fixInvalidReactVersion, fixMissingCodeComponents, notifyInvalidImportName, promptHostLessPackageInfo, showModalToRefreshCodeComponentProps } from "@/wab/client/components/modals/codeComponentModals";
import { updateSiteCustomFunctions } from "@/wab/client/components/modals/customFunctionModals";
import { reactConfirm } from "@/wab/client/components/quick-modals";
import {
  getHostLessPkg,
  getSortedHostLessPkgs,
  getVersionForCanvasPackages,
} from "@/wab/client/components/studio/studio-bundles";
import { scriptExec } from "@/wab/client/dom-utils";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { trackEvent } from "@/wab/client/tracking";
import { isBuiltinCodeComponent } from "@/wab/shared/code-components/builtin-code-components";
import { BadPresetSchemaError, CodeComponentSyncCallbackFns, CodeComponentsRegistry, SelfReferencingComponent, UnknownComponentError, UnknownComponentPropError, appendCodeComponentMetaToModel, elementSchemaToTpl, getPropTypeType, syncCodeComponents } from "@/wab/shared/code-components/code-components";
import { WritablePart, assert, assignReadonly, ensure, ensureInstance, removeWhere, safeCast, xDifference } from "@/wab/shared/common";
import { getComponentPropTypes } from "@/wab/shared/component-props";
import {
  CodeComponent,
  ComponentType,
  isCodeComponent,
  isDefaultComponent,
} from "@/wab/shared/core/components";
import { customFunctionId } from "@/wab/shared/core/query-ids";
import { isHostLessPackage } from "@/wab/shared/core/sites";
import { TplCodeComponent } from "@/wab/shared/core/tpls";
import { isAdminTeamEmail } from "@/wab/shared/devflag-utils";
import {
  Component,
  HostLessPackageInfo,
  Site,
  TplNode,
} from "@/wab/shared/model/classes";
import { PlasmicElement } from "@plasmicapp/host";
import { type CodeComponentMeta } from "@plasmicapp/host/registerComponent";
import { type GlobalContextMeta } from "@plasmicapp/host/registerGlobalContext";
import { message as antdMessage, notification } from "antd";
import { ok, safeTry } from "neverthrow";
import React from "react";

function onCreateCodeComponent(
  name: string,
  meta: CodeComponentMeta<any> | GlobalContextMeta<any>,
) {
  // Segment track
  trackEvent("Create code component", {
    componentName: name,
    type: ComponentType.Code,
    importPath: meta.importPath,
    isLocalComponent: meta.importPath.startsWith("./"),
    locationHref: location.href,
  });
}

export const ccClientCallbackFns: CodeComponentSyncCallbackFns = {
  onMissingCodeComponents: (ctx, missingComponents, missingContexts) =>
    fixMissingCodeComponents(
      ensureInstance(ctx, StudioCtx),
      missingComponents,
      missingContexts,
    ),
  onInvalidReactVersion: (ctx, hostLessPackageInfo) =>
    fixInvalidReactVersion(ensureInstance(ctx, StudioCtx), hostLessPackageInfo),
  onCreateCodeComponent,
  onInvalidComponentImportNames: notifyInvalidImportName,
  onAddedNewProps: () => {
    notification.info({
      message: translate(
        getUiLocale(),
        "New props have been registered for some code components",
      ),
    });
  },
  onStaleProps: async (ctx, userStaleDiffs, _opts) => {
    return await showModalToRefreshCodeComponentProps(userStaleDiffs, _opts);
  },
  onNewDefaultComponents: (detail) => {
    console.info("Default component added", detail);
    void antdMessage.info({ content: translate(getUiLocale(), "Default component added"), duration: 4 });
  },
  onSchemaToTplWarnings: (warnings) => {
    warnings.forEach((err) => {
      console.warn("[code-components]", err.message, err.description);
      if (err.shouldLogError) {
        reportError(new Error(err.message));
      }
    });
  },
  onSchemaToTplError: (err) => {
    void showError(err, { title: translate(getUiLocale(), "Component registration failed") });
  },
  onElementStyleWarnings: (warnings) => {
    warnings.forEach((err) => {
      console.warn("[code-components]", err.message, err.description);
      if (err.shouldLogError) {
        reportError(new Error(err.message));
      }
    });
  },
  onInvalidJsonForDefaultValue: (detail) => {
    showError(detail, { title: translate(getUiLocale(), "Invalid JSON"), type: "warning" });
  },
  onUpdatedTokens(opts) {
    const { newTokens, updatedTokens, removedTokens } = opts;
    notification.info({
      message: translate(getUiLocale(), "Registered tokens updated"),
      description: (
        <>
          {newTokens.length > 0 && (
            <p>
              <strong>
                <UiText message={"New tokens:"} />{" "}
              </strong>{" "}
              {newTokens.map((t) => `"${t.name}"`)}
            </p>
          )}
          {updatedTokens.length > 0 && (
            <p>
              <strong>
                <UiText message={"Updated tokens:"} />{" "}
              </strong>
              {updatedTokens.map((t) => `"${t.name}"`)}
            </p>
          )}
          {removedTokens.length > 0 && (
            <p>
              <strong>
                <UiText message={"Removed tokens:"} />{" "}
              </strong>{" "}
              {removedTokens.map((t) => `"${t.name}"`)}
            </p>
          )}
        </>
      ),
    });
  },
  async onUpdatedCustomFunctions(opts) {
    const { ctx, newFunctions, updatedFunctions } = opts;
    const removedFunctions = await updateSiteCustomFunctions({
      ctx: ensureInstance(ctx, StudioCtx),
      newFunctions,
      updatedFunctions,
      removedFunctions: opts.removedFunctions,
    });
    notification.info({
      message: translate(getUiLocale(), "Registered functions updated"),
      description: (
        <>
          {newFunctions.length > 0 && (
            <p>
              <strong>
                <UiText message={"New functions:"} />{" "}
              </strong>{" "}
              {newFunctions.map((f) => `"${customFunctionId(f)}"`).join(", ")}
            </p>
          )}
          {updatedFunctions.length > 0 && (
            <p>
              <strong>
                <UiText message={"Updated functions:"} />{" "}
              </strong>
              {updatedFunctions
                .map((f) => `"${customFunctionId(f)}"`)
                .join(", ")}
            </p>
          )}
          {removedFunctions.length > 0 && (
            <p>
              <strong>
                <UiText message={"Removed functions:"} />{" "}
              </strong>{" "}
              {removedFunctions
                .map((f) => `"${customFunctionId(f)}"`)
                .join(", ")}
            </p>
          )}
        </>
      ),
    });
  },
  onUpdatedCodeLibraries(opts) {
    const { newLibraries, updatedLibraries, removedLibraries } = opts;
    notification.info({
      message: translate(getUiLocale(), "Registered libraries updated"),
      description: (
        <>
          {newLibraries.length > 0 && (
            <p>
              <strong>
                <UiText message={"New libraries:"} />{" "}
              </strong>{" "}
              {newLibraries.map((l) => `"${l.name}"`).join(", ")}
            </p>
          )}
          {removedLibraries.length > 0 && (
            <p>
              <strong>
                <UiText message={"Updated libraries:"} />{" "}
              </strong>
              {removedLibraries.map((l) => `"${l.name}"`).join(", ")}
            </p>
          )}
          {updatedLibraries.length > 0 && (
            <p>
              <strong>
                <UiText message={"Removed libraries:"} />{" "}
              </strong>{" "}
              {updatedLibraries.map((l) => `"${l.name}"`).join(", ")}
            </p>
          )}
        </>
      ),
    });
  },
  confirmRemovedCodeComponentVariants: (removedSelectorsByComponent) =>
    confirmRemovedCodeComponentVariants(removedSelectorsByComponent),
  confirmRemovedTokens: (removedTokens) => confirmRemovedTokens(removedTokens),
};

export async function syncCodeComponentsAndHandleErrors(
  studioCtx: StudioCtx,
  opts?: { force?: boolean },
) {
  const maybeError = await syncCodeComponents(
    studioCtx,
    ccClientCallbackFns,
    opts,
  );

  if (!maybeError.isErr()) {
    appendCodeComponentMetaToModel(
      studioCtx.site,
      studioCtx.getCodeComponentsAndContextsRegistration(),
    );
  }

  // Handle errors
  return maybeError.match(
    () => {
      /**/
    },
    safeCast<(err: Error) => void>((err) => {
      showError(err, { title: translate(getUiLocale(), "Component registration failed") });
      return new Promise((_resolve) => {
        // Never resolve since Studio can have components in invalid states
      });
    }),
  );
}

export async function maybeConvertToHostLessProject(studioCtx: StudioCtx) {
  if (
    (studioCtx.appCtx.appConfig.setHostLessProject ||
      isHostLessPackage(studioCtx.site)) &&
    isAdminTeamEmail(
      studioCtx.appCtx.selfInfo?.email,
      studioCtx.appCtx.appConfig,
    )
  ) {
    const pkg = await promptHostLessPackageInfo(
      studioCtx.site.hostLessPackageInfo
        ? { ...studioCtx.site.hostLessPackageInfo }
        : undefined,
    );

    if (pkg) {
      // Get the original list of components
      const existingComps = [
        ...studioCtx.site.components.filter(
          (c) => isCodeComponent(c) && !isBuiltinCodeComponent(c),
        ),
      ];
      const existingGlobalContexts = [...studioCtx.site.globalContexts];
      const existingStyleTokens = studioCtx.site.styleTokens.filter(
        (s) => s.isRegistered,
      );
      const existingDataTokens = studioCtx.site.dataTokens.filter(
        (s) => s.isRegistered,
      );

      const existingFunctions = [...studioCtx.site.customFunctions];
      const existingLibs = [...studioCtx.site.codeLibraries];

      const clearSite = async () => {
        await studioCtx.change(() => {
          const emptySite: Omit<WritablePart<Site>, "uid" | "typeTag"> = {
            components: [],
            arenas: [],
            pageArenas: [],
            componentArenas: [],
            globalVariantGroups: [],
            userManagedFonts: [],
            styleTokens: [],
            styleTokenOverrides: [],
            dataTokens: [],
            mixins: [],
            animationSequences: [],
            activeTheme: null,
            imageAssets: [],
            projectDependencies: [],
            activeScreenVariantGroup: null,
            flags: {},
            globalContexts: [],
            splits: [],
            defaultComponents: {},
            defaultPageRoleId: null,
            pageWrapper: null,
            customFunctions: [],
            codeLibraries: [],
          };
          Object.assign(studioCtx.site, emptySite);
          studioCtx.site.themes.forEach((theme) => {
            // Clear site default styles
            theme.styles = [];
            theme.defaultStyle.rs.values = {};
          });
          return ok();
        });
      };

      await clearSite();

      // First, install the deps
      for (const [_depName, depModule] of await getSortedHostLessPkgs(
        pkg.deps,
        getVersionForCanvasPackages(window.parent),
      )) {
        scriptExec(window.parent, depModule);
      }
      studioCtx.codeComponentsRegistry.clear();
      await syncCodeComponentsAndHandleErrors(studioCtx, { force: true });

      // Take a snapshot of components and tokens from deps, so we know they
      // are not from this pkg
      const depComps = new Set(
        studioCtx.site.components.filter(
          (c) => isCodeComponent(c) || isDefaultComponent(studioCtx.site, c),
        ),
      );

      const depStyleTokens = new Set(
        studioCtx.site.styleTokens.filter((s) => s.isRegistered),
      );
      const depDataTokens = new Set(
        studioCtx.site.dataTokens.filter((s) => s.isRegistered),
      );

      const depFunctions = new Set(studioCtx.site.customFunctions);

      const depLibs = new Set(studioCtx.site.codeLibraries);

      // Now install the actual package
      scriptExec(
        window.parent,
        await getHostLessPkg(
          pkg.name,
          getVersionForCanvasPackages(window.parent),
        ),
      );
      studioCtx.codeComponentsRegistry.clear();
      await syncCodeComponentsAndHandleErrors(studioCtx, { force: true });
      assert(
        studioCtx.site.components.some(isCodeComponent),
        "No code components found",
      );

      // Filter the components that don't come from the deps, and get their
      // registered names
      const nonDepCompNames = new Set(
        studioCtx.site.components
          .filter(
            (c) =>
              (isCodeComponent(c) || isDefaultComponent(studioCtx.site, c)) &&
              !depComps.has(c),
          )
          .map((c) => c.name),
      );

      const nonDepStyleTokenNames = new Set(
        studioCtx.site.styleTokens
          .filter((s) => s.isRegistered && !depStyleTokens.has(s))
          .map((c) => c.name),
      );
      const nonDepDataTokenNames = new Set(
        studioCtx.site.dataTokens
          .filter((s) => s.isRegistered && !depDataTokens.has(s))
          .map((c) => c.name),
      );

      const nonDepFunctions = new Set(
        studioCtx.site.customFunctions
          .filter((f) => !depFunctions.has(f))
          .map((f) => customFunctionId(f)),
      );

      const nonDepLibs = new Set(
        studioCtx.site.codeLibraries
          .filter((l) => !depLibs.has(l))
          .map((l) => l.name),
      );

      // Now we clear the site again to match the components with the existing
      // instances
      await clearSite();

      // Reset the existing components
      await studioCtx.change(() => {
        studioCtx.site.components = [...existingComps];
        studioCtx.site.globalContexts = [...existingGlobalContexts];
        studioCtx.site.styleTokens = [...existingStyleTokens];
        studioCtx.site.dataTokens = [...existingDataTokens];
        studioCtx.site.customFunctions = [...existingFunctions];
        studioCtx.site.codeLibraries = [...existingLibs];
        return ok();
      });

      await syncCodeComponentsAndHandleErrors(studioCtx, { force: true });

      await studioCtx.change(
        () => {
          const deletedComponents = new Set(studioCtx.site.components);
          studioCtx.site.components = studioCtx.site.components.filter(
            (c) =>
              (isCodeComponent(c) || isDefaultComponent(studioCtx.site, c)) &&
              nonDepCompNames.has(c.name),
          );
          studioCtx.site.styleTokens = studioCtx.site.styleTokens.filter(
            (s) => s.isRegistered && nonDepStyleTokenNames.has(s.name),
          );
          studioCtx.site.dataTokens = studioCtx.site.dataTokens.filter(
            (s) => s.isRegistered && nonDepDataTokenNames.has(s.name),
          );
          studioCtx.site.customFunctions =
            studioCtx.site.customFunctions.filter((f) =>
              nonDepFunctions.has(customFunctionId(f)),
            );
          studioCtx.site.codeLibraries = studioCtx.site.codeLibraries.filter(
            (l) => nonDepLibs.has(l.name),
          );
          assignReadonly(studioCtx.site, {
            hostLessPackageInfo: new HostLessPackageInfo({
              name: pkg.name,
              cssImport: pkg.cssImport,
              npmPkg: pkg.npmPkg,
              deps: pkg.deps,
              registerCalls: [],
              minimumReactVersion: pkg.minimumReactVersion ?? null,
            }),
          });
          studioCtx.site.components
            .filter(isCodeComponent)
            .forEach((c) => (c.codeComponentMeta.isHostLess = true));
          studioCtx.site.components.forEach((c) => deletedComponents.delete(c));
          removeWhere(studioCtx.site.globalContexts, (tpl) =>
            deletedComponents.has(tpl.component),
          );
          return ok();
        },
        { noUndoRecord: true },
      );

      const deletedComps = xDifference(
        existingComps,
        studioCtx.site.components,
      );

      if (deletedComps.size > 0) {
        const proceed = await reactConfirm({
          message:
            "The following components have been deleted, would you like to proceed? " +
            [...deletedComps.keys()].map((c) => c.name),
        });
        if (!proceed) {
          const latestVersion = ensure(
            (await studioCtx.getProjectReleases())[0],
            "No latest version found",
          );
          await studioCtx.revertTo(latestVersion);
          return;
        }
      }

      await studioCtx.save();
      await studioCtx.publish(undefined, undefined, undefined, {
        hostLessPackage: true,
      });
    }
  }
}

export function elementSchemaToTplAndLogErrors(
  site: Site,
  component: CodeComponent | undefined,
  rootSchema: PlasmicElement,
) {
  return safeTry<
    TplNode,
    | BadPresetSchemaError
    | UnknownComponentError
    | SelfReferencingComponent
    | UnknownComponentPropError
  >(function* () {
    const { tpl, warnings } = yield* elementSchemaToTpl(
      site,
      component,
      rootSchema,
      {
        codeComponentsOnly: true,
      },
    );

    warnings.forEach((err) => {
      showError(err, { title: translate(getUiLocale(), "Component registration failed") });
      if (err.shouldLogError) {
        reportError(new Error(err.message));
      }
    });
    return ok(tpl);
  });
}

export function isTplCodeComponentStyleable(
  ccRegistry: CodeComponentsRegistry,
  tpl: TplCodeComponent,
) {
  const meta = ccRegistry
    .getRegisteredCodeComponentsMap()
    .get(tpl.component.name)?.meta;
  if (meta?.styleSections === false) {
    // Not styleable if explicitly opted out of styling
    return false;
  }
  return true;
}

export function getControlModePropType(viewCtx, component: Component) {
  const propTypes = getComponentPropTypes(viewCtx, component);
  const maybeModeProp = Object.entries(propTypes).find(
    ([_name, propType]) => getPropTypeType(propType) === "controlMode",
  );
  return maybeModeProp
    ? { propName: maybeModeProp[0], propType: maybeModeProp[1] }
    : undefined;
}

export function hasSimplifiedMode(viewCtx: ViewCtx, component: Component) {
  return !!getControlModePropType(viewCtx, component);
}
