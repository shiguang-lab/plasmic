import { useImplicitVariablesInputs, useVariableRowInputs } from "@/wab/client/studio-ctx/state-management-inputs";
import { useInspectorComponentEvalContext } from "@/wab/client/studio-ctx/inspector-state";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useStyleCells } from "@/wab/client/studio-ctx/style-inputs-react";
import { isCodeComponent } from "@/wab/shared/core/components";
import { useStore } from "zustand";
import { createStore } from "zustand/vanilla";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { PlumyIcon } from "@/wab/client/components/plume/plume-markers";
import { getContextDependentValuesForImplicitState } from "@/wab/client/components/sidebar-tabs/DataBinding/DataPickerUtil";
import ImplicitVariableRow from "@/wab/client/components/sidebar-tabs/StateManagement/ImplicitVariableRow";
import { createNodeIcon } from "@/wab/client/components/sidebar-tabs/tpl-tree";
import { EditableLabel } from "@/wab/client/components/widgets/EditableLabel";
import { UiText } from "@/wab/client/i18n/UiText";
import {
  DefaultImplicitVariablesSectionProps,
  PlasmicImplicitVariablesSection,
} from "@/wab/client/plasmic/plasmic_kit_state_management/PlasmicImplicitVariablesSection";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { assert, ensure, spawn } from "@/wab/shared/common";
import { isTplTagOrComponent } from "@/wab/shared/core/tpls";
import {
  Component,
  TplComponent,
  TplTag,
  isKnownTplNode,
  isKnownTplComponent,
  State,
} from "@/wab/shared/model/classes";
import { getPlumeElementDef } from "@/wab/shared/plume/plume-registry";
import { purpleDark8 } from "@/wab/styles/_tokens";
import { HTMLElementRefOf } from "@plasmicapp/react-web";
import { Menu } from "antd";
import { ok } from "neverthrow";
import * as React from "react";

export interface ImplicitVariablesSectionProps extends DefaultImplicitVariablesSectionProps {
  sc: StudioCtx;
  viewCtx: ViewCtx;
  component: Component;
  tpl: TplComponent | TplTag;
}

const ImplicitVariablesSection = React.memo(React.forwardRef(function ImplicitVariablesSection(
    props: ImplicitVariablesSectionProps,
    ref: HTMLElementRefOf<"div">,
  ) {
    const { sc, component, tpl, viewCtx, ...rest } = props;
    const variants = useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
    const context = useViewSelection(viewCtx, (state) => state.context);
    const {snapshot, source} = useImplicitVariablesInputs(viewCtx, component, tpl);
    const provider = React.useMemo(() => new TplExpsProvider(viewCtx, tpl), [viewCtx, tpl, variants, context]);
    useStyleCells(provider, isKnownTplComponent(tpl) ? [] : ["display", "flex-direction"]);

    assert(viewCtx, "component should have a focused or first view ctx");

    const [defaultEditing, setDefaultEditing] = React.useState(false);

    const headerMenu = React.useMemo(() => {
      const builder = new MenuBuilder();
      builder.genSection(undefined, (push) => {
        push(
          <Menu.Item key="renmame-tpl" onClick={() => setDefaultEditing(true)}>
            <UiText message={"Rename"} />
          </Menu.Item>,
        );
      });
      return builder.build({
        menuName: "implicit-variable-menu",
      });
    }, [tpl]);

    const effectiveVs = isTplTagOrComponent(tpl)
      ? viewCtx.variantTplMgr().effectiveVariantSetting(tpl) : undefined;
    const plumeDef = isKnownTplNode(tpl) ? getPlumeElementDef(component, tpl) : undefined;
    const nodeIcon = createNodeIcon(tpl, effectiveVs);
    const icon = plumeDef ? <PlumyIcon def={plumeDef}>{nodeIcon}</PlumyIcon> : nodeIcon;

    return (
      <PlasmicImplicitVariablesSection
        root={{ ref }}
        {...rest}
        icon={<span style={{ color: purpleDark8 }}>{icon}</span>}
        title={
          <EditableLabel
            value={ensure(snapshot.name, "stateful nodes should have a name")}
            key={`${defaultEditing}`}
            defaultEditing={defaultEditing}
            doubleClickToEdit
            onEdit={(val) => {
              spawn(
                sc.change(() => {
                  if (val !== "") {
                    sc.tplMgr().renameTpl(component, tpl, val);
                  }
                  return ok();
                }),
              );
              setDefaultEditing(false);
            }}
            onAbort={() => setDefaultEditing(false)}
          />
        }
        tplRow={{
          menu: headerMenu,
          children: null,
          onClick: () => {
            viewCtx.change(() => {
              viewCtx.setStudioFocusByTpl(tpl, undefined);
            });
          },
        }}
        // isSelected={viewCtx.focusedTpls().includes(tpl)}
        // color={viewCtx.isEditingNonBaseVariant ? "variant" : undefined}
      >
        {snapshot.states.map((stateRef) => (
          <VisibleImplicitVariableRow
            viewCtx={viewCtx}
            state={source.resolve(stateRef)}
            sc={sc}
            component={component}
            tpl={tpl}
            key={stateRef.uid}
          />
        ))}
      </PlasmicImplicitVariablesSection>
    );
  }));
export default ImplicitVariablesSection;


const noRegistration = createStore(() => undefined);
function VisibleImplicitVariableRow({viewCtx, state, sc, component, tpl}: {
  viewCtx: ViewCtx; state: State; sc: StudioCtx; component: Component; tpl: TplTag | TplComponent;
}) {
  useVariableRowInputs(viewCtx, component, state);
  useInspectorComponentEvalContext(viewCtx, isKnownTplComponent(tpl) ? tpl : undefined);
  useStore(isKnownTplComponent(tpl) && isCodeComponent(tpl.component)
    ? viewCtx.canvasCtx.registrations.component(tpl.component.name) : noRegistration);
  if (getContextDependentValuesForImplicitState(viewCtx, state).hidden) {return null;}
  return <ImplicitVariableRow viewCtx={viewCtx} state={state} sc={sc} component={component} />;
}
