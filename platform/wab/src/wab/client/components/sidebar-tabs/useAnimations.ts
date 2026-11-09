import { useVariantAnimationInputs } from "@/wab/client/components/sidebar-tabs/variant-animation-inputs";
import { captureVariantModelWorld } from "@/wab/client/components/variants/variant-model-world";
import { useVariantedStylesHelperFromCurrentCtx } from "@/wab/client/studio-ctx/varianted-style-context";
import { useViewVariants } from "@/wab/client/studio-ctx/variant-state";
import { useShallow } from "zustand/react/shallow";
import { useInspectorSelection } from "@/wab/client/studio-ctx/inspector-state";
import { useI18n } from "@/wab/client/i18n";
import { useStudioCtx } from "@/wab/client/contexts/StudioContexts";
import { ViewCtx } from "@/wab/client/studio-ctx/view-ctx";
import { useForceUpdate } from "@/wab/client/useForceUpdate";
import { useSignalListener } from "@/wab/commons/components/use-signal-listener";
import { ANIMATIONS_LOWER } from "@/wab/shared/Labels";
import { VariantCombo } from "@/wab/shared/Variants";
import { spawn } from "@/wab/shared/common";
import { Animation, TplTag } from "@/wab/shared/model/classes";
import { notification } from "antd";
import { ok } from "neverthrow";
import { useMemo, useState } from "react";

interface UseAnimationsOptions {
  tpl: TplTag;
  variants: VariantCombo;
  viewCtx: ViewCtx;
  isDisabled?: boolean;
}

export function useAnimations(options: UseAnimationsOptions) {
  const { t: studioUiT, label } = useI18n();

  const { tpl, variants, viewCtx, isDisabled } = options;
  useViewVariants(viewCtx, useShallow((variantState) => [variantState.frames, variantState.global]));
  const studioCtx = useStudioCtx();
  const world = useMemo(() => captureVariantModelWorld(studioCtx), [studioCtx, tpl]);
  const animationInputs = useVariantAnimationInputs(viewCtx, tpl, variants);
  const vtm = viewCtx.variantTplMgr();

  const { animations, definedIndicator, allSequences: allAnimSequences, display: animationDisplay, selectors: variantSelectors } = animationInputs;

  const [inspectedIndex, setInspectedIndex] = useState<number | undefined>();
  const inspectedAnimation =
    inspectedIndex !== undefined ? animations?.[inspectedIndex] : undefined;

  const vsh = useVariantedStylesHelperFromCurrentCtx(studioCtx);

  const focusedTpl = useInspectorSelection(studioCtx)?.tpl;
  const forceUpdate = useForceUpdate();
  useSignalListener(studioCtx.animationChanged, forceUpdate, [studioCtx]);

  const isAnimationPlaying =
    focusedTpl && studioCtx.styleMgrBcast.hasActiveAnimationPreview(focusedTpl);

  const playAnimations = (previewAnimations: Animation[]) => {
    if (!world.isCurrent(viewCtx) || previewAnimations.length === 0 || isDisabled || !focusedTpl) {
      return;
    }
    spawn(
      studioCtx.styleMgrBcast.playAnimationPreview(
        focusedTpl,
        previewAnimations,
      ),
    );
  };

  const stopAnimations = () => {
    if (world.isCurrent(viewCtx) && isAnimationPlaying && focusedTpl) {
      studioCtx.styleMgrBcast.stopAnimationPreview(focusedTpl);
    }
  };

  const triggerAnimationPreviewOnUpdate = (previewAnimations: Animation[]) => {
    stopAnimations();
    playAnimations(previewAnimations);
  };

  const closeInspectedAnimation = () => {
    setInspectedIndex(undefined);
    stopAnimations();
  };

  const onInspectedAnimationChange = () => {
    triggerAnimationPreviewOnUpdate(animations);
  };

  const addAnimationLayer = () => {
    if (!world.isCurrent(viewCtx)) { return; }
    if (allAnimSequences.length === 0) {
      studioCtx.switchLeftTab("animationSequences", { highlight: true });
      notification.warning({
        message: studioUiT("Please add {part1} in your project.", {
          part1: label(ANIMATIONS_LOWER),
        }),
      });
      return;
    }

    spawn(
      studioCtx.change(() => {
        if (!world.isCurrent(viewCtx)) { return ok(); }
        const defaultSequence = allAnimSequences[0];
        const newAnimation = studioCtx.tplMgr().addAnimation(defaultSequence);
        const newAnimations = vtm.addAnimation(tpl, newAnimation, variants);

        setInspectedIndex(newAnimations.length - 1);
        triggerAnimationPreviewOnUpdate(newAnimations);

        return ok();
      }),
    );
  };

  const removeAnimation = (animation: Animation) => {
    if (!world.isCurrent(viewCtx) || isDisabled) {
      return;
    }

    spawn(
      studioCtx.change(() => {
        if (!world.isCurrent(viewCtx)) { return ok(); }
        const tplAnimations = vtm.removeAnimation(tpl, animation, variants);
        triggerAnimationPreviewOnUpdate(tplAnimations);
        return ok();
      }),
    );
  };

  const reorderAnimations = (from: number, to: number) => {
    if (!world.isCurrent(viewCtx) || isDisabled) {
      return;
    }

    spawn(
      studioCtx.change(() => {
        if (!world.isCurrent(viewCtx)) { return ok(); }
        const newAnimations = vtm.reorderAnimations(tpl, from, to, variants);
        triggerAnimationPreviewOnUpdate(newAnimations);
        return ok();
      }),
    );
  };

  const openAnimationForEditing = (index: number) => {
    if (!world.isCurrent(viewCtx) || isDisabled) {
      return;
    }

    spawn(
      studioCtx.change(() => {
        if (!world.isCurrent(viewCtx)) { return ok(); }
        vtm.ensureAnimationsForEditing(tpl, variants);
        setInspectedIndex(index);
        return ok();
      }),
    );
  };

  return {
    inspectedAnimation,
    animations,
    animationDisplay,
    variantSelectors,
    vsh,
    isAnimationPlaying: !!isAnimationPlaying,
    addAnimationLayer,
    removeAnimation,
    reorderAnimations,
    openAnimationForEditing,
    closeInspectedAnimation,
    playAnimations,
    stopAnimations,
    onInspectedAnimationChange,
    definedIndicator,
  };
}
