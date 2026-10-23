import { showError } from "@/wab/client/ErrorNotifications";
import VariableEditingForm, {
  StateVariableDraft,
} from "@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingForm";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { getUiLocale } from "@/wab/client/i18n";
import { UiText } from "@/wab/client/i18n/UiText";
import { translate } from "@/wab/client/i18n/locales";
import { createComponentState } from "@/wab/client/operations/create-component-state";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { codeLit } from "@/wab/shared/core/exprs";
import { mkParamsForState } from "@/wab/shared/core/lang";
import {
  DEFAULT_STATE_VARIABLE_NAME,
  genOnChangeParamName,
  mkState,
} from "@/wab/shared/core/states";
import { Component, State } from "@/wab/shared/model/classes";

import React from "react";

export function VariableEditingModal({
  component,
  onClose,
  show,
  viewCtx,
  studioCtx,
  state,
  mode = "edit",
}: {
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
    name: studioCtx
      .tplMgr()
      .getUniqueParamName(component, DEFAULT_STATE_VARIABLE_NAME),
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
    return mkState({
      param: valueParam,
      onChangeParam,
      variableType: draft.variableType,
      accessType: draft.accessType,
    });
  }, [draft]);
  const formState = mode === "new" ? draftState : state;
  const confirming = React.useRef(false);
  const confirm = async () => {
    if (confirming.current) {
      return;
    }
    confirming.current = true;
    try {
      const result = await studioCtx.change(() =>
        createComponentState({
          site: studioCtx.site,
          component,
          tplMgr: studioCtx.tplMgr(),
          ...draft,
        }),
      );
      if (result.isErr()) {
        showError(result.error, { title: translate(getUiLocale(), "Cannot create state variable") });
        return;
      }
      onClose();
    } finally {
      confirming.current = false;
    }
  };
  return (
    <SidebarModal
      title={
        <UiText
          message={
            mode === "new" ? "New state variable" : "Edit state variable"
          }
        />
      }
      show={show}
      onClose={onClose}
      persistOnInteractOutside={mode === "new"}
    >
      {formState && (
        <VariableEditingForm
          state={formState}
          studioCtx={studioCtx}
          viewCtx={viewCtx}
          component={component}
          mode={mode}
          onDraftChange={
            mode === "new"
              ? (changes) => setDraft((value) => ({ ...value, ...changes }))
              : undefined
          }
          onConfirm={mode === "new" ? confirm : onClose}
          onCancel={onClose}
        />
      )}
    </SidebarModal>
  );
}
