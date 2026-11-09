import { useVariableRowInputs, type VariableRowSnapshot } from "@/wab/client/studio-ctx/state-management-inputs";
import { useInspectorStateValue } from "@/wab/client/studio-ctx/inspector-state";
import { useStudioSelection } from "@/wab/client/studio-ctx/selection-state";
import { COMMANDS } from "@/wab/client/commands/command";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import {
  PREVIEW_DISABLED_TOOLTIP_MESSAGE,
  VariableValueEditor,
} from "@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingForm";
import { VariableEditingModal } from "@/wab/client/components/sidebar-tabs/StateManagement/VariableEditingModal";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { CONFIGURE_ACTION, DELETE_ACTION } from "@/wab/shared/Labels";
import { assert, ensure, spawn } from "@/wab/shared/common";
import {
  StateVariableType,
} from "@/wab/shared/core/states";
import { Component, State } from "@/wab/shared/model/classes";
import { Menu } from "antd";
import React from "react";

function buildVariableMenu({
  showVariableConfigModal,
  showValueModal,
  hasTempValue,
  handleTempValueReset,
  canDelete,
  onRemove,
}: {
  showVariableConfigModal: (e?: MouseEvent) => void;
  showValueModal: (e?: MouseEvent) => void;
  hasTempValue: boolean;
  handleTempValueReset: () => void;
  canDelete: boolean;
  onRemove?: { (e?: MouseEvent): void | undefined };
}) {
  const builder = new MenuBuilder();

  builder.genSection(undefined, (push) => {
    push(
      <Menu.Item key="edit-state" onClick={() => showVariableConfigModal()}>
        {<UiLabel text={CONFIGURE_ACTION} />}
      </Menu.Item>,
    );
    push(
      <Menu.Item key="change-value" onClick={() => showValueModal()}>
        <UiText message={"Change preview value"} />
      </Menu.Item>,
    );
    push(
      <Menu.Item
        key="reset-value"
        disabled={!hasTempValue}
        onClick={handleTempValueReset}
      >
        <UiText message={"Reset preview value"} />
      </Menu.Item>,
    );
  });

  builder.genSection(undefined, (push) => {
    if (canDelete) {
      push(
        <Menu.Item key="remove-state" onClick={() => onRemove?.()}>
          {<UiLabel text={DELETE_ACTION} />}
        </Menu.Item>,
      );
    }
  });

  return builder.build({
    menuName: "state-menu",
  });
}

export function useVariableRow({
  sc: studioCtx,
  component,
  viewCtx,
  state,
}: {
  sc: StudioCtx;
  component: Component;
  state: State;
  viewCtx: ViewCtx;
}): {
  menu: React.JSX.Element;
  modals: React.JSX.Element;
  inputs: VariableRowSnapshot;
  props: {
    hasTempValue?: boolean;
    showValueConfigModal: () => void;
    showVariableConfigModal: () => void;
    onRemove?: () => void;
    name: string;
    value: any;
    isExternal: boolean;
    variableType: StateVariableType;
    menuButton: { menu: React.JSX.Element };
  };
} {
  useStudioSelection(studioCtx, (selection) => selection.view);
  const vc = ensure(
    viewCtx || studioCtx.focusedViewCtx(),
    "Must have a focusedViewCtx",
  );

  const [valueModalVisible, setValueModalVisible] =
    React.useState<boolean>(false);
  const [settingsModalVisible, setSettingsModalVisible] =
    React.useState<boolean>(false);

  const inputs = useVariableRowInputs(vc, component, state);
  const { value, hasTempValue } = useInspectorStateValue(vc, state);

  assert(!inputs.invalidRoot, "slots or tpl groups can't be root of a component");
  const onRemove = inputs.implicit
    ? undefined
    : (e?: MouseEvent) => {
        e?.stopPropagation();
        spawn(
          COMMANDS.component.removeStateVariable.execute(
            studioCtx,
            {},
            {
              state,
              component,
            },
          ),
        );
      };

  const showVariableConfigModal = (e?: MouseEvent) => {
    e?.stopPropagation();
    setSettingsModalVisible(true);
  };

  const showValueModal = (e?: MouseEvent) => {
    e?.stopPropagation();
    setValueModalVisible(true);
  };

  const handleTempValueReset = () => {
    spawn(
      COMMANDS.component.resetStateValue.execute(
        studioCtx,
        {},
        {
          state,
          viewCtx: vc,
          component: vc.component,
        },
      ),
    );
  };

  const menu = buildVariableMenu({
    showVariableConfigModal,
    showValueModal,
    hasTempValue,
    handleTempValueReset,
    canDelete: inputs.canDelete,
    onRemove,
  });

  const modals = (
    <>
      <SidebarModal
        show={valueModalVisible}
        onClose={() => setValueModalVisible(false)}
        title={
          <UiText
            message={'Edit "{part1}" values'}
            values={{ part1: inputs.parameterName }}
          />
        }
      >
        <div style={{ padding: "20px 20px 20px 15px" }}>
          <VariableValueEditor
            state={state}
            component={component}
            studioCtx={studioCtx}
            viewCtx={vc}
            disableInitialValue={inputs.implicit}
            initialValueAbout={
              inputs.implicitAccessType
                ? PREVIEW_DISABLED_TOOLTIP_MESSAGE[
                    inputs.implicitAccessType
                  ]
                : undefined
            }
          />
        </div>
      </SidebarModal>
      <VariableEditingModal
        studioCtx={studioCtx}
        viewCtx={vc}
        state={state}
        show={settingsModalVisible}
        onClose={() => setSettingsModalVisible(false)}
        component={component}
      />
    </>
  );

  return {
    menu,
    modals,
    inputs,
    props: {
      hasTempValue: hasTempValue,
      onRemove,
      showValueConfigModal: showValueModal,
      showVariableConfigModal,
      name: inputs.name,
      value: value,
      isExternal: inputs.isExternal,
      variableType: inputs.variableType,
      menuButton: { menu },
    },
  };
}
