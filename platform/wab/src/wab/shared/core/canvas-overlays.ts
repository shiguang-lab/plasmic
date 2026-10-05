import type { DeepReadonly } from "@/wab/commons/types";
import { toVarName } from "@/wab/shared/codegen/util";
import { actionOpensOverlay } from "@/wab/shared/core/canvas-overlay-actions";
import { isCodeComponentTpl } from "@/wab/shared/core/components";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import { flattenTpls } from "@/wab/shared/core/tpls";
import {
  Component,
  Expr,
  TplComponent,
  TplNode,
  VariantSetting,
  isKnownRenderExpr,
} from "@/wab/shared/model/classes";
import type { CodeComponentMeta } from "@plasmicapp/host/registerComponent";

/** Components with the editing-only overlay override contract. */
export function supportsCanvasOverlay(tpl: TplNode): tpl is TplComponent {
  return (
    isCodeComponentTpl(tpl) &&
    tpl.component.params.some((param) => param.variable.name === "previewOpen")
  );
}

function eventHandlers(
  setting: DeepReadonly<Pick<VariantSetting, "args" | "attrs">>,
  event?: string,
): DeepReadonly<Expr>[] {
  const matches = (name: string) =>
    event ? name === event : /^on[A-Z]/.test(name);
  return [
    ...setting.args
      .filter((arg) => matches(toVarName(arg.param.variable.name)))
      .map((arg) => arg.expr),
    ...Object.entries(setting.attrs)
      .filter(([name]) => matches(name))
      .map(([, expr]) => expr),
  ];
}

/** Ancestors are ordered from the selected child towards the component root. */
export function getCanvasOverlayTargets(
  component: Component,
  ancestors: TplNode[],
  context?: {
    selectedSlot?: string;
    getMeta: (
      tpl: TplComponent,
    ) =>
      | Pick<
          CodeComponentMeta<unknown>,
          "canvasEventBindings" | "canvasOverlay"
        >
      | undefined;
    getSetting?: (
      tpl: TplNode,
    ) => DeepReadonly<Pick<VariantSetting, "args" | "attrs">>;
    getProp: (tpl: TplComponent, prop: string) => unknown;
  },
): TplComponent[] {
  const selected = ancestors[0];
  // Selecting the overlay itself must never expose its content's actions.
  if (selected && supportsCanvasOverlay(selected)) {
    const slot = context?.selectedSlot;
    return !slot ||
      slot === context?.getMeta(selected)?.canvasOverlay?.triggerSlot
      ? [selected]
      : [];
  }
  const overlayIndex = ancestors.findIndex(supportsCanvasOverlay);
  const descendants =
    overlayIndex < 0 ? ancestors : ancestors.slice(0, overlayIndex);
  const setting = (tpl: TplNode) =>
    context?.getSetting?.(tpl) ?? tpl.vsettings[0] ?? { args: [], attrs: {} };
  const handlersFor = (tpl: TplNode, event?: string) =>
    eventHandlers(setting(tpl), event);
  const overlays = flattenTpls(component.tplTree).filter(supportsCanvasOverlay);
  const targetsFor = (
    handlers: DeepReadonly<Expr>[],
    args: Record<string, unknown> = {},
  ) =>
    overlays.filter((tpl) =>
      setting(tpl).args.some(
        (arg) =>
          arg.param.variable.name === "open" &&
          actionOpensOverlay(handlers, args, arg.expr),
      ),
    );

  // Direct action bindings take priority over the surrounding wrapper.
  const handlerOwner = descendants.find((tpl) => handlersFor(tpl).length > 0);
  if (handlerOwner) {
    const targets = targetsFor(handlersFor(handlerOwner));
    if (targets.length) return targets;
  }

  // Delegate only through the component's explicit event-routing contract.
  // Slot membership and argument values are required; names and shared state
  // alone never establish an association.
  for (const [index, owner] of ancestors.entries()) {
    if (!isCodeComponentTpl(owner)) continue;
    for (const binding of context?.getMeta(owner)?.canvasEventBindings ?? []) {
      const slot = setting(owner).args.find(
        (arg) => arg.param.variable.name === binding.slot,
      );
      if (!slot || !isKnownRenderExpr(slot.expr)) continue;
      const slotNodes = new Set(slot.expr.tpl.flatMap(flattenTpls));
      const sources = ancestors
        .slice(0, index)
        .filter((node) => slotNodes.has(node));
      if (!sources.length) continue;
      const args: Record<string, unknown> = {};
      let bound = true;
      for (const [name, { prop }] of Object.entries(binding.args)) {
        const source = sources
          .filter(isCodeComponentTpl)
          .map((tpl) => ({
            tpl,
            arg: setting(tpl).args.find(
              (arg) => arg.param.variable.name === prop,
            ),
          }))
          .find(({ arg }) => !!arg);
        if (!source?.arg) {
          bound = false;
          break;
        }
        args[name] =
          context?.getProp(source.tpl, prop) ?? tryExtractJson(source.arg.expr);
      }
      if (bound) return targetsFor(handlersFor(owner, binding.event), args);
    }
    if (index === overlayIndex) break;
  }

  // Content is never a trigger. Only the declared trigger slot controls its owner.
  const owner = ancestors.find(supportsCanvasOverlay);
  if (owner) {
    const triggerSlot = context?.getMeta(owner)?.canvasOverlay?.triggerSlot;
    const slot = setting(owner).args.find(
      (arg) => arg.param.variable.name === triggerSlot,
    );
    if (
      slot &&
      isKnownRenderExpr(slot.expr) &&
      slot.expr.tpl.flatMap(flattenTpls).includes(selected)
    ) {
      return [owner];
    }
  }
  return [];
}
