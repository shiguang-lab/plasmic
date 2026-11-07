import { ensureBaseVariant } from "@/wab/shared/TplMgr";
import { VariantCombo } from "@/wab/shared/Variants";
import { isCodeComponentWithHelpers } from "@/wab/shared/code-components/code-components";
import {
  getImportedCodeComponentHelperName,
  makePlasmicIsPreviewRootComponent,
} from "@/wab/shared/codegen/react-p/serialize-utils";
import { SerializerBaseContext } from "@/wab/shared/codegen/react-p/types";
import {
  getOrderedExplicitVSettings,
  joinVariantVals,
} from "@/wab/shared/codegen/react-p/utils";
import { jsLiteral, toVarName } from "@/wab/shared/codegen/util";
import { arrayEq, ensure } from "@/wab/shared/common";
import { getRawCode } from "@/wab/shared/core/exprs";
import { isSlotSelection } from "@/wab/shared/core/slots";
import { ParamExportType } from "@/wab/shared/core/lang";
import {
  getStateOnChangePropName,
  getStateValuePropName,
  getStateVarName,
  getVirtualWritableStateInitialValue,
  isReadonlyState,
  isWritableState,
  isStateUsedInExpr,
} from "@/wab/shared/core/states";
import {
  ancestorsUp,
  ancestorsUpWithSlotSelections,
  findExprsInComponent,
  isTplCodeComponent,
  isTplComponent,
  isTplRepeated,
  isTplTag,
  tplHasRef,
} from "@/wab/shared/core/tpls";
import { parseExpr } from "@/wab/shared/eval/expression-parser";
import {
  Component,
  State,
  ensureKnownNamedState,
  isKnownRenderFuncType,
} from "@/wab/shared/model/classes";

export function shouldSerializeState(component: Component, state: State) {
  if (
    !state.tplNode ||
    !state.implicitState ||
    !isWritableState(state.implicitState) ||
    !isTplCodeComponent(state.tplNode) ||
    !ancestorsUpWithSlotSelections(state.tplNode).some(
      (ancestor) => isSlotSelection(ancestor) && isKnownRenderFuncType(ancestor.slotParam.type),
    )
  ) {
    return true;
  }

  // Native render callbacks can create many instances of one template. An
  // unused implicit binding would feed one instance's event back into them all.
  // Keep native instance state unless authored expressions access that state.
  const root = toVarName(ensure(state.tplNode.name, "Implicit state node must be named"));
  return findExprsInComponent(component).some(({ expr }) => {
    const info = parseExpr(expr);
    return isStateUsedInExpr(state, expr) || info.usesUnknownDollarVarKeys.$state ||
      [...info.usedDollarVarKeys.$state].some((key) =>
        key === root || key.startsWith(`${root}.`) || key.startsWith(`${root}[`),
      );
  });
}

export function serializeInitFunc(
  state: State,
  ctx: SerializerBaseContext,
  isForRegisterInitFunc?: boolean,
  shouldTransformWritableStates: boolean | undefined = ctx.exportOpts
    .shouldTransformWritableStates,
) {
  let initFunc: undefined | string = undefined;
  if (
    state.tplNode &&
    ancestorsUp(state.tplNode).filter(isTplRepeated).length > 0 &&
    !isForRegisterInitFunc
  ) {
    return undefined;
  }
  const exprCtx = ctx.exprCtx;
  if (!state.tplNode && state.variableType === "variant") {
    initFunc = `({$props, $state, $queries, $q, $ctx}) => (${
      state.param.defaultExpr
        ? getRawCode(state.param.defaultExpr, exprCtx) + " ?? "
        : ""
    } $props.${getStateValuePropName(state)})`;
  } else if (!state.tplNode && state.param.defaultExpr) {
    initFunc = `({$props, $state, $queries, $q, $ctx}) => (${getRawCode(
      state.param.defaultExpr,
      exprCtx,
    )})`;
  } else if (state.tplNode) {
    const tpl = state.tplNode;
    const exprs: [string, VariantCombo][] = [];
    for (const vs of getOrderedExplicitVSettings(ctx, tpl)) {
      if (isTplComponent(tpl)) {
        const arg = vs.args.find(
          (vsArg) => vsArg.param === state.implicitState?.param,
        );
        if (arg) {
          exprs.push([getRawCode(arg.expr, exprCtx), vs.variants]);
        }
      } else if (isTplTag(tpl)) {
        const namedState = ensureKnownNamedState(state);
        const varName = toVarName(namedState.name);
        if (varName in vs.attrs) {
          exprs.push([getRawCode(vs.attrs[varName], exprCtx), vs.variants]);
        }
      }
    }
    const baseVariant = ensureBaseVariant(ctx.component);
    if (
      state.implicitState &&
      isWritableState(state.implicitState) &&
      !exprs.some(([_expr, variantCombo]) =>
        arrayEq(variantCombo, [baseVariant]),
      )
    ) {
      const initExpr = getVirtualWritableStateInitialValue(state);
      if (initExpr) {
        exprs.unshift([getRawCode(initExpr, exprCtx), [baseVariant]]);
      }
    }
    if (
      isTplCodeComponent(tpl) &&
      state.implicitState &&
      isReadonlyState(state.implicitState) &&
      state.implicitState?.param.defaultExpr
    ) {
      // initializing readonly state from code commponents
      // writable states are initialized with the value prop
      exprs.unshift([
        getRawCode(state.implicitState.param.defaultExpr, exprCtx),
        [baseVariant],
      ]);
    }
    initFunc = `({$props, $state, $queries, $q${
      !isForRegisterInitFunc ? ", $ctx" : ""
    }}) => (${
      joinVariantVals(exprs, ctx.variantComboChecker, "undefined").value
    })`;
  }
  if (!initFunc || (isWritableState(state) && !shouldTransformWritableStates)) {
    return undefined;
  } else if (isWritableState(state)) {
    return `$props["${makePlasmicIsPreviewRootComponent()}"] ? ${initFunc} : undefined`;
  } else {
    return initFunc;
  }
}

export function serializeStateSpecs(
  component: Component,
  ctx: SerializerBaseContext,
  opts?: {
    /**
     * Set when serializing state specs for the non-RSC render path, where specs live
     * inside the component render function. When unset the following are omitted, they are
     * unused be the server query runtime:
     *  - `onMutate: generateOnMutateForSpec(...)`
     *  - `shouldTransformWritableStates` `$props[...]` transform, which needs $props in scope.
     */
    forLegacyQueries?: boolean;
  },
) {
  // Only the legacy render path can emit the `$props[...]` transform.
  // The query tree is a module-scoped, so it can't reference `$props`.
  const shouldTransformWritableStates =
    !!opts?.forLegacyQueries && !!ctx.exportOpts.shouldTransformWritableStates;

  const serializeState = (state: State) => {
    const initFunc = serializeInitFunc(
      state,
      ctx,
      undefined,
      shouldTransformWritableStates,
    );

    let valueProp = ``;
    if (!shouldTransformWritableStates && isWritableState(state)) {
      valueProp = `valueProp: "${getStateValuePropName(state)}",`;
    } else if (shouldTransformWritableStates && isWritableState(state)) {
      valueProp = `...(!$props["${makePlasmicIsPreviewRootComponent()}"]
        ? { valueProp: "${getStateValuePropName(state)}" }
        : { }
      ),`;
    }

    const { nodeNamer } = ctx;
    const codeComponentHelperName =
      state.tplNode &&
      isTplComponent(state.tplNode) &&
      isCodeComponentWithHelpers(state.tplNode.component)
        ? getImportedCodeComponentHelperName(
            ctx.aliases,
            state.tplNode.component,
          )
        : "undefined";

    return `{
      path: "${getStateVarName(state)}",
      type: ${
        !shouldTransformWritableStates || !isWritableState(state)
          ? `"${state.accessType}"`
          : `$props["${makePlasmicIsPreviewRootComponent()}"] ? "private" : "writable"`
      },
      variableType: "${state.variableType}",
      ${initFunc ? `initFunc: ${initFunc},` : ""}
      ${valueProp}
      ${
        state.onChangeParam.exportType !== ParamExportType.ToolsOnly
          ? `onChangeProp: "${getStateOnChangePropName(state)}",`
          : ``
      }
      ${
        state.tplNode &&
        isTplComponent(state.tplNode) &&
        tplHasRef(state.tplNode)
          ? `refName: ${jsLiteral(nodeNamer(state.tplNode))},`
          : ``
      }
      ${
        opts?.forLegacyQueries &&
        state.tplNode &&
        isTplComponent(state.tplNode) &&
        isCodeComponentWithHelpers(state.tplNode.component)
          ? `onMutate: generateOnMutateForSpec("${
              ensureKnownNamedState(state.implicitState).name
            }", ${codeComponentHelperName})`
          : ``
      }
    }`;
  };

  return `[${component.states
    .filter((state) => (!state.tplNode || !ctx.fakeTpls.includes(state.tplNode)) && shouldSerializeState(component, state))
    .map((state) => serializeState(state))
    .join(",")}]`;
}
