import { getControlModePropType } from "@/wab/client/code-components/code-components";
import { updateComponentMode } from "@/wab/client/code-components/simplified-mode";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import StyleSwitch from "@/wab/client/components/style-controls/StyleSwitch";
import { useI18n } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { getTplComponentArg } from "@/wab/shared/TplMgr";
import { tryGetBaseVariantSetting } from "@/wab/shared/Variants";
import { ensure, spawn } from "@/wab/shared/common";
import { tryExtractJson } from "@/wab/shared/core/exprs";
import {
  isKnownCustomCode,
  isKnownTemplatedString,
  TplComponent,
} from "@/wab/shared/model/classes";
import type { CodeComponentMode } from "@plasmicapp/host";
import React from "react";

interface ModeInput {
  subscribe(listener: () => void): () => void;
}

interface ModeSnapshot {
  readonly checked: boolean;
  readonly error: string | undefined;
}

/** This one control's finite model/registration inputs, never a recursive Expr
 * subscription. Only literal strings can equal the simplified mode value. */
function readModeInputs(tpl: TplComponent, viewCtx: ViewCtx) {
  const models = viewCtx.studioCtx.modelSnapshots;
  const component = tpl.component;
  const inputs = new Set<ModeInput>([
    models.field(tpl, "component"),
    models.field(tpl, "vsettings"),
    models.field(component, "name"),
    models.field(component, "type"),
    models.field(component, "plumeInfo"),
    models.field(component, "params"),
    viewCtx.canvasCtx.registrations.component(component.name),
  ]);
  if (component.plumeInfo) {
    inputs.add(models.field(component.plumeInfo, "type"));
  }
  for (const param of component.params) {
    inputs.add(models.field(param, "variable"));
    inputs.add(models.field(param.variable, "name"));
  }
  for (const vs of tpl.vsettings) {
    inputs.add(models.field(vs, "variants"));
    for (const variant of vs.variants) {
      inputs.add(models.field(variant, "name"));
    }
  }

  const invalid = (error: string) => ({
    inputs,
    snapshot: Object.freeze({ checked: false, error }),
  });
  const baseVs = tryGetBaseVariantSetting(tpl);
  if (!baseVs) {
    return invalid("Tpl should have base variant");
  }
  const modeProp = getControlModePropType(viewCtx, component);
  if (!modeProp) {
    return invalid(`missing the control mode prop type for the component ${component.name}`);
  }
  const param = component.params.find((p) => p.variable.name === modeProp.propName);
  if (!param) {
    return invalid("component should have a mode param");
  }
  inputs.add(models.field(baseVs, "args"));
  for (const arg of baseVs.args) {
    inputs.add(models.field(arg, "param"));
    inputs.add(models.field(arg.param, "variable"));
  }
  const modeArg = getTplComponentArg(tpl, baseVs, param.variable);
  if (modeArg) {
    inputs.add(models.field(modeArg, "expr"));
  } else {
    inputs.add(models.field(param, "defaultExpr"));
  }
  const expr = modeArg?.expr ?? param.defaultExpr;
  if (isKnownCustomCode(expr)) {
    inputs.add(models.field(expr, "code"));
  } else if (isKnownTemplatedString(expr)) {
    inputs.add(models.field(expr, "text"));
  }
  return {
    inputs,
    snapshot: Object.freeze({
      checked: !!expr && tryExtractJson(expr) === "simplified",
      error: undefined,
    }),
  };
}

function modeResource(tpl: TplComponent, viewCtx: ViewCtx) {
  let current: ModeSnapshot = readModeInputs(tpl, viewCtx).snapshot;
  const lifetime = viewCtx.disposeSignal;
  let sealed = false;
  const listeners = new Set<() => void>();
  const subscriptions = new Map<ModeInput, () => void>();
  const disconnect = () => {
    subscriptions.forEach((stop) => stop());
    subscriptions.clear();
    lifetime.removeEventListener("abort", seal);
  };
  const seal = () => {
    sealed = true;
    disconnect();
    listeners.clear();
  };
  const refresh = () => {
    if (sealed || !listeners.size) { return; }
    if (lifetime.aborted) { seal(); return; }
    const next = readModeInputs(tpl, viewCtx);
    for (const input of next.inputs) {
      if (!subscriptions.has(input)) {
        subscriptions.set(input, input.subscribe(refresh));
      }
    }
    for (const [input, stop] of subscriptions) {
      if (!next.inputs.has(input)) {
        stop();
        subscriptions.delete(input);
      }
    }
    if (current.checked !== next.snapshot.checked || current.error !== next.snapshot.error) {
      current = next.snapshot;
      listeners.forEach((notify) => notify());
    }
  };
  return {
    getSnapshot: () => current,
    subscribe: (notify: () => void) => {
      if (sealed || lifetime.aborted) { seal(); return () => undefined; }
      listeners.add(notify);
      lifetime.addEventListener("abort", seal, { once: true });
      // Connect only after commit, then re-read any change since render.
      refresh();
      return () => {
        listeners.delete(notify);
        if (!listeners.size) {
          disconnect();
        }
      };
    },
  };
}

export function SimplifiedCodeComponentModeSection(props: {
  tpl: TplComponent;
  viewCtx: ViewCtx;
}) {
  const { t: uiT } = useI18n();
  const { tpl, viewCtx } = props;

  const models = viewCtx.studioCtx.modelSnapshots;
  const resource = React.useMemo(() => modeResource(tpl, viewCtx), [tpl, viewCtx, models]);
  const mode = React.useSyncExternalStore(resource.subscribe, resource.getSnapshot, resource.getSnapshot);
  if (mode.error) {
    ensure(undefined, mode.error);
  }

  const onChange = async (newMode: CodeComponentMode) => {
    const { propName } = ensure(
      getControlModePropType(viewCtx, tpl.component),
      `missing the control mode prop type for the component ${tpl.component.name}`,
    );
    const param = ensure(
      tpl.component.params.find((p) => p.variable.name === propName),
      "component should have a mode param",
    );
    await updateComponentMode(tpl, viewCtx, param, newMode);
  };
  return (
    <SidebarSection title={uiT("Component mode")} id="component-mode-section">
      <StyleSwitch
        isChecked={mode.checked}
        onChange={(value) => spawn(onChange(value ? "simplified" : "advanced"))}
        data-plasmic-prop="simplified-mode-toggle"
      >
        <UiText message={"Simplified"} />
      </StyleSwitch>
    </SidebarSection>
  );
}
