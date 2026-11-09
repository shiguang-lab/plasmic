import { captureVariantModelWorld, useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useVariantLabelInputs } from "@/wab/client/components/variants/variant-label-inputs";
import { useViewSelection } from "@/wab/client/studio-ctx/selection-state";
import { TplExpsProvider } from "@/wab/client/components/style-controls/StyleComponent";
import { useTplStyleIndicators } from "@/wab/client/studio-ctx/style-inputs-react";
import { useCanvasRenderCount } from "@/wab/client/hooks/useCanvasRenderStatus";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { StyleOrCodeComponentVariantLabel } from "@/wab/client/components/VariantControls";
import { BaseVariantRow } from "@/wab/client/components/sidebar-tabs/BaseVariantRow";
import { VariantAnimations } from "@/wab/client/components/sidebar-tabs/VariantAnimations";
import { SidebarSection } from "@/wab/client/components/sidebar/SidebarSection";
import { makeClientPinManager } from "@/wab/client/components/variants/ClientPinManager";
import VariantRow from "@/wab/client/components/variants/VariantRow";
import { makeVariantsController } from "@/wab/client/components/variants/VariantsController";
import { makeVariantMenu } from "@/wab/client/components/variants/variant-menu";
import { IconLinkButton } from "@/wab/client/components/widgets";
import { ElementVariantsTooltip } from "@/wab/client/components/widgets/DetailedTooltips";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { LabelWithDetailedTooltip } from "@/wab/client/components/widgets/LabelWithDetailedTooltip";
import { UiLabel } from "@/wab/client/i18n/UiText";
import PlusIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Plus";
import { StudioCtx } from "@/wab/client/studio-ctx/StudioCtx";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { PRIVATE_STYLE_VARIANTS_CAP } from "@/wab/shared/Labels";
import {
  ensureVariantSetting,
  getPrivateStyleVariantsForTag,
} from "@/wab/shared/Variants";
import { spawn } from "@/wab/shared/common";
import { TplTag, Variant } from "@/wab/shared/model/classes";
import React from "react";

interface PrivateStyleVariantsProps { tpl: TplTag; viewCtx: ViewCtx; studioCtx: StudioCtx; }
export const PrivateStyleVariantsPanel = React.memo(function PrivateStyleVariantsPanel(props: PrivateStyleVariantsProps) {
  const world = useVariantModelWorld(props.studioCtx, props.tpl, props.viewCtx);
  return world.alive ? <PrivateStyleVariantsContent {...props} /> : null;
});
const PrivateStyleVariantsContent = React.memo(function PrivateStyleVariantsContent(props: PrivateStyleVariantsProps) {
    const { tpl, studioCtx, viewCtx } = props;
    useCanvasRenderCount(viewCtx);
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));

    const context = useViewSelection(viewCtx, (state) => state.context);
    const component = viewCtx.currentTplComponent().component;
    useVariantLabelInputs(studioCtx, component.variants, { component, componentVariants: true, focusedTag: tpl, node: tpl });
    const provider = React.useMemo(() => new TplExpsProvider(viewCtx, tpl), [viewCtx, tpl, context]);
    useTplStyleIndicators(provider, ["animation"]);
    const world = React.useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, tpl]);
    const [editingVariant, setEditingVariant] = React.useState<
      Variant | undefined
    >(undefined);

    if (!viewCtx.valState().maybeValSysRoot()) {
      return null;
    }

    const vcontroller = makeVariantsController(studioCtx, viewCtx);
    if (!vcontroller) {
      return null;
    }

    const pinManager = makeClientPinManager(viewCtx);
    const vtm = viewCtx.variantTplMgr();

    const addPrivateVariant = () =>
      studioCtx.changeUnsafe(() => {
        if (!world.isCurrent(viewCtx)) { return; }
        const variant = studioCtx
          .tplMgr()
          .createPrivateStyleVariant(component, tpl);

        ensureVariantSetting(tpl, [variant]);
        setEditingVariant(variant);
        vcontroller.onAddedVariant(variant);
      });

    const privateStyleVariants = getPrivateStyleVariantsForTag(component, tpl);

    // Get the current component variant combo (excluding private style variants and base variant)
    // This is needed to properly scope animations for VariantCombo [ComponentVariant, PrivateStyleVariant]
    const sharedVariantCombo = vtm.getCurrentSharedVariantComboForNode(tpl, {
      excludeBase: true,
    });

    // Check if any private style variant for this tpl is currently targeted
    const targetedVariants = vcontroller.getTargetedVariants();
    const hasTargetedPrivateVariant = privateStyleVariants.some((v) =>
      targetedVariants.includes(v),
    );

    return (
      <SidebarSection
        key={String(privateStyleVariants.length > 0)}
        zeroBodyPadding
        title={
          <div data-test-id="private-style-variants-title">
            <LabelWithDetailedTooltip tooltip={<ElementVariantsTooltip />}>
              {<UiLabel text={PRIVATE_STYLE_VARIANTS_CAP} />}
            </LabelWithDetailedTooltip>
          </div>
        }
        isHeaderActive={privateStyleVariants.length > 0}
        onHeaderClick={
          privateStyleVariants.length === 0 ? addPrivateVariant : undefined
        }
        controls={
          <IconLinkButton
            data-test-id="add-private-interaction-variant-button"
            onClick={addPrivateVariant}
          >
            <Icon icon={PlusIcon} />
          </IconLinkButton>
        }
      >
        <div
          className="pass-through"
          data-test-id="private-style-variants-section"
        >
          {/* Base row - represents the default state (no element state variant selected) */}
          <BaseVariantRow
            tpl={tpl}
            studioCtx={studioCtx}
            viewCtx={viewCtx}
            pinState={
              !hasTargetedPrivateVariant ? "selected-pinned" : undefined
            }
            onClick={() =>
              studioCtx.changeUnsafe(() =>
                  world.isCurrent(viewCtx) &&
                pinManager.removeSelectedVariants(privateStyleVariants),
              )
            }
          />

          {privateStyleVariants.map((variant) => (
            <VariantAnimations
              key={variant.uuid}
              variants={[...sharedVariantCombo, variant]}
              tpl={tpl}
              viewCtx={viewCtx}
            >
              {({
                addAnimationLayer,
                animationsList,
                animations,
                isAnimationPlaying,
                playAnimations,
                stopAnimations,
                previewAnimationButton,
              }) => (
                <VariantRow
                  variant={variant}
                  studioCtx={studioCtx}
                  viewCtx={viewCtx}
                  pinState={vcontroller.getPinState(variant)}
                  onClick={() =>
                    studioCtx.changeUnsafe(() => {
        if (!world.isCurrent(viewCtx)) { return; }
                      // Toggle behavior: if already selected, turn off; otherwise turn on
                      if (vcontroller.isTargeted(variant)) {
                        vcontroller.onToggleVariant(variant);
                      } else {
                        vcontroller.onClickVariant(variant);
                      }
                    })
                  }
                  menu={makeVariantMenu({
                    variant,
                    component,
                    onRemove: () =>
                      spawn(
                        studioCtx.changeUnsafe(() =>
                  world.isCurrent(viewCtx) &&
                          spawn(
                            studioCtx
                              .siteOps()
                              .removeVariant(component, variant),
                          ),
                        ),
                      ),
                    onCopyTo: (toVariant) =>
                      spawn(
                        studioCtx.changeUnsafe(() =>
                  world.isCurrent(viewCtx) &&
                          studioCtx
                            .tplMgr()
                            .copyToVariant(component, variant, toVariant),
                        ),
                      ),
                    previewAnimation:
                      animations.length > 0
                        ? isAnimationPlaying
                          ? {
                              type: "stop",
                              onClick: () => stopAnimations(),
                            }
                          : {
                              type: "play",
                              onClick: () => playAnimations(animations),
                            }
                        : undefined,
                  })}
                  addAnimationLayer={addAnimationLayer}
                  previewAnimationContainer={{
                    children: previewAnimationButton,
                  }}
                  additional={animationsList}
                  label={
                    <StyleOrCodeComponentVariantLabel
                      variant={variant}
                      forTag={tpl.tag}
                      forRoot={tpl === component.tplTree}
                      component={component}
                      onBlur={() => {
                        setEditingVariant(undefined);
                      }}
                      defaultEditing={variant === editingVariant}
                    />
                  }
                  hideIcon={true}
                />
              )}
            </VariantAnimations>
          ))}
        </div>
      </SidebarSection>
    );
  },
);
