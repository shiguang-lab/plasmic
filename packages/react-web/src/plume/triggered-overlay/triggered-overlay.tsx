import { usePlasmicCanvasContext } from "@plasmicapp/host";
import { FocusScope } from "@react-aria/focus";
import {
  DismissButton,
  useOverlay,
  useOverlayPosition,
} from "@react-aria/overlays";
import { DOMProps } from "@react-types/shared";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { pick } from "../../common";
import {
  mergeProps,
  mergeRefs,
  useIsomorphicLayoutEffect,
} from "../../react-utils";
import { Overrides } from "../../render/elements";
import {
  AnyPlasmicClass,
  mergeVariantToggles,
  PlasmicClassArgs,
  PlasmicClassOverrides,
  PlasmicClassVariants,
  VariantDef,
} from "../plume-utils";
import {
  getStyleProps,
  StyleProps,
} from "../props-utils";
import { TriggeredOverlayContext } from "./context";

export interface BaseTriggeredOverlayProps extends StyleProps, DOMProps {
  children?: React.ReactNode;
}

export interface TriggeredOverlayConfig<C extends AnyPlasmicClass> {
  isPlacedTopVariant?: VariantDef<PlasmicClassVariants<C>>;
  isPlacedBottomVariant?: VariantDef<PlasmicClassVariants<C>>;
  isPlacedLeftVariant?: VariantDef<PlasmicClassVariants<C>>;
  isPlacedRightVariant?: VariantDef<PlasmicClassVariants<C>>;

  contentSlot: keyof PlasmicClassArgs<C>;
  root: keyof PlasmicClassOverrides<C>;
}

export type TriggeredOverlayRef = React.Ref<HTMLElement>;

export function useTriggeredOverlay<
  P extends BaseTriggeredOverlayProps,
  C extends AnyPlasmicClass
>(
  plasmicClass: C,
  props: P,
  config: TriggeredOverlayConfig<C>,
  outerRef: TriggeredOverlayRef = null,
  isDismissable = true
) {
  const overlayRef = React.useRef<HTMLElement>(null);
  const retainTouchEnd = React.useCallback<React.RefCallback<HTMLElement>>((ref) => {
    // Workaround for https://github.com/adobe/react-spectrum/issues/1513
    // to avoid touch events leaking under the overlay when it is closed.
    if (ref) {
      const preventTouchEnd = (event: TouchEvent) => event.preventDefault();
      ref.addEventListener("touchend", preventTouchEnd);
      return () => ref.removeEventListener("touchend", preventTouchEnd);
    }
    return undefined;
  }, []);
  const onOverlayRef = React.useCallback<React.RefCallback<HTMLElement>>(
    (value) => mergeRefs(overlayRef, outerRef, retainTouchEnd)(value),
    [overlayRef, outerRef, retainTouchEnd]
  );

  const context = React.useContext(TriggeredOverlayContext);

  if (!context) {
    throw new Error("You can only use a triggered overlay with a TriggeredOverlayContext");
  }

  const { children } = props;
  const {
    triggerRef,
    placement,
    overlayMatchTriggerWidth,
    overlayMinTriggerWidth,
    overlayWidth,
    state,
  } = context;

  // Measure the width of the trigger to inform the width of the menu (below).
  const [triggerWidth, setTriggerWidth] = React.useState<number | undefined>();
  useIsomorphicLayoutEffect(() => {
    const trigger = triggerRef.current;
    setTriggerWidth(trigger && (overlayMatchTriggerWidth || overlayMinTriggerWidth)
      ? trigger.offsetWidth : undefined);
  });

  const { overlayProps: overlayAriaProps } = useOverlay(
    {
      isOpen: state.isOpen,
      onClose: state.close,
      isDismissable,
      shouldCloseOnBlur: true,
    },
    overlayRef
  );

  const {
    overlayProps: overlayPositionProps,
    updatePosition,
    placement: placementAxis,
  } = useOverlayPosition({
    targetRef: triggerRef,
    overlayRef,
    placement: placement ?? "bottom left",
    shouldFlip: true,
    isOpen: state.isOpen,
    onClose: state.close,
    containerPadding: 0,
  });

  useIsomorphicLayoutEffect(() => {
    if (state.isOpen) {
      requestAnimationFrame(() => {
        updatePosition();
      });
    }
  }, [state.isOpen, updatePosition]);

  const overlayProps = mergeProps(
    {
      style: {
        left: "auto",
        right: "auto",
        top: "auto",
        bottom: "auto",
        position: "absolute",
        width:
          overlayWidth ?? (overlayMatchTriggerWidth ? triggerWidth : "auto"),
        minWidth: overlayMinTriggerWidth ? triggerWidth : "auto",
      },
    },
    overlayAriaProps,
    overlayPositionProps
  );

  const variants = {
    ...pick(props, ...plasmicClass.internalVariantProps),
    ...mergeVariantToggles(
      { def: config.isPlacedTopVariant, active: placementAxis === "top" },
      { def: config.isPlacedBottomVariant, active: placementAxis === "bottom" },
      { def: config.isPlacedLeftVariant, active: placementAxis === "left" },
      { def: config.isPlacedRightVariant, active: placementAxis === "right" }
    ),
  };

  const canvasCtx = usePlasmicCanvasContext();
  const args = {
    ...pick(props, ...plasmicClass.internalArgProps),
    [config.contentSlot]:
      canvasCtx && !canvasCtx.interactive ? (
        children
      ) : (
        <FocusScope restoreFocus>
          <DismissButton onDismiss={state.close} />
          {children}
          {/* We don't use the DismissButton at the end because it ends up taking up 1px space :-/ */}
          {/* <DismissButton onDismiss={state.close} /> */}
        </FocusScope>
      ),
  };

  const overrides: Overrides = {
    [config.root]: {
      props: { ...mergeProps(overlayProps, getStyleProps(props)), ref: onOverlayRef },
      wrap: (root: React.ReactNode) => {
        if (typeof document !== "undefined") {
          return ReactDOM.createPortal(root, document.body);
        } else {
          // Possibly being invoked on the server during SSR; no need to
          // bother with a portal in that case.
          return root;
        }
      },
    },
  };

  return {
    plasmicProps: {
      variants: variants as PlasmicClassVariants<C>,
      args: args as PlasmicClassArgs<C>,
      overrides: overrides as PlasmicClassOverrides<C>,
    },
  };
}
