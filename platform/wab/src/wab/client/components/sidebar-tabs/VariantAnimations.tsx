import type { VariantAnimationDisplay } from "@/wab/client/components/sidebar-tabs/variant-animation-inputs";
import { useVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { PlexusButton } from "@/wab/client/components/plexus/PlexusButton";
import { useNewAnimationContext } from "@/wab/client/components/sidebar-tabs/style-tab";
import { useAnimations } from "@/wab/client/components/sidebar-tabs/useAnimations";
import { SidebarModal } from "@/wab/client/components/sidebar/SidebarModal";
import { AnimationControls } from "@/wab/client/components/style-controls/AnimationControls";
import { StyleWrapper } from "@/wab/client/components/style-controls/StyleWrapper";
import { ListBox, ListBoxItem } from "@/wab/client/components/widgets";
import { Icon } from "@/wab/client/components/widgets/Icon";
import { useI18n } from "@/wab/client/i18n";
import PlayIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__PlaySvg";
import StopIcon from "@/wab/client/plasmic/plasmic_kit/PlasmicIcon__Stop";
import KeyframesIcon from "@/wab/client/plasmic/plasmic_kit_icons/icons/PlasmicIcon__Keyframes";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { VariantCombo, tryGetPrivateStyleVariant } from "@/wab/shared/Variants";
import { arrayEqIgnoreOrder } from "@/wab/shared/common";
import { TplTag } from "@/wab/shared/model/classes";
import { Tooltip } from "antd";
import React from "react";

interface VariantAnimationsRenderProps {
  addAnimationLayer: () => void;
  animationsList: React.ReactNode | null;
  animations: readonly VariantAnimationDisplay[];
  playAnimations: (animations: readonly VariantAnimationDisplay[]) => void;
  stopAnimations: () => void;
  isAnimationPlaying: boolean;
  previewAnimationButton: React.ReactNode | null;
}

interface VariantAnimationsProps {
  variants: VariantCombo;
  tpl: TplTag;
  viewCtx: ViewCtx;
  children: (props: VariantAnimationsRenderProps) => React.ReactNode;
}

export const VariantAnimations = React.memo(function VariantAnimations(props: VariantAnimationsProps) {
  const world = useVariantModelWorld(props.viewCtx.studioCtx, props.tpl, props.viewCtx);
  return world.alive ? <VariantAnimationsContent {...props} /> : null;
});
const VariantAnimationsContent = React.memo(function VariantAnimationsContent(
  props: VariantAnimationsProps,
) {
  const { t: uiT } = useI18n();
  const { variants, tpl, viewCtx, children } = props;
  const { newAnimation, onAnimationAdded } = useNewAnimationContext();
  const privateStyleVariant = tryGetPrivateStyleVariant(variants);

  const {
    addAnimationLayer,
    animations,
    animationDisplay,
    variantSelectors,
    inspectedAnimation,
    vsh,
    closeInspectedAnimation,
    removeAnimation,
    reorderAnimations,
    openAnimationForEditing,
    onInspectedAnimationChange,
    playAnimations,
    stopAnimations,
    isAnimationPlaying,
  } = useAnimations({ tpl, variants, viewCtx });

  // Determine if we should auto-add an animation based on context
  // - For "base" type: auto-add if there's no private style variant in the combo
  // - For "selector" type: auto-add if the private style variant has the matching selector
  const shouldAutoAdd =
    (newAnimation?.type === "base" && !privateStyleVariant) ||
    (newAnimation?.type === "selector" &&
      arrayEqIgnoreOrder(variantSelectors, [
        newAnimation.cssSelector,
      ]));

  // Auto-add animation when requested from the Animations submenu
  React.useEffect(() => {
    if (shouldAutoAdd) {
      addAnimationLayer();
      onAnimationAdded();
    }
  }, [shouldAutoAdd]);

  const animationsList =
    animations.length > 0 ? (
      <StyleWrapper styleName={["animation"]} className="flex-fill">
        <ListBox appendPrepend={"append"} onReorder={reorderAnimations}>
          {animationDisplay.map((animation, i: number) => {
            return (
              <ListBoxItem
                key={animation.target.uid}
                index={i}
                onRemove={() => removeAnimation(animation.target)}
                onClick={() => openAnimationForEditing(i)}
                mainContent={
                  <div className={"flex flex-vcenter gap-sm"}>
                    <KeyframesIcon className={"dimfg text-xlg"} />
                    <code className="text-ellipsis">
                      {animation.sequence.name} ({animation.duration})
                    </code>
                  </div>
                }
                gridThumbnail
              />
            );
          })}
        </ListBox>
      </StyleWrapper>
    ) : null;

  const previewAnimationButton =
    animations.length > 0 ? (
      <>
        {isAnimationPlaying ? (
          <PlexusButton
            onClick={stopAnimations}
            start={
              <Tooltip title={uiT("Stop animation")}>
                <Icon icon={StopIcon} />
              </Tooltip>
            }
            iconStart={true}
            label={null}
            type={"clear"}
            color={"neutral"}
          />
        ) : (
          <PlexusButton
            onClick={() => playAnimations(animations)}
            start={
              <Tooltip title={uiT("Play animation")}>
                <Icon icon={PlayIcon} />
              </Tooltip>
            }
            iconStart={true}
            label={null}
            type={"clear"}
            color={"neutral"}
          />
        )}
      </>
    ) : null;

  return (
    <>
      {children({
        addAnimationLayer,
        animationsList,
        isAnimationPlaying,
        animations: animationDisplay,
        playAnimations: (entries) => playAnimations(entries.map((entry) => entry.target)),
        stopAnimations,
        previewAnimationButton,
      })}

      <SidebarModal
        show={!!inspectedAnimation}
        onClose={closeInspectedAnimation}
        title={uiT("Apply Animation")}
      >
        {inspectedAnimation && (
          <div className="panel-content">
            <AnimationControls
              studioCtx={viewCtx.studioCtx}
              animation={inspectedAnimation}
              vsh={vsh}
              onUpdated={onInspectedAnimationChange}
            />
          </div>
        )}
      </SidebarModal>
    </>
  );
});
