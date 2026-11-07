import type { TokenRegistration, TraitMeta } from "@plasmicapp/host";
import { PlasmicModulesFetcher } from "@plasmicapp/loader-core";
import React from "react";
import ReactDOM from "react-dom";
import * as jsxDevRuntime from "react/jsx-dev-runtime";
import * as jsxRuntime from "react/jsx-runtime";
import {
  BaseInternalPlasmicComponentLoader,
  CodeComponentMeta,
  CustomFunctionMeta,
  GlobalContextMeta,
  InitOptions,
  REGISTERED_CODE_COMPONENT_HELPERS,
  REGISTERED_CUSTOM_FUNCTIONS,
  SUBSTITUTED_COMPONENTS,
  SUBSTITUTED_GLOBAL_VARIANT_HOOKS,
  internalSetRegisteredFunction,
} from "./loader-shared";

/** Fetches bundles and executes server queries without rendering client components. */
export class InternalServerPlasmicLoader extends BaseInternalPlasmicComponentLoader {
  constructor(opts: InitOptions) {
    super({
      opts,
      fetcher: new PlasmicModulesFetcher(opts),
      onBundleMerged: () => this.refreshRegistry(),
      builtinModules: {
        react: React,
        "react-dom": ReactDOM,
        "react/jsx-runtime": jsxRuntime,
        "react/jsx-dev-runtime": jsxDevRuntime,
        "@plasmicapp/loader-runtime-registry": {
          components: SUBSTITUTED_COMPONENTS,
          globalVariantHooks: SUBSTITUTED_GLOBAL_VARIANT_HOOKS,
          codeComponentHelpers: REGISTERED_CODE_COMPONENT_HELPERS,
          functions: REGISTERED_CUSTOM_FUNCTIONS,
        },
      },
    });
  }

  registerComponent<T extends React.ComponentType<any>>(
    component: T,
    meta: CodeComponentMeta<React.ComponentProps<T>>
  ) {
    this.substituteComponent(component, { name: meta.name, isCode: true });
  }

  registerFunction<F extends (...args: any[]) => any>(fn: F, meta: CustomFunctionMeta<F>) {
    internalSetRegisteredFunction(fn, meta);
  }

  registerGlobalContext<T extends React.ComponentType<any>>(
    context: T,
    meta: GlobalContextMeta<React.ComponentProps<T>>
  ) {
    this.substituteComponent(context, { name: meta.name, isCode: true });
  }

  registerTrait(_trait: string, _meta: TraitMeta) {}
  registerToken(_token: TokenRegistration) {}
}
