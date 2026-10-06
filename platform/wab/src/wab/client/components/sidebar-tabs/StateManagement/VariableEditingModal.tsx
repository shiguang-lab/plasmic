import VariableEditingForm, { StateVariableDraft } from "@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingForm";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { createComponentState } from "@/wab/client/operations/create-component-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParamsForState } from "@/wab/shared/core/lang";
import { DEFAULT_STATE_VARIABLE_NAME, genOnChangeParamName, mkState } from "@/wab/shared/core/states";
import { VARIABLE_CAP } from "@/wab/shared/Labels";
import startCase from "lodash/startCase";
import { Component, State } from "@/wab/shared/model/classes";
import { notification } from "antd";
import React from "react";

export function VariableEditingModal({ component, onClose, show, viewCtx, studioCtx, state, mode = "edit" }: {
  state?: State | null;
  show: boolean;
  onClose: () => any;
  studioCtx: StudioCtx;
  viewCtx: ViewCtx;
  component: Component;
  mode?: "new" | "edit";
}) {
  // The draft stays outside the Site model, autosave and undo history.
  const [draft, setDraft] = React.useState<StateVariableDraft>(() => ({
    name: studioCtx.tplMgr().getUniqueParamName(component, DEFAULT_STATE_VARIABLE_NAME),
    variableType: "text",
    accessType: "private",
    initialValue: codeLit(""),
  }));
  const draftState = React.useMemo(() => {
    const { valueParam, onChangeParam } = mkParamsForState({
      name: draft.name,
      onChangeProp: genOnChangeParamName(draft.name),
      variableType: draft.variableType,
      accessType: draft.accessType,
      defaultExpr: draft.initialValue ?? undefined,
    });
    return mkState({ param: valueParam, onChangeParam, variableType: draft.variableType, accessType: draft.accessType });
  }, [draft]);
  const formState = mode === "new" ? draftState : state;
  const confirming = React.useRef(false);
  const confirm = async () => {
    if (confirming.current) return;
    confirming.current = true;
    try {
    const result = await studioCtx.change(() => createComponentState({
      site: studioCtx.site, component, tplMgr: studioCtx.tplMgr(), ...draft,
    }));
    if (result.isErr()) {
      notification.error({ message: "Cannot create state variable", description: result.error.message });
      return;
    }
    onClose();
    } finally {
      confirming.current = false;
    }
  };
  return <SidebarModal
    title={startCase(`${mode} ${VARIABLE_CAP}`)}
    show={show}
    onClose={onClose}
    persistOnInteractOutside={mode === "new"}
  >
    {formState && <VariableEditingForm
      state={formState} studioCtx={studioCtx} viewCtx={viewCtx} component={component} mode={mode}
      onDraftChange={mode === "new" ? (changes) => setDraft((value) => ({ ...value, ...changes })) : undefined}
      onConfirm={mode === "new" ? confirm : onClose}
      onCancel={onClose}
    />}
  </SidebarModal>;
}
