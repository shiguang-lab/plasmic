import { useCustomFunctionsSchema } from "@/wab/client/studio-ctx/custom-functions-schema-react";
import { useTargetedStylePanelValue } from "@/wab/client/studio-ctx/targeted-style-panel-inputs";
import { useStyleCells, useStyleIndicator } from "@/wab/client/studio-ctx/style-inputs-react";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { useInspectorCanvasEnv } from "@/wab/client/studio-ctx/inspector-state";
import { isTplCodeComponentStyleable } from "@/wab/client/code-components/code-components";
import ContextMenuIndicator from "@/wab/client/components/ContextMenuIndicator/ContextMenuIndicator";
import { useAppRoles } from "@/wab/client/components/app-auth/app-auth-contexts";
import { MenuBuilder } from "@/wab/client/components/menu-builder";
import { BoolPropEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/BoolPropEditor";
import { DataPickerEditor } from "@/wab/client/components/sidebar-tabs/ComponentProps/DataPickerEditor";
import { FallbackEditor } from "@/wab/client/components/sidebar-tabs/ComponentPropsSection";
import S from "@/wab/client/components/sidebar-tabs/VisibilitySection.module.scss";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import {
  LabeledItem,
  LabeledItemRow,
  LabeledStyleDimItem,
  shouldBeDisabled,
} from "@/wab/client/components/sidebar/sidebar-helpers";
import {
  TplExpsProvider,
  useStyleTarget,
} from "@/wab/client/components/style-controls/StyleComponent";
import StyleToggleButton from "@/wab/client/components/style-controls/StyleToggleButton";
import StyleToggleButtonGroup from "@/wab/client/components/style-controls/StyleToggleButtonGroup";
import { useI18n } from "@/wab/client/i18n";
import { UiLabel, UiText } from "@/wab/client/i18n/UiText";
import { getVisibilityIcon } from "@/wab/client/icons";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import {
  makeVariantedStylesHelperFromCurrentCtx,
} from "@/wab/client/utils/style-utils";
import { getVisibilityChoicesForTpl } from "@/wab/client/utils/tpl-client-utils";
import { isTokenRef } from "@/wab/commons/StyleToken";
import { RESET_CAP } from "@/wab/shared/Labels";
import {
  isPrivateStyleVariant,
  tryGetVariantSetting,
} from "@/wab/shared/Variants";
import { ensureInstance } from "@/wab/shared/common";
import {
  clone,
  codeLit,
  createExprForDataPickerValue,
  extractValueSavedFromDataPicker,
  isFallbackSet,
  tryExtractBoolean,
  tryExtractJson,
} from "@/wab/shared/core/exprs";
import { isTplCodeComponent } from "@/wab/shared/core/tpls";
import { PERCENTAGE_UNITS } from "@/wab/shared/css/types";
import { computeDefinedIndicator } from "@/wab/shared/defined-indicator";
import {
  CustomCode,
  ObjectPath,
  TplNode,
  ensureKnownCustomCode,
  isKnownCustomCode,
  isKnownObjectPath,
} from "@/wab/shared/model/classes";
import {
  TplVisibility,
  clearTplVisibility,
  getVisibilityDataProp,
  getVisibilityLabel,
  hasVisibilitySetting,
} from "@/wab/shared/visibility-utils";
import { Menu } from "antd";
import cn from "classnames";
import React from "react";

function readVisibility(view: ViewCtx, tpl: TplNode, expsProvider: TplExpsProvider) {
  const vtm = view.variantTplMgr();
  const targetCombo = vtm.getTargetVariantComboForNode(tpl, { forVisibility: true });
  const target = tryGetVariantSetting(tpl, targetCombo);
  const effective = expsProvider.effectiveVs();
  const visibility = effective.getVisibility();
  const condition = visibility === TplVisibility.CustomExpr ? effective.dataCond : undefined;
  return Object.freeze({
    noStyles: isTplCodeComponent(tpl) && !isTplCodeComponentStyleable(view.studioCtx.codeComponentsRegistry, tpl),
    targetCombo: Object.freeze([...targetCombo]),
    targetHasVisibility: !!target && hasVisibilitySetting(target),
    privateVariant: targetCombo.some(isPrivateStyleVariant),
    indicator: computeDefinedIndicator(view.site, view.currentComponent(), effective.getVisibilitySource(), vtm.getTargetIndicatorComboForNode(tpl, { forVisibility: true })),
    choices: Object.freeze(getVisibilityChoicesForTpl(view, tpl)), visibility,
    condition: condition && (isKnownCustomCode(condition) || isKnownObjectPath(condition)) ? clone(condition) : undefined,
  });
}

export const VisibilitySection = React.memo(function VisibilitySection(props: {
  tpl: TplNode; viewCtx: ViewCtx; expsProvider: TplExpsProvider;
}) {
  const select = React.useCallback(() => readVisibility(props.viewCtx, props.tpl, props.expsProvider), [props.viewCtx, props.tpl, props.expsProvider]);
  const source = useTargetedStylePanelValue(props.viewCtx.studioCtx, { kind: "visibility", view: props.viewCtx, tpl: props.tpl }, select);
  return source.active && source.value ? <VisibilitySection_ {...props} visibilityInput={source.value} /> : null;
});

function VisibilitySection_(props: {
  tpl: TplNode;
  viewCtx: ViewCtx;
  expsProvider: TplExpsProvider;
  visibilityInput: ReturnType<typeof readVisibility>;
}) {
  const { t: uiT } = useI18n();
  const { viewCtx, tpl, expsProvider } = props;
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  useViewSelection(viewCtx, (state) => state.context);
  const canvasEnv = useInspectorCanvasEnv(viewCtx, tpl, { forDataRepCollection: true });
  const functionsSchema = useCustomFunctionsSchema(viewCtx.studioCtx);

  const { noStyles, targetCombo: targetVisibilityCombo,
    targetHasVisibility, privateVariant: hasPrivateStyleVariant, indicator: visibilityDefinedIndicator,
    choices: visibilityChoices, visibility: currentVisibility, condition: customCode } = props.visibilityInput;
  const [isDataPickerVisible, setIsDataPickerVisible] =
    React.useState<boolean>(false);

  const styling = useStyleTarget();

  const { roles } = useAppRoles(
    viewCtx.studioCtx.appCtx,
    viewCtx.studioCtx.siteInfo.id,
    true,
  );

  const vsh = makeVariantedStylesHelperFromCurrentCtx(viewCtx.studioCtx);

  const { isDisabled, disabledTooltip } = shouldBeDisabled({
    props: {},
    label: "visibility",
    indicators: [visibilityDefinedIndicator],
  });

  const [opacityCell] = useStyleCells(expsProvider, ["opacity"]);
  const opacity = opacityCell?.value ?? "1";
  const formattedOpacity = isTokenRef(opacity)
    ? opacity
    : `${Math.round(parseFloat(opacity) * 100)}%`;

  const opacityDefinedIndicator = useStyleIndicator(expsProvider, "opacity");

  const handleUnsetVisibility = () =>
    viewCtx.change(() => clearTplVisibility(tpl, [...targetVisibilityCombo]));

  const handleOpacityChange = (val?: string) => {
    const newVal = val?.includes("%")
      ? parseInt(val) / 100
      : parseFloat(val || "0");

    styling.change(() => {
      if (val === undefined || (isNaN(newVal) && !isTokenRef(val))) {
        styling.exp().clear("opacity");
      } else {
        styling
          .exp()
          .set("opacity", val && isTokenRef(val) ? val : String(newVal));
      }
    });
  };

  const switchToDynamicValue = () => {
    _setTplVisibility(TplVisibility.CustomExpr);
    setIsDataPickerVisible(true);
  };

  const visibilityMenu = () => {
    const builder = new MenuBuilder();
    builder.genSection(undefined, (push) => {
      if (targetHasVisibility) {
        push(
          <Menu.Item
            hidden={
              !targetHasVisibility
            }
            onClick={handleUnsetVisibility}
          >
            <UiText
              message={"{part1} {part2} style"}
              values={{
                part1: <UiLabel text={RESET_CAP} />,
                part2: (
                  <strong>
                    <UiText message={"Visibility"} />
                  </strong>
                ),
              }}
            />
          </Menu.Item>,
        );
      }
      push(
        <Menu.Item
          key={"not-rendered"}
          data-plasmic-prop={getVisibilityDataProp(TplVisibility.NotRendered)}
          onClick={() => _setTplVisibility(TplVisibility.NotRendered)}
        >
          {getVisibilityLabel(TplVisibility.NotRendered)}
        </Menu.Item>,
      );
    });
    builder.genSection(undefined, (push) => {
      push(
        <Menu.Item
          key={"custom-code"}
          onClick={() => {
            switchToDynamicValue();
          }}
        >
          <UiText message={"Use dynamic value"} />
        </Menu.Item>,
      );
    });

    if (roles.length > 0) {
      builder.genSub(<UiText message={"Show based on user role"} />, (push) => {
        for (const role of roles) {
          push(
            <Menu.Item
              key={role.id}
              onClick={() => {
                _setCustomCond(
                  new CustomCode({
                    code: `((currentUser?.roleIds ?? []).includes('${role.id}'))`,
                    fallback: new CustomCode({
                      code: "false",
                      fallback: null,
                    }),
                  }),
                );
              }}
            >
              {role.name}
            </Menu.Item>,
          );
        }
      });
    }
    return builder.build();
  };

  const _setTplVisibility = (visibility: TplVisibility) => {
    viewCtx.change(() =>
      viewCtx.getViewOps().setTplVisibility(tpl, visibility),
    );
  };
  const _setCustomCond = (cond: CustomCode | ObjectPath) => {
    viewCtx.change(() => {
      viewCtx.getViewOps().setTplVisibility(tpl, TplVisibility.CustomExpr);
      viewCtx.getViewOps().setDataCond(tpl, cond);
    });
  };

  const showSimpleControls =
    visibilityChoices.length === 4 &&
    currentVisibility !== TplVisibility.NotRendered &&
    currentVisibility !== TplVisibility.CustomExpr;
  return (
    <SidebarSection
      title={uiT("Visibility")}
      {...(!customCode && { emptyBody: true })}
      isHeaderActive={
        targetHasVisibility || opacityCell?.targetHas
      }
      controls={
        <div className={S.controlsContainer}>
          {!noStyles && (
            <LabeledStyleDimItem
              className={S.opacityField}
              styleName="opacity"
              definedIndicator={opacityDefinedIndicator}
              aria-label={uiT("Opacity")}
              autoWidth
              dimOpts={{
                value: formattedOpacity,
                onChange: handleOpacityChange,
                min: 0,
                max: 100,
                extraOptions: ["100%", "50%", "0%"],
                minDropdownWidth: 170,
                allowedUnits: PERCENTAGE_UNITS,
                allowFunctions: true,
                tooltip: uiT("Opacity"),
                className: cn(S.opacityInput),
              }}
              tokenType={"Opacity"}
              vsh={vsh}
            />
          )}
          <LabeledItem
            menu={visibilityMenu}
            noMenuButton
            className={cn("no-outline", S.visibilityTogglers)}
            definedIndicator={visibilityDefinedIndicator}
            autoWidth
          >
            <ContextMenuIndicator
              menu={visibilityMenu}
              showDynamicValueButton={true}
              onIndicatorClickDefault={() => {
                switchToDynamicValue();
              }}
              style={{
                width: "100%",
              }}
            >
              <StyleToggleButtonGroup
                value={currentVisibility}
                onChange={(val) => _setTplVisibility(val as TplVisibility)}
                isDisabled={isDisabled || hasPrivateStyleVariant}
                disabledTooltip={
                  disabledTooltip ??
                  (hasPrivateStyleVariant
                    ? uiT(
                        "Cannot toggle visibility when targeting element state",
                      )
                    : undefined)
                }
                data-test-id="visibility-choices"
              >
                {visibilityChoices
                  .slice(0, showSimpleControls ? 2 : 4)
                  .map((vis) => (
                    <StyleToggleButton
                      key={vis}
                      value={vis}
                      tooltip={getVisibilityLabel(vis)}
                      data-plasmic-prop={getVisibilityDataProp(vis)}
                    >
                      {getVisibilityIcon(vis)}
                    </StyleToggleButton>
                  ))}
              </StyleToggleButtonGroup>
            </ContextMenuIndicator>
          </LabeledItem>
        </div>
      }
    >
      {customCode && (
        <>
          <LabeledItemRow
            data-test-id="visibility-custom-code"
            label={uiT("Condition")}
          >
            <DataPickerEditor
              viewCtx={viewCtx}
              value={extractValueSavedFromDataPicker(customCode, {
                projectFlags: viewCtx.projectFlags(),
                component: viewCtx.currentComponent(),
                inStudio: true,
              })}
              onChange={(val) => {
                if (!val) {
                  return;
                }
                const fallbackExpr = customCode.fallback
                  ? clone(customCode.fallback)
                  : undefined;
                const newExpr = createExprForDataPickerValue(
                  val,
                  fallbackExpr,
                ) as CustomCode | ObjectPath;
                _setCustomCond(newExpr);
              }}
              onUnlink={() => {
                const boolProp = ensureKnownCustomCode(customCode.fallback);
                if (tryExtractJson(boolProp)) {
                  _setTplVisibility(TplVisibility.Visible);
                } else {
                  _setTplVisibility(TplVisibility.NotRendered);
                }
              }}
              data={canvasEnv}
              schema={functionsSchema}
              key={tpl.uid}
              visible={isDataPickerVisible}
              setVisible={setIsDataPickerVisible}
              context="Condition to decide whether the selected element should be visible"
            />
          </LabeledItemRow>
          <FallbackEditor
            isSet={isFallbackSet(customCode)}
            onUnset={() => {
              const clonedExpr = clone(customCode);
              const newExpr = ensureInstance(
                clonedExpr,
                ObjectPath,
                CustomCode,
              );
              newExpr.fallback = undefined;
              _setCustomCond(newExpr);
            }}
            definedIndicator={visibilityDefinedIndicator}
          >
            {
              <BoolPropEditor
                onChange={(val) => {
                  const clonedExpr = clone(customCode);
                  const newExpr = ensureInstance(
                    clonedExpr,
                    ObjectPath,
                    CustomCode,
                  );
                  newExpr.fallback = codeLit(val);
                  _setCustomCond(newExpr);
                }}
                value={
                  customCode.fallback
                    ? tryExtractBoolean(customCode.fallback)
                    : undefined
                }
                defaultValueHint={false}
                disabled={isDisabled}
              />
            }
          </FallbackEditor>
        </>
      )}
    </SidebarSection>
  );
}
