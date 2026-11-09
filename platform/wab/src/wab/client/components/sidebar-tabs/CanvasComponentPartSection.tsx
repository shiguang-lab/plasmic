import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useInspectorSelection } from "@/wab/client/studio-ctx/inspector-state";
import { PropEditorRowWrapper } from "@/wab/client/components/sidebar-tabs/PropEditorRow";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import Button from "@/wab/client/components/widgets/Button";
import { UiText } from "@/wab/client/i18n/UiText";
import type { CanvasComponentPart } from "@/wab/client/components/canvas/canvas-component-parts";
import type {
  ModelRef,
  ModelSnapshots,
} from "@/wab/client/studio-ctx/model-snapshots";
import type { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { arrayEq } from "@/wab/shared/common";
import {
  isKnownFunctionType,
  type Component,
  type ObjInst,
  type Param,
  type TplComponent,
} from "@/wab/shared/model/classes";
import React from "react";
import { useStore } from "zustand";

export const CanvasComponentPartSection = function CanvasComponentPartSection({
  viewCtx, interactions,
}: { viewCtx: ViewCtx; interactions: boolean }) {
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const selection = useInspectorSelection(viewCtx.studioCtx);
  const part = selection?.viewCtx === viewCtx ? selection.componentPart : undefined;
  if (!part) {
    return null;
  }
  return <CanvasComponentPartBody viewCtx={viewCtx} part={part} interactions={interactions} />;
};

type ParamRefsSnapshot = readonly (ModelRef<Param> | undefined)[];

/**
 * Exact native lookup for the part's prop names. Every parameter's current
 * variable and name fields are demanded, so an unmatched parameter can become
 * a row without a component.params change. The imperative bindings rebind when
 * a parameter's variable identity changes, even when the selected refs do not.
 */
function createComponentPartParamSource(models: ModelSnapshots, component: Component, part: CanvasComponentPart) {
    const propNames = part.props;
    const paramsStore = models.field(component, "params");
    let snapshot: ParamRefsSnapshot = Object.freeze(
      propNames.map(() => undefined),
    );

    const getSnapshot = () => {
      const firstByName = new Map<string, ModelRef<Param>>();
      for (const paramRef of paramsStore.getState()) {
        const param = models.resolve(paramRef);
        const variableRef = models.field(param, "variable").getState();
        const variable = models.resolve(variableRef);
        const name = models.field(variable, "name").getState();
        if (!firstByName.has(name)) {
          firstByName.set(name, paramRef);
        }
      }
      const next = propNames.map((name) => firstByName.get(name));
      if (!arrayEq(snapshot, next)) {
        snapshot = Object.freeze(next);
      }
      return snapshot;
    };

    const subscribe = (listener: () => void) => {
      const bindings = new Map<ObjInst, Map<string, () => void>>();

      const bind = () => {
        const demanded = new Map<ObjInst, Set<string>>();
        const demand = (model: ObjInst, key: string) => {
          let keys = demanded.get(model);
          if (!keys) {
            keys = new Set();
            demanded.set(model, keys);
          }
          keys.add(key);
        };
        demand(component, "params");
        for (const paramRef of paramsStore.getState()) {
          const param = models.resolve(paramRef);
          const variableRef = models.field(param, "variable").getState();
          const variable = models.resolve(variableRef);
          demand(param, "variable");
          demand(variable, "name");
        }
        for (const [model, keys] of bindings) {
          for (const [key, stop] of keys) {
            if (!demanded.get(model)?.has(key)) {
              stop();
              keys.delete(key);
            }
          }
          if (!keys.size) {
            bindings.delete(model);
          }
        }
        for (const [model, keys] of demanded) {
          let bound = bindings.get(model);
          if (!bound) {
            bound = new Map();
            bindings.set(model, bound);
          }
          for (const key of keys) {
            if (!bound.has(key)) {
              const onChange = () => {
                bind();
                listener();
              };
              bound.set(
                key,
                models.declaredField(model, key).subscribe(onChange),
              );
            }
          }
        }
      };
      bind();
      return () => {
        for (const keys of bindings.values()) {
          for (const stop of keys.values()) {
            stop();
          }
        }
        bindings.clear();
      };
    };

    return { getSnapshot, subscribe };

}

function useComponentPartParamRefs(
  models: ModelSnapshots,
  component: Component,
  part: CanvasComponentPart,
): ParamRefsSnapshot {
  const source = React.useMemo(() => createComponentPartParamSource(models, component, part), [models, component, part]);

  return React.useSyncExternalStore(
    source.subscribe,
    source.getSnapshot,
    source.getSnapshot,
  );
}

function CanvasComponentPartBody({
  viewCtx, part, interactions,
}: { viewCtx: ViewCtx; part: CanvasComponentPart; interactions: boolean }) {
  const models = viewCtx.studioCtx.modelSnapshots;
  const componentRef = useStore(models.field(part.tpl, "component"));
  const component = models.resolve(componentRef);
  const paramRefs = useComponentPartParamRefs(models, component, part);
  const expsProvider = new TplExpsProvider(viewCtx, part.tpl);
  return (
    <SidebarSection title={part.displayName}>
      <div className="panel-row">
        <Button onClick={() => viewCtx.setFocusedComponentPart(undefined)}>
          <UiText message="Select component" />
        </Button>
      </div>
      {paramRefs.map((paramRef) => {
        if (!paramRef) {
          return null;
        }
        const param = models.resolve(paramRef);
        return (
          <CanvasComponentPartPropRow
            key={param.uuid}
            viewCtx={viewCtx}
            tpl={part.tpl}
            part={part}
            param={param}
            interactions={interactions}
            expsProvider={expsProvider}
          />
        );
      })}
    </SidebarSection>
  );
}

function CanvasComponentPartPropRow({
  viewCtx, tpl, part, param, interactions, expsProvider,
}: {
  viewCtx: ViewCtx;
  tpl: TplComponent;
  part: CanvasComponentPart;
  param: Param;
  interactions: boolean;
  expsProvider: TplExpsProvider;
}) {
  const models = viewCtx.studioCtx.modelSnapshots;
  const variableRef = useStore(models.field(param, "variable"));
  const variable = models.resolve(variableRef);
  const name = useStore(models.field(variable, "name"));
  useStore(models.field(param, "type"));
  if (!part.props.includes(name) || isKnownFunctionType(param.type) !== interactions) {
    return null;
  }
  return <PropEditorRowWrapper viewCtx={viewCtx} tpl={tpl} param={param} expsProvider={expsProvider} />;
}
